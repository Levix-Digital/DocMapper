# Quickstart: Interface wired to the Rust profile store

```bash
cargo test -p docmapper-desktop          # profile commands
npm test --prefix frontend               # profile service and shadow comparison
npm run tauri --prefix frontend -- dev   # desktop window on the local database
```

The database is `docmapper.sqlite3` in the application data directory (`digital.levix.docmapper`): `~/.local/share/` on Linux, `~/Library/Application Support/` on macOS, `%APPDATA%` on Windows.

Shadow mode: in the window's developer console run `localStorage.setItem('docmapper_profile_shadow', '1')` and reload; differences are logged with the prefix `[profiles shadow]`. Remove the key to turn it off.
