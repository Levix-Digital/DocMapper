---
title: Desktop Shell
summary: 'Cargo workspace and the Tauri 2 shell: composition root of the desktop surface, its commands, permissions and how it loads the interface.'
code: [Cargo.toml, rust-toolchain.toml, crates/docmapper-core, crates/docmapper-desktop, frontend/scripts/tauri.mjs]
---

# Desktop Shell

Cargo workspace and the Tauri 2 shell: composition root of the desktop surface, its commands, permissions and how it loads the interface.

## Responsibilities

Opens the interface in a desktop window, wires the adapters to the core and exposes the core use cases to the interface as commands. It holds no business rules (ADR-0002).

## Structure

- `Cargo.toml`: the workspace (`crates/*`), shared package metadata and the product version (the only version file, `devops.version_files`); `rust-toolchain.toml` pins Rust 1.97.0 with rustfmt and clippy.
- `crates/docmapper-core`: the domain. It depends on nothing outside plain libraries; the crates in `architecture.forbidden_core_imports` are refused by `check_design`.
- `crates/docmapper-desktop`: `src/lib.rs` (builds the Tauri application, opens the profile database and registers the commands), `src/commands.rs` (one thin handler per command), `src/profiles.rs` (the profile state over the local database, command errors and the save target of exports), `src/main.rs` (entry point), `tauri.conf.json`, `capabilities/default.json`, `icons/` (generated from `icons/source.png` with `npm run tauri -- icon`).
- `frontend/scripts/tauri.mjs`: runs the Tauri CLI from the frontend folder with `TAURI_APP_PATH` set to the desktop crate.

## Behavior

- **Development**: `npm run tauri --prefix frontend -- dev` starts the Vite dev server on port 5173 (fixed, `strictPort`) and opens the window on it.
- **Release build**: `npm run tauri --prefix frontend -- build` builds the interface into `frontend/dist`, which the shell embeds, and bundles the app for the current platform.
- **Commands**: `core_version` returns the core version. The profile commands (`profiles_create_empty`, `profiles_list`, `profiles_get`, `profiles_save`, `profiles_delete`, `profiles_duplicate`, `profiles_import`, `profiles_export`) run the core `ProfileStore` over `SqliteProfileRepository` (contract in `specs/009-profiles-ui-wiring/contracts/desktop-profile-commands.md`). Profiles and ids cross as JSON values (key order kept); errors cross as `{ kind, message }` with `kind` one of `invalid_file`, `syntax`, `type`, `range`, `database`, `file`.
- **Profile database**: `docmapper.sqlite3` in the application data directory (`digital.levix.docmapper`), opened at start-up and created when absent; the store sits behind one mutex, so commands run one at a time. When the database cannot be opened (for example it was written by a newer DocMapper) the app still starts, the reason is written to stderr and every profile command returns it as a `database` error.
- **Export**: `profiles_export` is asynchronous; it builds the `.dmap` text in the core, asks for the destination with the native save dialog of `tauri-plugin-dialog` used from Rust (proposed name, `.dmap` filter) and writes the file; a cancelled dialog returns `null`.
- **Permissions**: the window has only `core:default`; no file system, shell or dialog permission (the dialog plugin is called from Rust only). No content security policy is set yet, so the interface's current network calls (license check, translation, model API) work as in the browser; the policy is set when those calls move to Rust.
- **Errors**: a start-up failure is written to stderr and ends the process with exit code 1.

## Interfaces

- Loads the [Interface](interface.md); calls the core.
- The browser build of the interface works without the shell, until the browser version is removed (M7).
