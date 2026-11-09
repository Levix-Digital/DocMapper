//! The module registry (`parity/modules.json`): which modules are under
//! migration and whether Rust must already pass their fixtures.

use crate::fixture::is_valid_id;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

/// Migration state of a module.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleState {
    /// TypeScript cases and fixtures exist; the Rust side is not required yet.
    Characterized,
    /// Rust tests must pass every fixture of the module.
    Ported,
}

/// Module name to state, sorted by name.
pub type Registry = BTreeMap<String, ModuleState>;

/// Parses the registry text.
pub fn parse_registry(text: &str) -> Result<Registry, String> {
    let value: Value = serde_json::from_str(text).map_err(|e| format!("invalid JSON: {e}"))?;
    let modules = value
        .get("modules")
        .and_then(Value::as_object)
        .ok_or("'modules' is missing or not an object")?;
    modules
        .iter()
        .map(|(name, state)| {
            if !is_valid_id(name) {
                return Err(format!("module name '{name}' is not a valid id"));
            }
            let state = match state.as_str() {
                Some("characterized") => ModuleState::Characterized,
                Some("ported") => ModuleState::Ported,
                _ => return Err(format!(
                    "module '{name}' has state {state}; expected \"characterized\" or \"ported\""
                )),
            };
            Ok((name.clone(), state))
        })
        .collect()
}

/// Reads `parity/modules.json` under `root`.
pub fn read_registry(root: &Path) -> Result<Registry, String> {
    let path = root.join(crate::REGISTRY_FILE);
    let text =
        fs::read_to_string(&path).map_err(|e| format!("{}: cannot read: {e}", path.display()))?;
    parse_registry(&text).map_err(|e| format!("{}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_states() {
        let registry =
            parse_registry(r#"{"modules":{"text":"ported","cmr":"characterized"}}"#).expect("ok");
        assert_eq!(registry["text"], ModuleState::Ported);
        assert_eq!(registry["cmr"], ModuleState::Characterized);
    }

    #[test]
    fn rejects_bad_registries() {
        assert!(parse_registry("{}")
            .expect_err("no modules")
            .contains("'modules'"));
        assert!(parse_registry(r#"{"modules":{"a":"done"}}"#)
            .expect_err("bad state")
            .contains("expected"));
        assert!(parse_registry(r#"{"modules":{"A":"ported"}}"#)
            .expect_err("bad name")
            .contains("not a valid id"));
    }
}
