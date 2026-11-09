---
description: "Tasks for M0 Foundation"
---

# Tasks: M0 Foundation: Cargo workspace, desktop shell, parity harness and CI

**Input**: Design documents from `specs/006-m0-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: required by the constitution (Evidence) and by ADR-0003; test tasks come before the code they prove.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 desktop shell, US2 parity harness, US3 CI

## Phase 1: Setup

- [x] T001 Create the Cargo workspace in `Cargo.toml` (members under `crates/`, `workspace.package` version 0.1.0, edition 2021, license) and `rust-toolchain.toml` (1.97.0 with rustfmt and clippy)
- [x] T002 [P] Add `target/` and parity run records to `.gitignore`
- [x] T003 [P] Set `devops.version_files` to `["Cargo.toml"]` and `test_commands` in `.dev-cycle.json`
- [x] T004 [P] Add Vitest, tsx and `@tauri-apps/cli` to `frontend/package.json` with scripts `test`, `test:parity` and `tauri`; add `frontend/vitest.config.ts`

## Phase 2: Foundational

- [x] T005 Write the test for the core version in `crates/docmapper-core/src/lib.rs`, then the `version()` function (no dependencies)
- [x] T006 Run `check_design` and confirm the core has no forbidden imports

## Phase 3: User Story 1 - Desktop shell (P1)

**Goal**: the current interface runs in a desktop window; the browser build is unchanged.

**Independent Test**: `npm run tauri -- dev` opens the interface; `npm run build` still builds the browser version.

- [x] T007 [US1] Write the test for the `core_version` command in `crates/docmapper-desktop/src/commands.rs`, then the command
- [x] T008 [US1] Create `crates/docmapper-desktop` (`Cargo.toml`, `build.rs`, `src/main.rs`, `src/lib.rs` as composition root registering the command)
- [x] T009 [US1] Write `crates/docmapper-desktop/tauri.conf.json` (product name, identifier `digital.levix.docmapper`, devUrl, frontendDist, before commands, window size) and `capabilities/default.json` with `core:default` only
- [x] T010 [P] [US1] Generate the application icons in `crates/docmapper-desktop/icons/` from the current logo
- [x] T011 [US1] Fix the Vite dev port in `frontend/vite.config.ts` (5173, `strictPort`, `clearScreen: false`) without changing the browser build
- [x] T012 [US1] Build the release bundle locally and open the app; confirm the main screens load

## Phase 4: User Story 2 - Parity harness (P1)

**Goal**: fixtures written by TypeScript, read by Rust, fuzzed through the oracle, checked for one-sided ids.

**Independent Test**: the self-test module passes all parts; removing a fixture or a case makes the checker fail.

- [x] T013 [P] [US2] Write `parity/modules.json` and the fixture schema copy `parity/fixture.schema.json`
- [x] T014 [US2] Write Vitest tests for the fixture writer, then `parity/writer/fixture-writer.ts` (update mode, check mode, error capture, run record)
- [x] T015 [US2] Write the self-test module `parity/selftest/harness.ts`, its characterization cases `parity/selftest/harness.parity.test.ts`, and generate `parity/fixtures/harness/*.json`
- [x] T016 [US2] Write Vitest tests for request handling, then the oracle `parity/oracle/main.ts` and `parity/oracle/modules.ts`
- [x] T017 [US2] Create `crates/docmapper-parity` with tests first for `fixture.rs` (parsing and validation), `registry.rs`, `runner.rs` (exact comparison, run record) and `check.rs` (every one-sided case)
- [x] T018 [US2] Write `oracle.rs` (process client) with an ignored integration test against the real oracle and a `proptest` property over the self-test module
- [x] T019 [US2] Write the Rust twin of the self-test module in the parity crate's tests and the fixture test that runs all `harness` fixtures; mark `harness` as `ported`
- [x] T020 [US2] Write the `parity-check` binary and run it end to end

## Phase 5: User Story 3 - CI (P2)

**Goal**: every pull request runs Rust, TypeScript and parity checks.

**Independent Test**: the workflow runs green on the pull request of this feature.

- [x] T021 [US3] Write `.github/workflows/ci.yml` with jobs `rust`, `frontend` and `parity` (plan section "CI, release and observability")
- [x] T022 [US3] Run `check_ci_policy` and fix its errors; follow the first run to green

## Phase 6: Polish and documentation

- [x] T023 [P] Write `docs/architecture/parity.md` and `docs/architecture/desktop-shell.md`; edit `docs/architecture/interface.md`; run `build_index` and `check_docs`
- [x] T024 [P] Add the "Development" section to `README.md`; run `check_readme`
- [x] T025 [P] Create `tests/MANUAL_TESTS.md` with the two desktop tests; run `manual_tests validate`
- [x] T026 Run all checks of `quickstart.md`, `check_design`, and the no-attribution check on commits and the diff

## Dependencies and order

Setup (T001-T004) → Foundational (T005-T006) → US1 and US2 can proceed in parallel → US3 needs US1 (desktop crate) and US2 (parity commands) → Polish.
