//! Commands the interface calls with `invoke` (contracts in
//! `specs/006-m0-foundation/contracts/desktop-commands.md`). Each one is a thin
//! handler over a core call.

/// Returns the version of the DocMapper core.
#[tauri::command]
pub fn core_version() -> &'static str {
    docmapper_core::version()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_version_returns_the_core_version() {
        assert_eq!(core_version(), docmapper_core::VERSION);
    }
}
