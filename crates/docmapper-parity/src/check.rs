//! The id checker: per module of the registry, the committed fixture ids must
//! equal the ids of the TypeScript run, and, for ported modules, the ids of
//! the Rust run. A fixture folder that is not in the registry is an error too.

use crate::fixture::fixture_ids;
use crate::registry::{read_registry, ModuleState};
use std::collections::BTreeSet;
use std::fmt;
use std::fs;
use std::io::ErrorKind;
use std::path::Path;

/// A source of case ids.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    /// The committed files in `parity/fixtures`.
    Fixtures,
    /// The TypeScript characterization run.
    TypeScript,
    /// The Rust parity run.
    Rust,
}

impl Side {
    /// Folder of the side's run records under `target/parity`.
    pub fn folder(self) -> &'static str {
        match self {
            Side::Fixtures => "fixtures",
            Side::TypeScript => "ts",
            Side::Rust => "rust",
        }
    }
}

impl fmt::Display for Side {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Side::Fixtures => "committed fixtures",
            Side::TypeScript => "TypeScript run",
            Side::Rust => "Rust run",
        })
    }
}

/// One reason the check fails.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Problem {
    /// A case id present on some side is missing from `missing_from`.
    MissingId {
        module: String,
        id: String,
        missing_from: Side,
    },
    /// A side that must have run for this module left no run record.
    NoRunRecord { module: String, side: Side },
    /// A registered module has no fixtures.
    NoFixtures { module: String },
    /// A fixture folder whose module is not in the registry.
    Unregistered { module: String },
    /// A file could not be read.
    Unreadable { reason: String },
}

impl fmt::Display for Problem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Problem::MissingId {
                module,
                id,
                missing_from,
            } => write!(f, "{module}/{id}: missing from the {missing_from}"),
            Problem::NoRunRecord { module, side } => {
                write!(
                    f,
                    "{module}: no {side} record; run that side's parity tests first"
                )
            }
            Problem::NoFixtures { module } => write!(f, "{module}: registered but has no fixtures"),
            Problem::Unregistered { module } => {
                write!(
                    f,
                    "{module}: has fixtures but is not in parity/modules.json"
                )
            }
            Problem::Unreadable { reason } => f.write_str(reason),
        }
    }
}

/// The ids each side produced for one module (`None`: no run record).
#[derive(Debug, Clone, Default)]
pub struct ModuleIds {
    pub fixtures: BTreeSet<String>,
    pub typescript: Option<BTreeSet<String>>,
    pub rust: Option<BTreeSet<String>>,
}

/// Compares the ids of one module. Pure: the sides are given.
pub fn compare_module(module: &str, state: ModuleState, ids: &ModuleIds) -> Vec<Problem> {
    let mut problems = Vec::new();
    if ids.fixtures.is_empty() {
        problems.push(Problem::NoFixtures {
            module: module.into(),
        });
    }
    let mut sides: Vec<(Side, &BTreeSet<String>)> = vec![(Side::Fixtures, &ids.fixtures)];
    let required = match state {
        ModuleState::Characterized => vec![(Side::TypeScript, &ids.typescript)],
        ModuleState::Ported => vec![(Side::TypeScript, &ids.typescript), (Side::Rust, &ids.rust)],
    };
    for (side, record) in required {
        match record {
            Some(set) => sides.push((side, set)),
            None => problems.push(Problem::NoRunRecord {
                module: module.into(),
                side,
            }),
        }
    }
    let all: BTreeSet<&String> = sides.iter().flat_map(|(_, set)| set.iter()).collect();
    for id in all {
        for (side, set) in &sides {
            if !set.contains(id) {
                problems.push(Problem::MissingId {
                    module: module.into(),
                    id: id.clone(),
                    missing_from: *side,
                });
            }
        }
    }
    problems
}

fn read_run_record(
    root: &Path,
    side: Side,
    module: &str,
) -> Result<Option<BTreeSet<String>>, String> {
    let path = crate::run_record_path(root, side, module);
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(
            text.lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .map(String::from)
                .collect(),
        )),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: cannot read: {e}", path.display())),
    }
}

fn fixture_folders(root: &Path) -> Result<Vec<String>, String> {
    let dir = root.join("parity").join("fixtures");
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(&dir).map_err(|e| format!("{}: cannot list: {e}", dir.display()))?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("{}: cannot list: {e}", dir.display()))?;
        if entry.path().is_dir() {
            names.push(entry.file_name().to_string_lossy().into_owned());
        }
    }
    names.sort();
    Ok(names)
}

/// Checks every module of the repository at `root`. An empty list means the check passes.
pub fn check_repository(root: &Path) -> Vec<Problem> {
    let unreadable = |reason: String| vec![Problem::Unreadable { reason }];
    let registry = match read_registry(root) {
        Ok(registry) => registry,
        Err(reason) => return unreadable(reason),
    };
    let folders = match fixture_folders(root) {
        Ok(folders) => folders,
        Err(reason) => return unreadable(reason),
    };
    let mut problems: Vec<Problem> = folders
        .into_iter()
        .filter(|name| !registry.contains_key(name))
        .map(|module| Problem::Unregistered { module })
        .collect();
    for (module, state) in &registry {
        let ids = (|| -> Result<ModuleIds, String> {
            Ok(ModuleIds {
                fixtures: fixture_ids(root, module)
                    .map_err(|e| e.to_string())?
                    .into_iter()
                    .collect(),
                typescript: read_run_record(root, Side::TypeScript, module)?,
                rust: read_run_record(root, Side::Rust, module)?,
            })
        })();
        match ids {
            Ok(ids) => problems.extend(compare_module(module, *state, &ids)),
            Err(reason) => problems.push(Problem::Unreadable { reason }),
        }
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(ids: &[&str]) -> BTreeSet<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    fn missing(id: &str, side: Side) -> Problem {
        Problem::MissingId {
            module: "m".into(),
            id: id.into(),
            missing_from: side,
        }
    }

    #[test]
    fn passes_when_every_side_agrees() {
        let ids = ModuleIds {
            fixtures: set(&["a", "b"]),
            typescript: Some(set(&["a", "b"])),
            rust: Some(set(&["a", "b"])),
        };
        assert!(compare_module("m", ModuleState::Ported, &ids).is_empty());
    }

    #[test]
    fn fixture_without_typescript_case() {
        let ids = ModuleIds {
            fixtures: set(&["a", "stale"]),
            typescript: Some(set(&["a"])),
            rust: None,
        };
        assert_eq!(
            compare_module("m", ModuleState::Characterized, &ids),
            vec![missing("stale", Side::TypeScript)]
        );
    }

    #[test]
    fn typescript_case_without_fixture() {
        let ids = ModuleIds {
            fixtures: set(&["a"]),
            typescript: Some(set(&["a", "new"])),
            rust: None,
        };
        assert_eq!(
            compare_module("m", ModuleState::Characterized, &ids),
            vec![missing("new", Side::Fixtures)]
        );
    }

    #[test]
    fn ported_module_fixture_skipped_by_rust() {
        let ids = ModuleIds {
            fixtures: set(&["a", "b"]),
            typescript: Some(set(&["a", "b"])),
            rust: Some(set(&["a"])),
        };
        assert_eq!(
            compare_module("m", ModuleState::Ported, &ids),
            vec![missing("b", Side::Rust)]
        );
    }

    #[test]
    fn rust_id_without_fixture() {
        let ids = ModuleIds {
            fixtures: set(&["a"]),
            typescript: Some(set(&["a"])),
            rust: Some(set(&["a", "ghost"])),
        };
        let problems = compare_module("m", ModuleState::Ported, &ids);
        assert_eq!(
            problems,
            vec![
                missing("ghost", Side::Fixtures),
                missing("ghost", Side::TypeScript)
            ]
        );
    }

    #[test]
    fn characterized_module_ignores_the_rust_side() {
        let ids = ModuleIds {
            fixtures: set(&["a"]),
            typescript: Some(set(&["a"])),
            rust: Some(set(&[])),
        };
        assert!(compare_module("m", ModuleState::Characterized, &ids).is_empty());
    }

    #[test]
    fn missing_run_records_and_fixtures_are_problems() {
        let problems = compare_module("m", ModuleState::Ported, &ModuleIds::default());
        assert_eq!(
            problems,
            vec![
                Problem::NoFixtures { module: "m".into() },
                Problem::NoRunRecord {
                    module: "m".into(),
                    side: Side::TypeScript
                },
                Problem::NoRunRecord {
                    module: "m".into(),
                    side: Side::Rust
                },
            ]
        );
    }

    #[test]
    fn checks_a_repository_on_disk() {
        let root = std::env::temp_dir().join(format!("parity-check-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("parity/fixtures/m")).expect("dir");
        fs::create_dir_all(root.join("parity/fixtures/orphan")).expect("dir");
        fs::create_dir_all(root.join("target/parity/ts")).expect("dir");
        fs::write(
            root.join("parity/modules.json"),
            r#"{"modules":{"m":"characterized"}}"#,
        )
        .expect("write");
        fs::write(root.join("parity/fixtures/m/a.json"), "{}").expect("write");
        fs::write(root.join("target/parity/ts/m.ids"), "a\nb\n").expect("write");

        let problems = check_repository(&root);
        assert_eq!(
            problems,
            vec![
                Problem::Unregistered {
                    module: "orphan".into()
                },
                missing("b", Side::Fixtures),
            ]
        );
        assert_eq!(
            problems[1].to_string(),
            "m/b: missing from the committed fixtures"
        );
        fs::remove_dir_all(&root).expect("clean up");
    }

    #[test]
    fn unreadable_registry_is_reported() {
        let root = std::env::temp_dir().join(format!("parity-check-empty-{}", std::process::id()));
        let problems = check_repository(&root);
        assert!(matches!(problems.as_slice(), [Problem::Unreadable { .. }]));
    }
}
