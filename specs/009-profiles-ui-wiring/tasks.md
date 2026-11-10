---
description: "Tasks for the interface wired to the Rust profile store"
---

# Tasks: Interface wired to the Rust profile store

**Input**: Design documents from `specs/009-profiles-ui-wiring/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: required by the constitution (Evidence); test tasks come before the code they prove.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 database store, US2 import and export, US3 shadow mode

## Phase 1: Setup

- [x] T001 Add `docmapper-sqlite`, `serde`, `serde_json`, `tauri-plugin-dialog` 2.8 and dev `tempfile` to `crates/docmapper-desktop/Cargo.toml`
- [x] T002 [P] Add `@tauri-apps/api` 2 to `frontend/package.json`

## Phase 2: Desktop commands (US1, US2)

- [x] T003 [US1] Tests, then `crates/docmapper-desktop/src/profiles.rs`: `ProfileState` (open in a directory, keep the open error, `with_store` under one mutex), `CommandError` and its mapping from `StoreError`
- [x] T004 [US1] Tests, then the profile commands in `crates/docmapper-desktop/src/commands.rs` (create, list, get, save, delete, duplicate, import)
- [x] T005 [US2] Tests, then `SaveTarget` (native dialog from Rust; test target) and `profiles_export`
- [x] T006 [US1] `crates/docmapper-desktop/src/lib.rs`: open the database in the application data directory at start-up, register the dialog plugin and the commands; capabilities unchanged

## Phase 3: Interface (US1, US2)

- [x] T007 [US1] Tests, then `frontend/src/services/mapping/profile-service.ts`: `ProfileService`, desktop backend over `invoke`, browser backend over `profile-store.ts`, backend choice, error naming
- [x] T008 [US1] Use the service in `ProfileManagementModal.vue`, `MappingStudio.vue` and `Editor.vue` (await, error display); storage label texts in every locale
- [x] T009 [US2] Import and export through the service in the modal and the Mapping Studio (cancelled export shows no notice)

## Phase 4: Shadow mode (US3)

- [x] T010 [US3] Tests, then `frontend/src/services/mapping/profile-shadow.ts` (normalization, id mapping, difference path, logging) and its selection by the developer setting

## Phase 5: Verification and documentation

- [x] T011 Run every `test_commands` entry; run the desktop window under Xvfb and walk the profile manual tests (the shadow mode is proven by its unit tests; MT-PROF-005 runs it in the window)
- [x] T012 [P] Update `docs/architecture/profiles.md`, `desktop-shell.md`, `interface.md`; rebuild `TECDOC.md`; README section on profiles in the desktop app
- [x] T013 [P] Add the manual tests of the plan to the curated suite and validate it
- [x] T014 Note on the browser build removal item that `profile-store.ts` goes with it; close FEAT-050 and FEAT-013 with the pull request
