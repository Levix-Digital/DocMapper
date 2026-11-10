//! The parity module `profiles`: the core profile store checked against the
//! fixtures of the frozen TypeScript copy (`parity/profiles`) on the
//! in-memory and the SQLite repository, and fuzzed against the TypeScript
//! oracle.

use docmapper_core::profiles::{
    export_docmapper, into_ecmascript_order, Clock, InMemoryProfileRepository, ProfileDocument,
    ProfileRepository, ProfileStore, RandomSource, StoreError, INVALID_FILE_MESSAGE,
};
use docmapper_parity::compare::exact_eq;
use docmapper_parity::fixture::Outcome;
use docmapper_parity::oracle::Oracle;
use docmapper_parity::runner::assert_module_with;
use docmapper_sqlite::SqliteProfileRepository;
use proptest::prelude::*;
use serde_json::{json, Map, Value};
use std::cell::Cell;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

const MODULE: &str = "profiles";
/// Stands in for the message of a malformed file on both sides (FR-009).
const SYNTAX_ERROR_MARKER: &str = "<malformed JSON message>";

/// Every reading gives `start + n * step`, as the TypeScript harness does.
struct TickingClock {
    start: f64,
    step: f64,
    reads: Cell<u32>,
}

impl Clock for TickingClock {
    fn now_millis(&self) -> f64 {
        let n = self.reads.get();
        self.reads.set(n + 1);
        self.start + f64::from(n) * self.step
    }
}

struct ScriptedRandom(VecDeque<f64>);

impl RandomSource for ScriptedRandom {
    fn next_f64(&mut self) -> f64 {
        self.0
            .pop_front()
            .unwrap_or_else(|| panic!("the scenario has no more random values"))
    }
}

fn number(value: &Value, what: &str) -> f64 {
    value
        .as_f64()
        .unwrap_or_else(|| panic!("{what} is not a number: {value}"))
}

fn documents(stored: &Value) -> Vec<ProfileDocument> {
    stored
        .as_array()
        .unwrap_or_else(|| panic!("stored is not a list: {stored}"))
        .iter()
        .map(|p| {
            ProfileDocument::from_value(p.clone())
                .unwrap_or_else(|| panic!("stored profile is not an object: {p}"))
        })
        .collect()
}

fn javascript_error(error: StoreError) -> Outcome {
    match error {
        StoreError::InvalidFile => Outcome::error("Error", INVALID_FILE_MESSAGE),
        StoreError::Syntax(message) => Outcome::error("SyntaxError", message),
        StoreError::Type(message) => Outcome::error("TypeError", message),
        StoreError::Range(message) => Outcome::error("RangeError", message),
        StoreError::Repository(error) => panic!("repository failed: {error}"),
    }
}

fn result(returned: Value, repository: &impl ProfileRepository) -> Outcome {
    let stored: Vec<Value> = repository
        .list()
        .unwrap_or_else(|e| panic!("{e}"))
        .into_iter()
        .map(ProfileDocument::into_value)
        .collect();
    Outcome::Output(json!({ "returned": returned, "stored": stored }))
}

fn arg(args: &[Value], index: usize) -> Value {
    args.get(index).cloned().unwrap_or(Value::Null)
}

fn profile_arg(args: &[Value]) -> ProfileDocument {
    let value = arg(args, 0);
    ProfileDocument::from_value(value.clone())
        .unwrap_or_else(|| panic!("profile argument is not an object: {value}"))
}

/// Runs one scenario on `repository`.
fn run_on<R: ProfileRepository>(repository: R, function: &str, scenario: &Value) -> Outcome {
    let clock = TickingClock {
        start: number(&scenario["clock"]["start"], "clock.start"),
        step: number(&scenario["clock"]["step"], "clock.step"),
        reads: Cell::new(0),
    };
    let random = ScriptedRandom(
        scenario["random"]
            .as_array()
            .unwrap_or_else(|| panic!("random is not a list"))
            .iter()
            .map(|v| number(v, "random value"))
            .collect(),
    );
    let args = scenario["args"].as_array().cloned().unwrap_or_default();
    let mut store = ProfileStore::new(repository, clock, random);
    let returned = match function {
        "createEmptyProfile" => store
            .create_empty_profile(args.first().cloned())
            .map(ProfileDocument::into_value),
        "getAllProfiles" => store
            .all_profiles()
            .map(|all| Value::Array(all.into_iter().map(ProfileDocument::into_value).collect())),
        "getProfileById" => store
            .profile_by_id(&arg(&args, 0))
            .map(|found| found.map_or(Value::Null, ProfileDocument::into_value)),
        "saveProfile" => store.save_profile(profile_arg(&args)).map(|()| Value::Null),
        "deleteProfile" => store.delete_profile(&arg(&args, 0)).map(Value::Bool),
        "duplicateProfile" => store
            .duplicate_profile(&arg(&args, 0))
            .map(|copy| copy.map_or(Value::Null, ProfileDocument::into_value)),
        "exportProfileAsDocMapper" => export_docmapper(&profile_arg(&args))
            .map(|file| json!({ "fileName": file.file_name, "contents": file.contents })),
        "importProfileFromDocMapper" => {
            let text = arg(&args, 0);
            store
                .import_docmapper(text.as_str().unwrap_or_else(|| panic!("text argument")))
                .map(ProfileDocument::into_value)
        }
        _ => panic!("no Rust twin for {MODULE}.{function}"),
    };
    match returned {
        Ok(value) => result(value, store.repository()),
        Err(error) => javascript_error(error),
    }
}

/// Runs the scenario on the in-memory and on the SQLite repository; both
/// must give the same outcome.
fn call(function: &str, input: &[Value]) -> Outcome {
    let [scenario] = input else {
        panic!("{MODULE}.{function} takes one scenario, got {input:?}")
    };
    let stored = documents(&scenario["stored"]);
    let memory =
        InMemoryProfileRepository::with_documents(stored.clone()).unwrap_or_else(|e| panic!("{e}"));
    let mut sqlite = SqliteProfileRepository::open_in_memory().unwrap_or_else(|e| panic!("{e}"));
    for document in stored {
        sqlite.save(document).unwrap_or_else(|e| panic!("{e}"));
    }
    let in_memory = run_on(memory, function, scenario);
    let in_sqlite = run_on(sqlite, function, scenario);
    match (&in_memory, &in_sqlite) {
        (Outcome::Output(a), Outcome::Output(b)) => {
            if let Err(mismatch) = exact_eq(a, b) {
                panic!("{function}: SQLite differs from memory: {mismatch}");
            }
        }
        _ => assert_eq!(
            in_memory, in_sqlite,
            "{function}: SQLite differs from memory"
        ),
    }
    in_memory
}

/// FR-009: a malformed file is compared by error name only.
fn mask_syntax_error(_function: &str, outcome: &Outcome) -> Outcome {
    match outcome {
        Outcome::Error { name, .. } if name == "SyntaxError" => {
            Outcome::error("SyntaxError", SYNTAX_ERROR_MARKER)
        }
        other => other.clone(),
    }
}

#[test]
fn profiles_fixtures_match_on_both_repositories() {
    assert_module_with(MODULE, call, mask_syntax_error);
}

#[test]
fn syntax_error_mask_keeps_the_error_name() {
    let syntax = |m: &str| Outcome::error("SyntaxError", m);
    assert_eq!(
        mask_syntax_error("f", &syntax("V8 text")),
        mask_syntax_error("f", &syntax("serde text"))
    );
    assert_ne!(
        mask_syntax_error("f", &syntax("x")),
        mask_syntax_error("f", &Outcome::error("TypeError", "x"))
    );
    let output = Outcome::Output(json!(1));
    assert_eq!(mask_syntax_error("f", &output), output);
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

fn same_as_typescript(function: &str, scenario: Value) -> Result<(), TestCaseError> {
    // Generated objects take the key order JavaScript gives them, as stored
    // profiles always have.
    let input = [into_ecmascript_order(scenario)];
    let expected = mask_syntax_error(function, &ask(function, &input));
    let actual = mask_syntax_error(function, &call(function, &input));
    match (&expected, &actual) {
        (Outcome::Output(e), Outcome::Output(a)) => {
            exact_eq(e, a).map_err(|m| TestCaseError::fail(format!("{function} {}: {m}", input[0])))
        }
        _ if expected == actual => Ok(()),
        _ => Err(TestCaseError::fail(format!(
            "{function} {}: expected {expected:?}, got {actual:?}",
            input[0]
        ))),
    }
}

/// Name pieces that reach collisions, case folding and file name sanitizing.
const NAME_PIECES: &[&str] = &[
    "Invoice",
    "INVOICE",
    "invoice",
    " (Copy)",
    " (Copy 2)",
    " (copy)",
    " (1)",
    " (2)",
    "İ",
    "i̇",
    "Σ",
    "σ",
    "ς",
    "ΟΔΟΣ",
    "ß",
    "SS",
    "📦",
    "/",
    "São",
    "_",
    "-",
    " ",
    "",
];

fn name_text() -> impl Strategy<Value = String> {
    prop::collection::vec(prop::sample::select(NAME_PIECES), 0..4).prop_map(|p| p.concat())
}

fn name_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        8 => name_text().prop_map(Value::String),
        1 => (-5i32..5).prop_map(|n| json!(n)),
        1 => Just(json!(true)),
        1 => Just(json!(["a", 1])),
    ]
}

/// Finite numbers JSON carries exactly, without negative zero.
fn number_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        any::<f64>()
            .prop_filter("finite", |n| n.is_finite())
            .prop_map(|n| if n == 0.0 { json!(0) } else { json!(n) }),
        (-1000i64..1000).prop_map(|n| json!(n)),
        prop::sample::select(vec![0.1, 16.0, 1e21, 1e-7, 36.3, 2.5e-300]).prop_map(|n| json!(n)),
    ]
}

fn leaf() -> impl Strategy<Value = Value> {
    prop_oneof![
        Just(Value::Null),
        any::<bool>().prop_map(Value::Bool),
        number_value(),
        name_text().prop_map(Value::String),
        "[a-z\\\\\"\\n\\t\u{1}\u{2028}é]{0,6}".prop_map(Value::String),
    ]
}

const KEYS: &[&str] = &[
    "zeta",
    "2",
    "10",
    "x",
    "__proto__",
    "fields",
    "version",
    "createdAt",
    "note",
];

fn json_tree() -> impl Strategy<Value = Value> {
    leaf().prop_recursive(3, 12, 4, |inner| {
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..4).prop_map(Value::Array),
            prop::collection::vec((prop::sample::select(KEYS), inner), 0..4).prop_map(|pairs| {
                Value::Object(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            }),
        ]
    })
}

/// A profile as the application stores it, with a few extra keys.
fn stored_profile(id: String) -> impl Strategy<Value = Value> {
    (
        name_value(),
        prop::collection::vec((prop::sample::select(KEYS), json_tree()), 0..3),
    )
        .prop_map(move |(name, extra)| {
            let mut map = Map::new();
            map.insert("id".into(), json!(id));
            map.insert("name".into(), name);
            map.insert("version".into(), json!(1));
            map.insert("updatedAt".into(), json!("2026-01-02T03:04:05.006Z"));
            for (key, value) in extra {
                if key != "fields" {
                    map.insert(key.to_string(), value);
                }
            }
            map.insert("fields".into(), json!([]));
            map.insert("destinationMappings".into(), json!([]));
            Value::Object(map)
        })
}

fn store_strategy() -> impl Strategy<Value = Vec<Value>> {
    (0usize..5).prop_flat_map(|count| {
        let profiles: Vec<_> = (0..count)
            .map(|i| {
                let id = if i == 2 {
                    "builtin-cmr-standard".to_string()
                } else {
                    format!("profile-{i}")
                };
                stored_profile(id)
            })
            .collect();
        profiles
    })
}

fn clock_strategy() -> impl Strategy<Value = Value> {
    (0u64..253_402_300_799_000, 0u32..3)
        .prop_map(|(start, step)| json!({ "start": start, "step": step }))
}

fn random_strategy() -> impl Strategy<Value = Vec<Value>> {
    prop::collection::vec(
        prop_oneof![
            (0.0f64..1.0).prop_map(|n| json!(n)),
            prop::sample::select(vec![0.5, 0.25, 0.123, 0.000001, 0.9999999999999999])
                .prop_map(|n| json!(n)),
            Just(json!(0)),
        ],
        2,
    )
}

fn scenario(stored: Vec<Value>, clock: Value, random: Vec<Value>, args: Vec<Value>) -> Value {
    json!({ "stored": stored, "clock": clock, "random": random, "args": args })
}

/// A `.dmap` text: usually a profile-like object in any key order, sometimes
/// broken or of another shape.
fn dmap_text() -> impl Strategy<Value = String> {
    let object = (
        prop::option::of(name_value()),
        prop::option::of(prop_oneof![3 => Just(json!([])), 1 => json_tree()]),
        prop::option::of(prop_oneof![3 => Just(json!([])), 1 => json_tree()]),
        prop::collection::vec((prop::sample::select(KEYS), json_tree()), 0..3),
        any::<bool>(),
    )
        .prop_map(|(name, fields, mappings, extra, extra_first)| {
            let mut pairs: Vec<(String, Value)> = Vec::new();
            let extras: Vec<(String, Value)> =
                extra.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
            if extra_first {
                pairs.extend(extras.clone());
            }
            if let Some(name) = name {
                pairs.push(("name".into(), name));
            }
            if let Some(fields) = fields {
                pairs.push(("fields".into(), fields));
            }
            if let Some(mappings) = mappings {
                pairs.push(("destinationMappings".into(), mappings));
            }
            if !extra_first {
                pairs.extend(extras);
            }
            // Written by hand so duplicate keys and key order reach the parser.
            let body: Vec<String> = pairs
                .iter()
                .map(|(k, v)| format!("{}: {}", json!(k), v))
                .collect();
            format!("{{{}}}", body.join(", "))
        });
    prop_oneof![
        8 => object,
        1 => json_tree().prop_map(|v| v.to_string()),
        1 => "[\\[\\]{}\":, a-z0-9]{0,8}",
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn create_matches_typescript(name in prop::option::of(name_value()), clock in clock_strategy(), random in random_strategy()) {
        let args = name.into_iter().collect();
        same_as_typescript("createEmptyProfile", scenario(vec![], clock, random, args))?;
    }

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn listing_and_finding_match_typescript(stored in store_strategy(), pick in 0usize..6) {
        let id = json!(format!("profile-{pick}"));
        same_as_typescript("getAllProfiles", scenario(stored.clone(), json!({"start": 0, "step": 1}), vec![], vec![]))?;
        same_as_typescript("getProfileById", scenario(stored, json!({"start": 0, "step": 1}), vec![], vec![id]))?;
    }

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn save_and_delete_match_typescript(stored in store_strategy(), pick in 0usize..6, profile in stored_profile("profile-1".into()), clock in clock_strategy()) {
        let mut profile = profile;
        profile["id"] = json!(format!("profile-{pick}"));
        same_as_typescript("saveProfile", scenario(stored.clone(), clock.clone(), vec![], vec![profile]))?;
        same_as_typescript("deleteProfile", scenario(stored, clock, vec![], vec![json!(format!("profile-{pick}"))]))?;
    }

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn duplicate_matches_typescript(stored in store_strategy(), pick in 0usize..6, clock in clock_strategy(), random in random_strategy()) {
        same_as_typescript("duplicateProfile", scenario(stored, clock, random, vec![json!(format!("profile-{pick}"))]))?;
    }

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn import_matches_typescript(stored in store_strategy(), text in dmap_text(), clock in clock_strategy(), random in random_strategy()) {
        same_as_typescript("importProfileFromDocMapper", scenario(stored, clock, random, vec![json!(text)]))?;
    }

    #[test]
    #[ignore = "needs the Node.js oracle; run by the parity job"]
    fn export_matches_typescript(profile in stored_profile("p".into()), tree in json_tree()) {
        let mut profile = profile;
        profile["extra"] = tree;
        same_as_typescript("exportProfileAsDocMapper", scenario(vec![], json!({"start": 0, "step": 1}), vec![], vec![profile]))?;
    }
}
