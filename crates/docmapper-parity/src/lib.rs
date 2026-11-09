//! Parity harness of the TypeScript to Rust migration (ADR-0003).
//!
//! Characterization tests in TypeScript write fixtures to
//! `parity/fixtures/<module>/<case>.json`; Rust tests run them with
//! [`runner::assert_module`], fuzz against the TypeScript code through
//! [`oracle::Oracle`], and `parity-check` fails when a case id exists on one
//! side only. This crate is a development tool: the product never depends on it.

pub mod check;
pub mod compare;
pub mod fixture;
pub mod oracle;
pub mod registry;
pub mod runner;

use std::path::{Path, PathBuf};

/// File that marks the repository root for the harness.
pub const REGISTRY_FILE: &str = "parity/modules.json";

/// Finds the repository root: the first ancestor of `start` holding the module registry.
pub fn find_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|dir| dir.join(REGISTRY_FILE).is_file())
        .map(Path::to_path_buf)
}

/// The repository root, found from this crate's manifest directory.
///
/// # Panics
/// When the crate is not inside the repository (the registry is missing).
pub fn workspace_root() -> PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    find_root(manifest_dir).unwrap_or_else(|| {
        panic!(
            "no {REGISTRY_FILE} above {}: the parity harness must run inside the repository",
            manifest_dir.display()
        )
    })
}

/// Path of the run record one side writes for a module.
pub fn run_record_path(root: &Path, side: check::Side, module: &str) -> PathBuf {
    root.join("target")
        .join("parity")
        .join(side.folder())
        .join(format!("{module}.ids"))
}
