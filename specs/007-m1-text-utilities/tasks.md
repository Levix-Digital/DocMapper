---
description: "Tasks for M1 Text utilities"
---

# Tasks: M1 Text utilities: characterization and Rust port with ECMAScript semantics

**Input**: Design documents from `specs/007-m1-text-utilities/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: required by the constitution (Evidence) and by ADR-0003; test tasks come before the code they prove.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 characterization, US2 Rust port, US3 fuzzing

## Phase 1: Setup

- [ ] T001 Add `regress` 0.12 (feature `utf16`), `ryu-js` 1 and `serde_json` (workspace) to `crates/docmapper-core/Cargo.toml`; declare `pub mod text` in `crates/docmapper-core/src/lib.rs`
- [ ] T002 [P] Add `@vitest/coverage-v8` to `frontend/package.json` and coverage of `parity/text/**` with a 100% branch threshold to the parity project in `frontend/vitest.config.ts`

## Phase 2: Foundational

- [ ] T003 Write tests, then `crates/docmapper-core/src/text/ecmascript.rs`: whitespace set, `trim`, `to_lower_case`, `utf16_len`, `pad_start` with the maximum string length, `get_substitution`
- [ ] T004 [P] Write tests, then `crates/docmapper-core/src/text/property_map.rs`: ECMAScript property order, overwrite in place, `__proto__` rule
- [ ] T005 [P] Write tests, then `crates/docmapper-core/src/text/js_value.rs`: `String(value)` for JSON values with `ryu-js`
- [ ] T006 Add `assert_module_with` (normalize expected and actual outcomes before the exact comparison) with its unit test in `crates/docmapper-parity/src/runner.rs`

## Phase 3: User Story 1 - Characterization (P1)

- [ ] T007 [US1] Copy the four functions unchanged from commit f38b9e9 into `parity/text/filename-formatter.ts`, `parity/text/validation-pattern.ts` and `parity/text/translation-text.ts`, each with a source header; add `parity/text/fixed-clock.ts` (Date replacement with restore in `finally`)
- [ ] T008 [US1] Register the `text` table in `parity/oracle/modules.ts` (`formatOutputFileName(options, nowMs)` through the clock wrapper) and add `"text": "characterized"` to `parity/modules.json`
- [ ] T009 [US1] Write the characterization cases in `parity/text/text.parity.test.ts` (every branch and every spec edge case), run with `PARITY_UPDATE=1`, review and commit `parity/fixtures/text/*.json`; confirm 100% branch coverage

## Phase 4: User Story 2 - Rust port (P1)

- [ ] T010 [US2] Write the fixture test `crates/docmapper-parity/tests/text.rs` (call table, mapping of core errors to JavaScript name and message, FR-008 normalization for `testRegexPattern`)
- [ ] T011 [P] [US2] Implement `sanitize_punctuation` and `flatten_dictionary` in `crates/docmapper-core/src/text/translation.rs` with unit tests
- [ ] T012 [P] [US2] Implement `check_validation_pattern` with legacy pattern normalization in `crates/docmapper-core/src/text/validation_pattern.rs` with unit tests
- [ ] T013 [P] [US2] Implement `CalendarDate`, `FileNameOptions`, `FileNameError` and `format_output_file_name` in `crates/docmapper-core/src/text/file_name.rs` with unit tests
- [ ] T014 [US2] Expose the public API in `crates/docmapper-core/src/text/mod.rs`; mark `text` as `ported` in `parity/modules.json`; run the fixture test and `parity-check`

## Phase 5: User Story 3 - Differential fuzzing (P2)

- [ ] T015 [US3] Add the weighted generators and four `proptest` properties (256 cases, `#[ignore]`) through the oracle in `crates/docmapper-parity/tests/text.rs`
- [ ] T016 [US3] Run the properties; for each difference, add the shrunk input as a characterization case and fix the port (or the pattern normalization) until all pass

## Phase 6: Polish and cross-cutting

- [ ] T017 [P] Write the ADR "Validation pattern errors compared by presence, not by message" in `docs/adr/`
- [ ] T018 [P] Write `docs/architecture/text-utilities.md`; edit `docs/architecture/parity.md`, `docs/architecture/localization.md` and `docs/architecture/batch.md`; rebuild the `TECDOC.md` index
- [ ] T019 [P] Capture the two kept defects as low bugs in `docs/BACKLOG.md`
- [ ] T020 Run every command of `.dev-cycle.json` `test_commands` and `check_design`; fix what fails

## Dependencies

- T001 before T003 to T005 and T011 to T013; T002 before T009; T006 before T010.
- US1 (T007 to T009) before US2's fixture test passes (T010, T014); US2 before US3.
- Phase 6 after US3, except T017 and T019, which can start at any time.
