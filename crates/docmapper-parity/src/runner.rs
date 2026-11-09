//! Runs every fixture of a module against a Rust function and records the
//! ids it checked (the Rust run record read by `parity-check`).

use crate::check::Side;
use crate::compare::exact_eq;
use crate::fixture::{load_module, Fixture, Outcome};
use serde_json::Value;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

/// A fixture whose Rust outcome differs from the TypeScript one.
#[derive(Debug, Clone, PartialEq)]
pub struct Failure {
    pub id: String,
    pub reason: String,
}

/// The result of running a module's fixtures.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Report {
    /// Ids of every fixture that was run, sorted.
    pub checked: Vec<String>,
    pub failures: Vec<Failure>,
}

fn compare_outcomes(expected: &Outcome, actual: &Outcome) -> Result<(), String> {
    match (expected, actual) {
        (Outcome::Output(e), Outcome::Output(a)) => exact_eq(e, a).map_err(|m| m.to_string()),
        (Outcome::Error { .. }, _) | (_, Outcome::Error { .. }) if expected == actual => Ok(()),
        _ => Err(format!(
            "expected {}, got {}",
            describe(expected),
            describe(actual)
        )),
    }
}

fn describe(outcome: &Outcome) -> String {
    match outcome {
        Outcome::Output(value) => format!("output {value}"),
        Outcome::Error { name, message } => format!("error {name}: {message}"),
    }
}

/// Runs `fixtures` through `run` (which gets the function name and the input).
pub fn run_fixtures<F>(fixtures: &[Fixture], mut run: F) -> Report
where
    F: FnMut(&str, &[Value]) -> Outcome,
{
    let mut report = Report::default();
    for fixture in fixtures {
        report.checked.push(fixture.id.clone());
        let actual = run(&fixture.function, &fixture.input);
        if let Err(reason) = compare_outcomes(&fixture.outcome, &actual) {
            report.failures.push(Failure {
                id: fixture.id.clone(),
                reason,
            });
        }
    }
    report.checked.sort();
    report
}

/// Writes the Rust run record of a module.
pub fn write_run_record(root: &Path, module: &str, ids: &[String]) -> std::io::Result<()> {
    let path = crate::run_record_path(root, Side::Rust, module);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut text = String::new();
    for id in ids {
        let _ = writeln!(text, "{id}");
    }
    fs::write(path, text)
}

/// Runs every fixture of `module` against `run`, writes the Rust run record and
/// panics with every failure. Use it as the body of a module's parity test.
///
/// # Panics
/// When a fixture cannot be read, the run record cannot be written, or any
/// fixture's outcome differs.
pub fn assert_module<F>(module: &str, run: F)
where
    F: FnMut(&str, &[Value]) -> Outcome,
{
    let root = crate::workspace_root();
    let fixtures = load_module(&root, module).unwrap_or_else(|e| panic!("{e}"));
    assert!(
        !fixtures.is_empty(),
        "module '{module}' has no fixtures in parity/fixtures/{module}"
    );
    let report = run_fixtures(&fixtures, run);
    write_run_record(&root, module, &report.checked)
        .unwrap_or_else(|e| panic!("cannot write the Rust run record of '{module}': {e}"));
    if !report.failures.is_empty() {
        let lines: Vec<String> = report
            .failures
            .iter()
            .map(|f| format!("  {module}/{}: {}", f.id, f.reason))
            .collect();
        panic!(
            "{} of {} fixtures of '{module}' differ:\n{}",
            report.failures.len(),
            report.checked.len(),
            lines.join("\n")
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture(id: &str, outcome: Outcome) -> Fixture {
        Fixture {
            id: id.into(),
            module: "m".into(),
            function: "double".into(),
            input: vec![json!(2)],
            outcome,
        }
    }

    #[test]
    fn passes_matching_outcomes_and_lists_checked_ids() {
        let fixtures = [
            fixture("b", Outcome::Output(json!(4))),
            fixture("a", Outcome::error("RangeError", "no")),
        ];
        let report = run_fixtures(&fixtures, |_, _| Outcome::Output(json!(4)));
        assert_eq!(report.checked, vec!["a", "b"]);
        assert_eq!(report.failures.len(), 1);
        assert_eq!(report.failures[0].id, "a");
        assert_eq!(
            report.failures[0].reason,
            "expected error RangeError: no, got output 4"
        );
    }

    #[test]
    fn errors_must_match_name_and_message() {
        let fixtures = [fixture("e", Outcome::error("RangeError", "no"))];
        let same = run_fixtures(&fixtures, |_, _| Outcome::error("RangeError", "no"));
        assert!(same.failures.is_empty());
        let other = run_fixtures(&fixtures, |_, _| Outcome::error("TypeError", "no"));
        assert_eq!(other.failures.len(), 1);
    }

    #[test]
    fn output_mismatch_reports_the_path() {
        let fixtures = [fixture("o", Outcome::Output(json!({"a": 1})))];
        let report = run_fixtures(&fixtures, |_, _| Outcome::Output(json!({"a": 2})));
        assert_eq!(report.failures[0].reason, "at $.a: expected 1, got 2");
    }

    #[test]
    fn passes_function_name_and_input() {
        let fixtures = [fixture("x", Outcome::Output(json!(4)))];
        let mut seen = Vec::new();
        run_fixtures(&fixtures, |function, input| {
            seen.push((function.to_string(), input.to_vec()));
            Outcome::Output(json!(4))
        });
        assert_eq!(seen, vec![("double".to_string(), vec![json!(2)])]);
    }
}
