//! The harness self-test module: Rust twins of `parity/selftest/harness.ts`,
//! checked against its fixtures and fuzzed against the TypeScript oracle.

use docmapper_parity::fixture::Outcome;
use docmapper_parity::oracle::Oracle;
use docmapper_parity::runner::assert_module;
use proptest::prelude::*;
use serde_json::{json, Map, Value};
use std::sync::{Mutex, OnceLock};

const MODULE: &str = "harness";

fn describe(value: f64, label: &str) -> Value {
    let mut object = Map::new();
    object.insert("label".into(), json!(label));
    object.insert("half".into(), json!(value / 2.0));
    object.insert("shifted".into(), json!(value + 0.1));
    let sign = if value < 0.0 {
        "negative"
    } else {
        "non-negative"
    };
    object.insert("sign".into(), json!(sign));
    Value::Object(object)
}

fn measure(text: &str) -> Outcome {
    if text.is_empty() {
        return Outcome::error("RangeError", "text is empty");
    }
    Outcome::Output(json!({
        "length": text.encode_utf16().count(),
        "upper": text.to_uppercase(),
    }))
}

fn call(function: &str, input: &[Value]) -> Outcome {
    match (function, input) {
        ("describe", [Value::Number(value), Value::String(label)]) => {
            Outcome::Output(describe(value.as_f64().unwrap_or(f64::NAN), label))
        }
        ("measure", [Value::String(text)]) => measure(text),
        _ => panic!("no Rust twin for {MODULE}.{function} with input {input:?}"),
    }
}

#[test]
fn harness_fixtures_match() {
    assert_module(MODULE, call);
}

/// One oracle process shared by every test of this binary.
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

#[test]
#[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
fn oracle_answers_outputs_and_errors() {
    assert_eq!(
        ask("measure", &[json!("ab")]),
        Outcome::Output(json!({"length": 2, "upper": "AB"}))
    );
    assert_eq!(
        ask("measure", &[json!("")]),
        Outcome::error("RangeError", "text is empty")
    );
    let mut oracle = Oracle::start_default().unwrap_or_else(|e| panic!("{e}"));
    let failure = oracle.call("nope", "x", &[]).expect_err("unknown module");
    assert!(failure.to_string().contains("unknown module 'nope'"));
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn describe_matches_typescript(scaled in -1_000_000_000i64..1_000_000_000, label in "[a-z ]{0,12}") {
        let value = scaled as f64 / 64.0;
        let input = [json!(value), json!(label)];
        let Outcome::Output(expected) = ask("describe", &input) else { panic!("unexpected error") };
        prop_assert_eq!(docmapper_parity::compare::exact_eq(&expected, &describe(value, &label)), Ok(()));
    }

    #[test]
    #[ignore = "needs Node.js and the frontend dependencies; run by the parity job"]
    fn measure_matches_typescript(text in "[ -~]{0,24}") {
        let input = [json!(text)];
        prop_assert_eq!(ask("measure", &input), measure(&text));
    }
}
