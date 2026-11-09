# Desktop commands

Commands the shell exposes to the interface (Tauri `invoke`).

| Command | Arguments | Returns | Errors |
|---|---|---|---|
| `core_version` | none | string: the `docmapper-core` crate version, for example `"0.1.0"` | none |

The interface does not call it yet in M0; it exists to prove the shell reaches the core and is covered by a Rust test.
