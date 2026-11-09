//! DocMapper core: the domain and the ports it needs. It depends on no
//! framework or driver (`architecture.forbidden_core_imports`).

/// Version of the core crate, as set in the workspace manifest.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Returns the version of the core crate.
pub fn version() -> &'static str {
    VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_matches_the_workspace_manifest() {
        assert_eq!(version(), "0.1.0");
    }
}
