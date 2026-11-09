---
description: "Tasks for M3 Profiles"
---

# Tasks: M3 Profiles: characterization, Rust profile store and local SQLite repository

**Input**: Design documents from `specs/008-m3-profiles-storage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: required by the constitution (Evidence) and by ADR-0003; test tasks come before the code they prove.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 characterization, US2 Rust store, US3 SQLite, US4 fuzzing

## Phase 1: Setup

- [x] T001 Add `crates/docmapper-sqlite` to the workspace with `rusqlite` 0.41 (`bundled`) and dev `tempfile`; declare `pub mod profiles` in `crates/docmapper-core/src/lib.rs`; add `serde` (derive) to the core
- [x] T002 [P] Add `parity/profiles/**` to the coverage `include` of the parity project in `frontend/vitest.config.ts`

## Phase 2: Characterization (US1)

- [x] T003 [US1] Copy `profile-store.ts` from 60a4b51 to `parity/profiles/profile-store.ts` without the built-in factory and its template import
- [x] T004 [US1] Write `parity/profiles/harness.ts`: storage stub, ticking clock, scripted random source, one wrapper per operation returning `{returned, stored}`; register them in `parity/oracle/modules.ts`
- [x] T005 [US1] Write `parity/profiles/profiles.parity.test.ts` (cases for every branch and edge case, stub tests for browser-only branches); generate, review and commit `parity/fixtures/profiles/`; register `profiles` as `characterized`

## Phase 3: Rust store (US2)

- [x] T006 [US2] Tests, then `number_to_radix_string` in `crates/docmapper-core/src/text/ecmascript.rs`
- [x] T007 [P] [US2] Tests, then `profiles/document.rs`, `profiles/js.rs` and `profiles/json_text.rs`
- [x] T008 [P] [US2] Tests, then `profiles/model.rs` (typed read model)
- [x] T009 [US2] `profiles/ports.rs`, `profiles/memory.rs`, `profiles/system.rs`
- [x] T010 [US2] Tests, then `profiles/store.rs` and `profiles/export.rs`
- [x] T011 [US2] `crates/docmapper-parity/tests/profiles.rs`: fixtures on the in-memory repository with error mapping and the FR-009 normalization

## Phase 4: SQLite repository (US3)

- [x] T012 [US3] Tests, then `docmapper-sqlite` `migrations.rs` and `repository.rs` (WAL, ordering, newer schema refused, corrupt rows)
- [x] T013 [US3] Run every `profiles` fixture on the SQLite repository too; mark `profiles` as `ported`

## Phase 5: Fuzzing (US4)

- [x] T014 [US4] Generators and `proptest` properties through the oracle for each operation; fix every difference

## Phase 6: Documentation and checks

- [x] T015 ADR for FR-009; rewrite `docs/architecture/profiles.md`; edit `parity.md`; rebuild `TECDOC.md`
- [x] T016 Capture the R8 defects and the wiring item in the backlog and the roadmap
- [x] T017 Run every `test_commands` entry, `check_docs`, `check_design`, `parity-check`

## Dependencies

Phase 1 → Phase 2 → Phase 3 (T006–T010 before T011) → Phase 4 → Phase 5 → Phase 6. T007 and T008 can run in parallel.
