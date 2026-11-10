---
plan_id: docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
project: docmapper
title: 'M3 Profiles: characterization, Rust profile store and local SQLite repository'
kind: feature
version: v0.1.0
status: completed
author: LeviGuilherme
created_at: '2026-11-09T18:07:32'
updated_at: '2026-11-09T18:34:41'
session_id: null
tags: []
supersedes: null
superseded_by: null
parent_plan_id: null
backlog_items:
- FEAT-009
- FEAT-010
- FEAT-011
spec_dir: specs/008-m3-profiles-storage
milestones:
- name: setup
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: characterization
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: rust-store
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: sqlite
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
- at: '2026-11-09T18:07:32'
  by: LeviGuilherme
  status: draft
  note: Plan created
- at: '2026-11-09T18:11:21'
  by: LeviGuilherme
  status: planned
  note: Plan updated
- at: '2026-11-09T18:21:20'
  by: LeviGuilherme
  status: in_progress
  note: 'Approved by Levi on 2026-11-09: built-in CMR factory not ported, malformed file SyntaxError compared by kind (new ADR), two kept import defects as low bugs, interface wiring as a separate v0.1.0 item'
- at: '2026-11-09T18:34:26'
  by: LeviGuilherme
  note: Milestone 'setup' completed
- at: '2026-11-09T18:34:26'
  by: LeviGuilherme
  note: Milestone 'characterization' completed
- at: '2026-11-09T18:34:27'
  by: LeviGuilherme
  note: Milestone 'rust-store' completed
- at: '2026-11-09T18:34:27'
  by: LeviGuilherme
  note: Milestone 'sqlite' completed
- at: '2026-11-09T18:34:28'
  by: LeviGuilherme
  note: Milestone 'fuzzing' completed
- at: '2026-11-09T18:34:41'
  by: LeviGuilherme
  note: Milestone 'docs' completed
- at: '2026-11-09T18:34:41'
  by: LeviGuilherme
  status: completed
  note: All milestones completed
---

# M3 Profiles: characterization, Rust profile store and local SQLite repository

Envelope of the Spec Kit feature `specs/008-m3-profiles-storage/` (spec, plan, research, data model, contracts, tasks). The detail lives there; this file holds the goal, the decisions and the milestones.

## Backlog items

### FEAT-009: Characterization tests and fixtures for profiles and .docmapper files
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: Parity on the stored JSON of each profile.

### FEAT-010: Rust profile model and ProfileRepository port
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: Ids and clock injected.

### FEAT-011: Local SQLite repository
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: WAL mode, additive migrations.

## 1. Goal and decisions

Characterize and port the profile store of the interface (`profile-store.ts`: create, list, find, save, delete, duplicate, `.dmap` export and import) as the parity module `profiles` (ADR-0003 steps a to c), with the profile model, the `ProfileRepository` port and the local SQLite repository of ADR-0006. Every fixture runs on an in-memory and on the SQLite repository, so the stored JSON of each profile is proven equal. Choices, with alternatives, are in `specs/008-m3-profiles-storage/research.md`: profiles kept as ordered JSON documents (import keeps unknown keys and key order), a typed read model for later modules, injected clock and random source read in the TypeScript order, a repository with list, save and delete, a separate `docmapper-sqlite` crate on `rusqlite` (bundled SQLite, WAL, numbered additive migrations, newer schema refused). The unused built-in CMR profile factory is not ported (a ready-made profile, as ADR-0011 for the CMR core). One exception to exact equality, approved by the product owner on 2026-11-09 (ADR-0012): malformed JSON in an imported file is compared by error kind (`SyntaxError`), not by V8's message, and JSON outside Rust strings and f64 is refused; recorded in a new ADR. Wiring the interface (application commands, shadow mode, removal of the browser store) is a new v0.1.0 item after this plan. Two TypeScript defects found are kept for parity and captured as low bugs.

## 2. Design (`software-design`)

See `specs/008-m3-profiles-storage/plan.md` (Project Structure, Constitution Check), `data-model.md` and `contracts/core-profiles-api.md`. A `profiles` module in `docmapper-core` (document, model, ports, JavaScript helpers, JSON text writer, store, export, in-memory repository, system clock and random); a `docmapper-sqlite` adapter crate; typed errors (`StoreError`, `RepositoryError`) whose JavaScript names and messages are mapped in the parity tests.

## 3. Affected surfaces and files

No surface changes (`desktop` and `mcp` untouched). New: `crates/docmapper-core/src/profiles/`, `crates/docmapper-sqlite/`, `crates/docmapper-parity/tests/profiles.rs`, `parity/profiles/`, `parity/fixtures/profiles/`, one ADR. Changed: `Cargo.toml`, `Cargo.lock`, `crates/docmapper-core/{Cargo.toml,src/lib.rs,src/text/ecmascript.rs}`, `crates/docmapper-parity/Cargo.toml`, `parity/oracle/modules.ts`, `parity/modules.json`, `frontend/vitest.config.ts`, `docs/architecture/{profiles,parity}.md`, `docs/BACKLOG.md`, `docs/ROADMAP.md`, `TECDOC.md`.

## 4. Tests (`quality-assurance`)

See the "Tests" section of `specs/008-m3-profiles-storage/plan.md`: about 70 characterization cases at 100% branch coverage of the ported part, Rust unit tests for every JavaScript helper and the export writer, SQLite adapter tests (reopen, order, WAL, migrations, newer schema, corrupt rows, 1,000-profile listing), fixture tests on both repositories, `proptest` properties through the oracle (256 cases each). No manual test added.

## 5. Documentation (`architecture-docs`, `user-docs`)

`docs/architecture/profiles.md` rewritten for today, `parity.md` edited, one ADR (malformed profile files compared by error kind), TECDOC index rebuilt. README unchanged.

## 6. CI, release and observability (`devops-release`)

No workflow change. No version change (part of v0.1.0). Repository errors are typed with the row position; logging comes with the wiring item.

## 7. Security, migration and rollback

No secrets. Bound SQL parameters only. Schema version 1 is new; later migrations only add; a newer database is refused. Rollback: revert the pull request; nothing in the application uses the Rust code yet.

## 8. Execution steps and milestones

1. `setup`: crates, dependencies, coverage (T001-T002).
2. `characterization`: frozen copy, harness, cases and fixtures (T003-T005).
3. `rust-store`: JavaScript helpers, model, ports, store, export, fixture test (T006-T011).
4. `sqlite`: adapter and fixtures on SQLite, module marked ported (T012-T013).
5. `fuzzing`: properties through the oracle (T014).
6. `docs`: ADR, subsystem pages, backlog, final checks (T015-T017).
