---
plan_id: docmapper_m1_text_utilities_characterization_and_rust_port_with_ecmascript_semantics
project: docmapper
title: 'M1 Text utilities: characterization and Rust port with ECMAScript semantics'
kind: feature
version: v0.1.0
status: completed
author: LeviGuilherme
created_at: '2026-11-09T16:37:50'
updated_at: '2026-11-09T17:05:15'
session_id: null
tags: []
supersedes: null
superseded_by: null
parent_plan_id: null
backlog_items:
- FEAT-005
- FEAT-006
spec_dir: specs/007-m1-text-utilities
milestones:
- name: setup
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: characterization
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: rust-port
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: fuzzing
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: docs
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
status_log:
- at: '2026-11-09T16:37:50'
  by: LeviGuilherme
  status: draft
  note: Plan created
- at: '2026-11-09T16:44:01'
  by: LeviGuilherme
  status: planned
  note: Plan updated
- at: '2026-11-09T16:47:45'
  by: LeviGuilherme
  status: in_progress
  note: Approved by Levi on 2026-11-09, including the two kept defects as low bugs targeted at v0.2.0 (fix after the switch in M6)
- at: '2026-11-09T17:05:10'
  by: LeviGuilherme
  note: Milestone 'setup' completed
- at: '2026-11-09T17:05:11'
  by: LeviGuilherme
  note: Milestone 'characterization' completed
- at: '2026-11-09T17:05:12'
  by: LeviGuilherme
  note: Milestone 'rust-port' completed
- at: '2026-11-09T17:05:14'
  by: LeviGuilherme
  note: Milestone 'fuzzing' completed
- at: '2026-11-09T17:05:15'
  by: LeviGuilherme
  note: Milestone 'docs' completed
- at: '2026-11-09T17:05:15'
  by: LeviGuilherme
  status: completed
  note: All milestones completed
---

# M1 Text utilities: characterization and Rust port with ECMAScript semantics

Envelope of the Spec Kit feature `specs/007-m1-text-utilities/` (spec, plan, research, data model, contracts, tasks). The detail lives there; this file holds the goal, the decisions and the milestones.

## Backlog items

### FEAT-005: Characterization tests and fixtures for the text utilities
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: Full branch coverage in TypeScript.

### FEAT-006: Rust port of the text utilities with ECMAScript regex and string semantics
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: regress, UTF-16 indexing, ECMAScript whitespace; fixtures and proptest fuzzing pass.

## 1. Goal and decisions

Characterize and port the four pure text utilities (EPIC-002): `formatOutputFileName`, `testRegexPattern`, `flattenDictionary` and `sanitizePunctuation`, as the parity module `text` (ADR-0003 steps a to c). The Rust twins are wired into the application when their callers move to Rust (batch in M6, localization in M8). Choices, with alternatives, are in `specs/007-m1-text-utilities/research.md`: a frozen copy of the functions alone under `parity/text/`; the `{date}` clock injected by a Date wrapper in the parity tooling and a date parameter in Rust (no port yet); `regress` matched over UTF-16 code units, with a normalization step for the legacy `\u{...}` form it reads differently; an ECMAScript layer (whitespace, trim, case, replacement patterns, maximum string length, property order, value to text with `ryu-js`); branch coverage through `@vitest/coverage-v8`. One exception to exact equality, decided by the product owner on 2026-11-09: the message text of an invalid validation pattern is compared by presence only (no caller reads it), recorded in a new ADR. Two TypeScript defects found are kept for parity and captured as low bugs.

## 2. Design (`software-design`)

See `specs/007-m1-text-utilities/plan.md` (Project Structure, Constitution Check), `data-model.md` and `contracts/core-text-api.md`. A `text` module in `docmapper-core` with one file per utility plus `ecmascript.rs`, `property_map.rs` and `js_value.rs`; typed errors (`FileNameError`) whose JavaScript names and messages live only in the parity tests; no trait or port.

## 3. Affected surfaces and files

No surface changes (`desktop` and `mcp` untouched). New: `crates/docmapper-core/src/text/`, `crates/docmapper-parity/tests/text.rs`, `parity/text/`, `parity/fixtures/text/`, one ADR, `docs/architecture/text-utilities.md`. Changed: `crates/docmapper-core/Cargo.toml` and `src/lib.rs`, `crates/docmapper-parity/src/runner.rs`, `parity/oracle/modules.ts`, `parity/modules.json`, `frontend/package.json`, `frontend/vitest.config.ts`, `docs/architecture/{parity,localization,batch}.md`, `docs/BACKLOG.md`, `TECDOC.md`.

## 4. Tests (`quality-assurance`)

See the "Tests" section of `specs/007-m1-text-utilities/plan.md`: about 60 characterization cases at 100% branch coverage, Rust unit tests for every ECMAScript helper, fixture tests with exact comparison, four `proptest` properties through the oracle (256 cases each). No manual test added.

## 5. Documentation (`architecture-docs`, `user-docs`)

New `docs/architecture/text-utilities.md` and one ADR (validation pattern errors compared by presence); `parity.md`, `localization.md` and `batch.md` edited; TECDOC index rebuilt. README unchanged.

## 6. CI, release and observability (`devops-release`)

No workflow change (the `parity` job already runs everything, now with coverage). No version change (part of v0.1.0, not yet released). No logs: pure functions; shadow-mode logging comes with the wiring.

## 7. Security, migration and rollback

No secrets, no data. Validation patterns compile without a backtracking limit, as in V8 today. Rollback: revert the pull request; nothing in the application uses the Rust code yet.

## 8. Execution steps and milestones

1. `setup`: dependencies, coverage, ECMAScript layer, `assert_module_with` (tasks T001-T006).
2. `characterization`: frozen copy, oracle table, cases and fixtures at 100% branch coverage (T007-T009).
3. `rust-port`: the four utilities and the fixture test, module marked ported (T010-T014).
4. `fuzzing`: generators and properties through the oracle, differences fixed (T015-T016).
5. `docs`: ADR, subsystem page, backlog bugs, final checks (T017-T020).
