# Implementation Plan: Interface wired to the Rust profile store

**Branch**: `feat/009-profiles-ui-wiring` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-profiles-ui-wiring/spec.md`

## Summary

The desktop shell opens the local SQLite profile database (`docmapper-sqlite`, M3) in the application data directory and exposes the M3 `ProfileStore` through eight thin commands (create, list, get, save, delete, duplicate, import, export with a native save dialog driven from Rust). The interface gets one asynchronous profile service that uses those commands in the desktop app and the current browser store in the browser build, with an optional shadow mode that runs both and logs differences (ADR-0003 step d). The Mapping Studio, the profile management window and the processor screen call the service only. The browser store stays as the browser backend until the browser build is removed in v0.2.0 (step e for the browser surface). FEAT-013 is delivered by `.dmap` export and import across versions.

## Technical Context

**Language/Version**: Rust 1.97.0 (edition 2021); TypeScript 5.9, Vue 3 on Node.js 22

**Primary Dependencies**: desktop crate: `docmapper-sqlite` (workspace), `serde`, `serde_json` (workspace), `tauri-plugin-dialog` 2.8 (Rust API only), dev `tempfile`; interface: `@tauri-apps/api` 2 (core `invoke`, `isTauri`, test `mockIPC`)

**Storage**: `docmapper.sqlite3` in the application data directory (M3 schema version 1, no change)

**Testing**: `cargo test --workspace` (commands over an in-memory database, export through a test save target); Vitest `unit` project (service, backends, shadow comparison); M3 parity suite unchanged; manual tests in the desktop window

**Target Platform**: Windows, macOS, Linux desktop (CI on Ubuntu)

**Project Type**: desktop app (Tauri shell over a Rust core and adapters, Vue interface)

**Performance Goals**: list 1,000 profiles in the window in under 300 ms (SC-003)

**Constraints**: no business rule in the shell (ADR-0002); window capabilities stay `core:default`; browser build unchanged (SC-005); M3 fixtures unchanged (FR-012)

**Scale/Scope**: about 300 lines of Rust and 150 of Rust tests; about 250 lines of TypeScript and 250 of tests; 3 screens edited

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Design | Commands are one-line adapters over the store; error mapping in one place; the service hides the backend choice; shadow comparison in its own file | Pass |
| II. Simplicity first | One mutex, one connection; no new port; the dialog behind a one-method trait only for tests | Pass |
| III. Hexagonal | The shell is the composition root: it wires `SqliteProfileRepository`, `SystemClock`, `StdRandom` to the core store; the core gains nothing; `tauri` and `rusqlite` stay out of the core | Pass |
| IV. Development cycle | Plan with tests, docs, CI and rollback; manual tests for what the window needs; no attribution | Pass |
| Parity (ADR-0003) | Step d: wiring behind the backend choice with a shadow mode; step e: the desktop app uses only the Rust store, the TypeScript store stays only for the browser build until it is removed | Pass |
| Storage (ADR-0006) | Profiles of the desktop app are read only from the local database | Pass |
| Final target 100% Rust | The browser store is not used by the desktop app any more | Pass |

Post-design re-check: Pass (Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/009-profiles-ui-wiring/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/desktop-profile-commands.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
Cargo.toml                                    # + workspace deps serde, tauri-plugin-dialog (if shared), tempfile
crates/docmapper-desktop/
├── Cargo.toml                                # + docmapper-sqlite, serde, serde_json, tauri-plugin-dialog; dev tempfile
└── src/
    ├── lib.rs                                # setup: open the database, manage state, dialog plugin, register commands
    ├── commands.rs                           # core_version + profile commands (thin)
    ├── profiles.rs                           # ProfileState (open, with_store), CommandError, SaveTarget, export
    └── (tests in each file)
frontend/
├── package.json                              # + @tauri-apps/api
└── src/
    ├── services/mapping/profile-service.ts   # ProfileService, backend choice, desktop and browser backends
    ├── services/mapping/profile-shadow.ts    # shadow wrapper and normalized comparison
    ├── services/mapping/*.test.ts            # unit tests
    ├── components/mapping/ProfileManagementModal.vue   # await the service, storage label
    ├── views/MappingStudio.vue               # await the service
    ├── views/Editor.vue                      # await the service
    └── i18n/locales/*                        # storage label texts
```

**Structure Decision**: the profile state and its error mapping live in `profiles.rs` of the shell so `commands.rs` stays a list of thin handlers; the interface keeps `profile-store.ts` untouched as the browser backend.

## Complexity Tracking

None.

## Dev Cycle Protocol

### Backlog items and release

FEAT-050 and FEAT-013 (epic EPIC-004), release v0.1.0 Desktop core. The removal of `profile-store.ts` goes with the removal of the browser build (FEAT for M7 in v0.2.0); the backlog item of that removal gets a note.

### Tests (quality-assurance)

- Rust (`docmapper-desktop`): every command over a store on an in-memory SQLite repository with a fixed clock and random source (results equal to the core store's); error mapping of every `StoreError` kind and of an unopened database; a database file created in the data directory; export through a test `SaveTarget` (written text and proposed name; cancel writes nothing; a write failure gives `file`); commands serialized (two threads, no interleaving).
- Interface (Vitest `unit`): backend choice (`isTauri`, shadow setting); desktop backend with `mockIPC` (command names and arguments, results, errors turned into named `Error`s); browser backend over a storage stub; shadow comparison (ids and times normalized, id mapping by position, a planted difference logged with its path, browser failure logged and not thrown, export compared without download).
- M3 parity suite and fuzzing unchanged.
- Manual tests (desktop window, cannot run in CI): profile lifecycle survives restart; import valid and invalid `.dmap`; export with the save dialog and cancel; browser-to-desktop move (FEAT-013); database refused (newer schema) shows the message and the app keeps working; shadow mode on gives no difference over the suite.

### Documentation (architecture-docs, user-docs)

- `docs/architecture/profiles.md`: the desktop app uses the Rust store through commands; the browser store only in the browser build; shadow mode.
- `docs/architecture/desktop-shell.md`: profile commands, the database location, the dialog plugin used from Rust, capabilities unchanged.
- `docs/architecture/interface.md`: the profile service and its backends.
- `TECDOC.md` rebuilt; no new ADR (the choices apply ADR-0003 and ADR-0006).
- README: where profiles are kept in the desktop app and how to bring profiles from the browser version (export, import).

### CI, release and observability (devops-release)

- No workflow change: the `rust` job already installs the Tauri system packages and builds the desktop crate; the `frontend` job runs the new unit tests.
- Version: no bump (part of v0.1.0, not released).
- Observability: the shell writes a database open failure to stderr at start-up; shadow differences go to the window console with a fixed prefix.

### Security, migration and rollback

- No secrets. The database stays on the user's computer; the window gets no file system permission (export writes from Rust to the path the user chose).
- Migration: none; the M3 schema is used as is. Profiles in the browser version move by export and import.
- Rollback: revert the pull request; the database file stays and is used again when the change returns.
