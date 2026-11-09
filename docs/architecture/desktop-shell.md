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
- `crates/docmapper-desktop`: `src/lib.rs` (builds the Tauri application and registers the commands), `src/commands.rs` (one thin handler per command), `src/main.rs` (entry point), `tauri.conf.json`, `capabilities/default.json`, `icons/` (generated from `icons/source.png` with `npm run tauri -- icon`).
- `frontend/scripts/tauri.mjs`: runs the Tauri CLI from the frontend folder with `TAURI_APP_PATH` set to the desktop crate.

## Behavior

- **Development**: `npm run tauri --prefix frontend -- dev` starts the Vite dev server on port 5173 (fixed, `strictPort`) and opens the window on it.
- **Release build**: `npm run tauri --prefix frontend -- build` builds the AssemblyScript module and the interface into `frontend/dist`, which the shell embeds, and bundles the app for the current platform.
- **Commands**: `core_version` returns the core version.
- **Permissions**: the window has only `core:default`; no file system, shell or other plugin. No content security policy is set yet, so the interface's current network calls (license check, translation, model API) work as in the browser; the policy is set when those calls move to Rust.
- **Errors**: a start-up failure is written to stderr and ends the process with exit code 1.

## Interfaces

- Loads the [Interface](interface.md); calls the core.
- The browser build of the interface works without the shell, until the browser version is removed (M7).
