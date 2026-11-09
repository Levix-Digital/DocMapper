//! The parity module `text`: the core text utilities checked against the
//! fixtures of the frozen TypeScript copy (`parity/text`) and fuzzed against
//! the TypeScript oracle.

use docmapper_core::text::{
    check_validation_pattern, flatten_dictionary, format_output_file_name, sanitize_punctuation,
    CalendarDate, FileNameError, FileNameOptions, PropertyMap,
};
use docmapper_parity::compare::exact_eq;
use docmapper_parity::fixture::Outcome;
use docmapper_parity::oracle::Oracle;
use docmapper_parity::runner::assert_module_with;
use proptest::prelude::*;
use serde_json::{json, Map, Value};
use std::sync::{Mutex, OnceLock};

const MODULE: &str = "text";
/// Stands in for the message of an invalid pattern on both sides (ADR-0010).
const PATTERN_ERROR_MARKER: &str = "<invalid pattern message>";

fn text_of(value: &Value) -> String {
    value.as_str().unwrap_or_default().to_string()
}

fn file_name_options(value: &Value) -> FileNameOptions {
    let field = |name: &str| value.get(name).cloned().unwrap_or(Value::Null);
    let extracted_data: PropertyMap<String> = match field("extractedData") {
        Value::Object(map) => map.into_iter().map(|(k, v)| (k, text_of(&v))).collect(),
        _ => PropertyMap::new(),
    };
    FileNameOptions {
        pattern: field("pattern").as_str().map(str::to_string),
        original_file_name: text_of(&field("originalFileName")),
        extracted_data,
        doc_index: field("docIndex").as_u64().unwrap_or_default(),
        total_docs: field("totalDocs").as_u64(),
    }
}

/// The JavaScript error each core error stands for.
fn javascript_error(error: &FileNameError) -> Outcome {
    match error {
        FileNameError::InheritedMemberToken { .. } => {
            Outcome::error("TypeError", "extractedData[trimmed].trim is not a function")
        }
        FileNameError::StringTooLong => Outcome::error("RangeError", "Invalid string length"),
    }
}

fn format_name(options: &Value, now_ms: &Value) -> Outcome {
    let date = now_ms
        .as_i64()
        .and_then(CalendarDate::from_unix_millis)
        .unwrap_or_else(|| panic!("clock outside 1970..9999: {now_ms}"));
    match format_output_file_name(&file_name_options(options), date) {
        Ok(name) => Outcome::Output(json!(name)),
        Err(error) => javascript_error(&error),
    }
}

fn check_pattern(pattern: &str, candidate: &str) -> Outcome {
    let check = check_validation_pattern(pattern, candidate);
    let mut object = Map::new();
    object.insert("matches".into(), json!(check.matches));
    if let Some(message) = check.error {
        object.insert("error".into(), json!(message));
    }
    Outcome::Output(Value::Object(object))
}

fn flatten(nested: &Map<String, Value>, prefix: &str) -> Outcome {
    match flatten_dictionary(nested, prefix) {
        Ok(flat) => Outcome::Output(Value::Object(
            flat.iter()
                .map(|(k, v)| (k.to_string(), json!(v)))
                .collect(),
        )),
        Err(_) => Outcome::error("TypeError", "Cannot convert object to primitive value"),
    }
}

fn call(function: &str, input: &[Value]) -> Outcome {
    match (function, input) {
        ("formatOutputFileName", [options, now_ms]) => format_name(options, now_ms),
        ("testRegexPattern", [Value::String(pattern), Value::String(candidate)]) => {
            check_pattern(pattern, candidate)
        }
        ("flattenDictionary", [Value::Object(nested)]) => flatten(nested, ""),
        ("flattenDictionary", [Value::Object(nested), Value::String(prefix)]) => {
            flatten(nested, prefix)
        }
        ("sanitizePunctuation", [Value::String(source), Value::String(translated)]) => {
            Outcome::Output(json!(sanitize_punctuation(source, translated)))
        }
        _ => panic!("no Rust twin for {MODULE}.{function} with input {input:?}"),
    }
}

/// FR-008: the message of an invalid pattern is compared by presence only.
fn mask_pattern_error(function: &str, outcome: &Outcome) -> Outcome {
    match outcome {
        Outcome::Output(Value::Object(object))
            if function == "testRegexPattern" && object.contains_key("error") =>
        {
            let mut object = object.clone();
            object.insert("error".into(), json!(PATTERN_ERROR_MARKER));
            Outcome::Output(Value::Object(object))
        }
        other => other.clone(),
    }
}

#[test]
fn text_fixtures_match() {
    assert_module_with(MODULE, call, mask_pattern_error);
}

#[test]
fn pattern_error_mask_keeps_presence_and_matches() {
    let with_error = |message: &str| Outcome::Output(json!({"matches": false, "error": message}));
    assert_eq!(
        mask_pattern_error("testRegexPattern", &with_error("V8 text")),
        mask_pattern_error("testRegexPattern", &with_error("regress text"))
    );
    let without = Outcome::Output(json!({"matches": false}));
    assert_ne!(
        mask_pattern_error("testRegexPattern", &with_error("x")),
        mask_pattern_error("testRegexPattern", &without)
    );
}

// Differential fuzzing through the oracle.

fn ask(function: &str, input: &[Value]) -> Outcome {
    static ORACLE: OnceLock<Mutex<Oracle>> = OnceLock::new();
    let oracle = ORACLE
        .get_or_init(|| Mutex::new(Oracle::start_default().unwrap_or_else(|e| panic!("{e}"))));
    let mut oracle = oracle
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    oracle
        .call(MODULE, function, input)
        .unwrap_or_else(|e| panic!("{e}"))
}

fn same_as_typescript(function: &str, input: &[Value]) -> Result<(), TestCaseError> {
    let expected = mask_pattern_error(function, &ask(function, input));
    let actual = mask_pattern_error(function, &call(function, input));
    match (&expected, &actual) {
        (Outcome::Output(e), Outcome::Output(a)) => {
            exact_eq(e, a).map_err(|m| TestCaseError::fail(format!("{function} {input:?}: {m}")))
        }
        _ if expected == actual => Ok(()),
        _ => Err(TestCaseError::fail(format!(
            "{function} {input:?}: expected {expected:?}, got {actual:?}"
        ))),
    }
}

/// Pieces that reach the branches and the ECMAScript rules that matter.
const PIECES: &[&str] = &[
    "a",
    "Z",
    "7",
    "0",
    " ",
    "  ",
    "\t",
    "\n",
    "\u{a0}",
    "\u{feff}",
    "\u{2028}",
    "\u{3000}",
    "\u{85}",
    "\u{180e}",
    ";",
    ":",
    ".",
    ",",
    "_",
    "/",
    "\\",
    "*",
    "?",
    "\"",
    "<",
    ">",
    "|",
    "{",
    "}",
    "$&",
    "$'",
    "$`",
    "$$",
    "$1",
    "$<n>",
    "{seq}",
    "{SEQ:05}",
    "{seq:2}",
    "{seq:}",
    "{index}",
    "{date}",
    "{originalName}",
    "{ref}",
    "{Ref }",
    "{toString}",
    "{ __proto__ }",
    "{valueOf}",
    "{}",
    ".pdf",
    ".PDF",
    "İ",
    "Σ",
    "ß",
    "ẞ",
    "é",
    "😀",
    "ǅ",
    "ﬀ",
];

fn text_from(pieces: &'static [&'static str], max: usize) -> impl Strategy<Value = String> {
    prop::collection::vec(prop::sample::select(pieces), 0..max).prop_map(|parts| parts.concat())
}

fn mixed_text(max: usize) -> impl Strategy<Value = String> {
    prop_oneof![text_from(PIECES, max), "[ -~]{0,12}"]
}

const KEYS: &[&str] = &[
    "ref",
    "REF",
    "Ref",
    "ref ",
    "",
    "1",
    "2",
    "10",
    "02",
    "4294967295",
    "__proto__",
    "toString",
    "constructor",
    "İd",
    "i̇d",
    "ΟΔΟΣ",
    "οδος",
    "a.b",
    "a",
];

fn extracted_data() -> impl Strategy<Value = Value> {
    prop::collection::vec((prop::sample::select(KEYS), mixed_text(4)), 0..5).prop_map(|pairs| {
        Value::Object(
            pairs
                .into_iter()
                .map(|(k, v)| (k.to_string(), json!(v)))
                .collect(),
        )
    })
}

fn file_name_input() -> impl Strategy<Value = Vec<Value>> {
    (
        prop::option::of(mixed_text(8)),
        mixed_text(6),
        extracted_data(),
        0u64..100_000,
        0i64..253_402_300_799_999,
    )
        .prop_map(|(pattern, original, data, index, now)| {
            let mut options = Map::new();
            if let Some(pattern) = pattern {
                options.insert("pattern".into(), json!(pattern));
            }
            options.insert("originalFileName".into(), json!(original));
            options.insert("extractedData".into(), data);
            options.insert("docIndex".into(), json!(index));
            vec![Value::Object(options), json!(now)]
        })
}

/// Pattern atoms from a small grammar with no nested unbounded quantifiers,
/// so no pattern can backtrack for long.
const PATTERN_ATOMS: &[&str] = &[
    "a", "b", "\\d", "\\w", "\\s", "\\S", ".", "^", "$", "[a-z]", "[^a]", "[\\d-z]", "\\b", "(a)",
    "(?:ab)", "(?<n>a)", "\\k<n>", "\\1", "\\8", "\\01", "\\0", "\\c", "\\cA", "\\x41", "\\x4",
    "\\u0061", "\\u{2}", "\\u", "\\p{L}", "\\-", "\\a", "a{", "a{2}", "a{1,2}", "a{,2}", "{", "}",
    "]", "[", "(", ")", "*", "+", "?", "|", "(?=a)", "(?!a)", "(?<=a)", "(?<!a)", "[\\b]", "[b-a]",
    "\\/", "😀", "\u{feff}",
];

const CANDIDATE_PIECES: &[&str] = &[
    "a", "b", "A", "0", "7", " ", "\u{feff}", "\u{85}", "😀", "u", "{", "}", "]", "\u{1}", "\u{8}",
    "-", "p{L}", "é", "\n",
];

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn format_output_file_name_matches_typescript(input in file_name_input()) {
        same_as_typescript("formatOutputFileName", &input)?;
    }

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn test_regex_pattern_matches_typescript(
        pattern in text_from(PATTERN_ATOMS, 6),
        candidate in text_from(CANDIDATE_PIECES, 8),
    ) {
        same_as_typescript("testRegexPattern", &[json!(pattern), json!(candidate)])?;
    }

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn flatten_dictionary_matches_typescript(
        nested in dictionary(),
        prefix in prop::option::of(prop::sample::select(&["", "p", "a.b", "__proto__"][..])),
    ) {
        let mut input = vec![nested];
        if let Some(prefix) = prefix {
            input.push(json!(prefix));
        }
        same_as_typescript("flattenDictionary", &input)?;
    }

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn sanitize_punctuation_matches_typescript(source in mixed_text(5), translated in mixed_text(6)) {
        same_as_typescript("sanitizePunctuation", &[json!(source), json!(translated)])?;
    }
}

fn leaf() -> impl Strategy<Value = Value> {
    prop_oneof![
        mixed_text(4).prop_map(|t| json!(t)),
        Just(Value::Null),
        any::<bool>().prop_map(|b| json!(b)),
        any::<i64>().prop_map(|n| json!(n)),
        (-1e25f64..1e25).prop_map(|n| json!(n)),
        prop::sample::select(&[0.1, 1e21, 1e-7, 5e-324, 1.7976931348623157e308][..])
            .prop_map(|n| json!(n)),
        Just(json!("12345678901234567890"
            .parse::<u64>()
            .unwrap_or(u64::MAX))),
    ]
}

fn dictionary() -> impl Strategy<Value = Value> {
    let value = leaf().prop_recursive(4, 32, 5, |inner| {
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..4).prop_map(Value::Array),
            prop::collection::vec((prop::sample::select(KEYS), inner), 0..5).prop_map(|pairs| {
                Value::Object(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            }),
        ]
    });
    prop::collection::vec((prop::sample::select(KEYS), value), 0..6).prop_map(|pairs| {
        Value::Object(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
    })
}
