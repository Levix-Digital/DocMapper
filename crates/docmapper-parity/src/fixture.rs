//! The fixture format (`parity/fixture.schema.json`) and its reader.

use serde_json::{Map, Value};
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

/// What a TypeScript function did for an input.
#[derive(Debug, Clone, PartialEq)]
pub enum Outcome {
    /// The function returned this value.
    Output(Value),
    /// The function threw an error with this name and message.
    Error { name: String, message: String },
}

impl Outcome {
    /// Shorthand for an error outcome.
    pub fn error(name: impl Into<String>, message: impl Into<String>) -> Self {
        Outcome::Error {
            name: name.into(),
            message: message.into(),
        }
    }
}

/// One case of one module function.
#[derive(Debug, Clone, PartialEq)]
pub struct Fixture {
    pub id: String,
    pub module: String,
    pub function: String,
    pub input: Vec<Value>,
    pub outcome: Outcome,
}

/// A fixture file that cannot be used, with the file and the reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixtureError {
    pub path: PathBuf,
    pub reason: String,
}

impl fmt::Display for FixtureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.path.display(), self.reason)
    }
}

impl std::error::Error for FixtureError {}

const FIELDS: [&str; 6] = ["id", "module", "function", "input", "output", "error"];

/// True when `name` is a valid module or case id: lowercase letters, digits and `-`,
/// not starting with `-`.
pub fn is_valid_id(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn text_field(object: &Map<String, Value>, field: &str) -> Result<String, String> {
    match object.get(field) {
        Some(Value::String(text)) => Ok(text.clone()),
        Some(_) => Err(format!("'{field}' is not a string")),
        None => Err(format!("'{field}' is missing")),
    }
}

fn parse_outcome(object: &Map<String, Value>) -> Result<Outcome, String> {
    match (object.get("output"), object.get("error")) {
        (Some(output), None) => Ok(Outcome::Output(output.clone())),
        (None, Some(Value::Object(error))) => {
            if let Some(extra) = error.keys().find(|k| *k != "name" && *k != "message") {
                return Err(format!("'error' has an unknown field '{extra}'"));
            }
            Ok(Outcome::Error {
                name: text_field(error, "name").map_err(|e| format!("error {e}"))?,
                message: text_field(error, "message").map_err(|e| format!("error {e}"))?,
            })
        }
        (None, Some(_)) => Err("'error' is not an object".into()),
        (Some(_), Some(_)) => Err("has both 'output' and 'error'".into()),
        (None, None) => Err("has neither 'output' nor 'error'".into()),
    }
}

/// Parses and validates the text of a fixture file.
pub fn parse_fixture(text: &str) -> Result<Fixture, String> {
    let value: Value = serde_json::from_str(text).map_err(|e| format!("invalid JSON: {e}"))?;
    let Value::Object(object) = value else {
        return Err("is not a JSON object".into());
    };
    if let Some(extra) = object.keys().find(|k| !FIELDS.contains(&k.as_str())) {
        return Err(format!("unknown field '{extra}'"));
    }
    let id = text_field(&object, "id")?;
    let module = text_field(&object, "module")?;
    for (field, name) in [("id", &id), ("module", &module)] {
        if !is_valid_id(name) {
            return Err(format!("'{field}' '{name}' is not a valid id"));
        }
    }
    let function = text_field(&object, "function")?;
    if function.is_empty() {
        return Err("'function' is empty".into());
    }
    let input = match object.get("input") {
        Some(Value::Array(items)) => items.clone(),
        Some(_) => return Err("'input' is not an array".into()),
        None => return Err("'input' is missing".into()),
    };
    Ok(Fixture {
        id,
        module,
        function,
        input,
        outcome: parse_outcome(&object)?,
    })
}

/// Reads one fixture file and checks that its id and module match its path.
pub fn read_fixture(path: &Path) -> Result<Fixture, FixtureError> {
    let fail = |reason: String| FixtureError {
        path: path.to_path_buf(),
        reason,
    };
    let text = fs::read_to_string(path).map_err(|e| fail(format!("cannot read: {e}")))?;
    let fixture = parse_fixture(&text).map_err(fail)?;
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or_default();
    if fixture.id != stem {
        return Err(fail(format!(
            "id '{}' does not match the file name",
            fixture.id
        )));
    }
    let folder = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|s| s.to_str())
        .unwrap_or_default();
    if fixture.module != folder {
        return Err(fail(format!(
            "module '{}' does not match the folder '{folder}'",
            fixture.module
        )));
    }
    Ok(fixture)
}

/// Folder of a module's fixtures.
pub fn module_dir(root: &Path, module: &str) -> PathBuf {
    root.join("parity").join("fixtures").join(module)
}

/// Ids of the fixture files of a module (file names without `.json`), sorted.
/// A missing folder has no fixtures.
pub fn fixture_ids(root: &Path, module: &str) -> Result<Vec<String>, FixtureError> {
    let dir = module_dir(root, module);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(&dir).map_err(|e| FixtureError {
        path: dir.clone(),
        reason: format!("cannot list: {e}"),
    })?;
    let mut ids = Vec::new();
    for entry in entries {
        let path = entry
            .map_err(|e| FixtureError {
                path: dir.clone(),
                reason: format!("cannot list: {e}"),
            })?
            .path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                ids.push(stem.to_string());
            }
        }
    }
    ids.sort();
    Ok(ids)
}

/// Reads every fixture of a module, sorted by id.
pub fn load_module(root: &Path, module: &str) -> Result<Vec<Fixture>, FixtureError> {
    let dir = module_dir(root, module);
    fixture_ids(root, module)?
        .iter()
        .map(|id| read_fixture(&dir.join(format!("{id}.json"))))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const VALID: &str =
        r#"{"id":"a-1","module":"m","function":"f","input":[1],"output":{"b":1,"a":2}}"#;

    #[test]
    fn parses_an_output_fixture() {
        let fixture = parse_fixture(VALID).expect("valid fixture");
        assert_eq!(fixture.id, "a-1");
        assert_eq!(fixture.input, vec![json!(1)]);
        assert_eq!(fixture.outcome, Outcome::Output(json!({"b": 1, "a": 2})));
    }

    #[test]
    fn parses_an_error_fixture() {
        let text = r#"{"id":"e","module":"m","function":"f","input":[],"error":{"name":"RangeError","message":"no"}}"#;
        let fixture = parse_fixture(text).expect("valid fixture");
        assert_eq!(fixture.outcome, Outcome::error("RangeError", "no"));
    }

    #[test]
    fn rejects_invalid_fixtures_with_the_reason() {
        let cases = [
            ("{", "invalid JSON"),
            ("[]", "not a JSON object"),
            (
                r#"{"module":"m","function":"f","input":[],"output":1}"#,
                "'id' is missing",
            ),
            (
                r#"{"id":"A","module":"m","function":"f","input":[],"output":1}"#,
                "not a valid id",
            ),
            (
                r#"{"id":"a","module":"m","function":"","input":[],"output":1}"#,
                "'function' is empty",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":{},"output":1}"#,
                "'input' is not an array",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":[]}"#,
                "neither",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":[],"output":1,"error":{"name":"E","message":"m"}}"#,
                "both",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":[],"error":"x"}"#,
                "'error' is not an object",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":[],"error":{"name":"E"}}"#,
                "error 'message' is missing",
            ),
            (
                r#"{"id":"a","module":"m","function":"f","input":[],"output":1,"extra":2}"#,
                "unknown field 'extra'",
            ),
        ];
        for (text, reason) in cases {
            let error = parse_fixture(text).expect_err(text);
            assert!(
                error.contains(reason),
                "{text}: got '{error}', expected '{reason}'"
            );
        }
    }

    #[test]
    fn validates_ids() {
        assert!(is_valid_id("text-utils"));
        assert!(is_valid_id("0case"));
        assert!(!is_valid_id(""));
        assert!(!is_valid_id("-a"));
        assert!(!is_valid_id("Upper"));
        assert!(!is_valid_id("with_underscore"));
    }

    #[test]
    fn reads_files_and_checks_their_place() {
        let root = std::env::temp_dir().join(format!("parity-fixture-{}", std::process::id()));
        let dir = module_dir(&root, "m");
        fs::create_dir_all(&dir).expect("create dir");
        fs::write(dir.join("a-1.json"), VALID).expect("write");
        fs::write(dir.join("other.json"), VALID).expect("write");
        fs::write(dir.join("notes.txt"), "ignored").expect("write");

        assert_eq!(fixture_ids(&root, "m").expect("ids"), vec!["a-1", "other"]);
        assert!(read_fixture(&dir.join("a-1.json")).is_ok());
        let error = load_module(&root, "m").expect_err("id mismatch");
        assert!(error.to_string().contains("other.json"));
        assert!(error.reason.contains("does not match the file name"));
        assert!(fixture_ids(&root, "absent").expect("ids").is_empty());
        fs::remove_dir_all(&root).expect("clean up");
    }
}
