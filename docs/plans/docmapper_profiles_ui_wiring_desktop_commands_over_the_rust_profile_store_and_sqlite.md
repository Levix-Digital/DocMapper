---
plan_id: docmapper_profiles_ui_wiring_desktop_commands_over_the_rust_profile_store_and_sqlite
project: docmapper
title: 'Profiles UI wiring: desktop commands over the Rust profile store and SQLite'
kind: feature
version: v0.1.0
status: completed
author: LeviGuilherme
created_at: '2026-11-10T12:55:49'
updated_at: '2026-11-10T17:18:52'
session_id: null
tags: []
supersedes: null
superseded_by: null
parent_plan_id: null
backlog_items:
- FEAT-050
- FEAT-013
spec_dir: specs/009-profiles-ui-wiring
milestones:
- name: setup
  done: true
  done_at: '2026-11-10'
  by: LeviGuilherme
- name: commands
  done: true
  done_at: '2026-11-10'
  by: LeviGuilherme
- name: interface
  done: true
  done_at: '2026-11-10'
  by: LeviGuilherme
- name: shadow
  done: true
  done_at: '2026-11-10'
  by: LeviGuilherme
- name: docs
  done: true
  done_at: '2026-11-10'
  by: LeviGuilherme
status_log:
- at: '2026-11-10T12:55:49'
  by: LeviGuilherme
  status: draft
  note: Plan created
- at: '2026-11-10T12:56:17'
  by: LeviGuilherme
  status: active
  note: Plan updated
- at: '2026-11-10T12:56:34'
  by: LeviGuilherme
  note: 'Approved with open bugs before new work BUG-001, BUG-002, BUG-003, BUG-004, BUG-005: BUG-001, BUG-002, BUG-004 and BUG-005 are scheduled for v0.2.0 and BUG-003 for v0.3.0 by the product owner (2026-11-09)'
- at: '2026-11-10T17:16:56'
  by: LeviGuilherme
  note: Milestone 'setup' completed
- at: '2026-11-10T17:17:00'
  by: LeviGuilherme
  note: Milestone 'commands' completed
- at: '2026-11-10T17:17:01'
  by: LeviGuilherme
  note: Milestone 'interface' completed
- at: '2026-11-10T17:17:01'
  by: LeviGuilherme
  note: Milestone 'shadow' completed
- at: '2026-11-10T17:18:52'
  by: LeviGuilherme
  note: Milestone 'docs' completed
- at: '2026-11-10T17:18:52'
  by: LeviGuilherme
  status: completed
  note: All milestones completed
---

# Profiles UI wiring: desktop commands over the Rust profile store and SQLite

Envelope of the Spec Kit feature `specs/009-profiles-ui-wiring/` (spec, plan, research, data model, contracts, tasks). The detail lives there; this file holds the goal, the decisions and the milestones.

## Backlog items

### FEAT-050: Interface wired to the Rust profile store through application commands
- **Priority**: high
- **Found**: 2026-11-09, M3 plan (specs/008-m3-profiles-storage)
- **Description**: ADR-0003 steps d and e for the profiles module: desktop commands over ProfileStore and the SQLite repository in the application data directory, the interface calling them with a shadow mode that compares the stored JSON with the browser store and logs differences, then removal of the browser store. Decided by the product owner on 2026-11-09 as a separate item after M3.

### FEAT-013: Import of profiles from the browser version
- **Priority**: medium
- **Found**: 2026-11-08
- **Description**: Through .docmapper export and import.

## 1. Goal and decisions

The desktop app keeps profiles in the local SQLite database of ADR-0006 through the M3 Rust profile store, and the screens behave as before (ADR-0003 step d and, for the desktop surface, step e). Choices, with alternatives, are in `specs/009-profiles-ui-wiring/research.md`:

- The shell opens `docmapper.sqlite3` in the application data directory at start-up and keeps one store behind one mutex; a failure to open does not stop the app and every profile operation reports it.
- Eight thin commands, one per store operation; profiles and ids cross as JSON values so key order and unknown keys are kept; errors cross as `{kind, message}`.
- Export in the desktop app uses the native save dialog driven from Rust (`tauri-plugin-dialog`), so the window gets no file system permission.
- One asynchronous profile service in the interface: commands in the desktop app, the current browser store in the browser build.
- Shadow mode (off by default, developer setting): runs both stores and logs differences, ids and times compared by position only.
- The browser store stays only as the browser build's store and is removed with the browser build (FEAT-027, v0.2.0), which the product owner keeps until then; FEAT-050's "removal of the browser store" moves there.
- FEAT-013 is delivered by `.dmap` export from the browser version and import in the desktop app (separate storage, no automatic copy).

No new ADR: the choices apply ADR-0002, ADR-0003 and ADR-0006.

## 2. Design (`software-design`)

See `specs/009-profiles-ui-wiring/plan.md` (Project Structure, Constitution Check), `data-model.md` and `contracts/desktop-profile-commands.md`. Shell: `profiles.rs` (state, error mapping, save target), `commands.rs` (thin handlers), `lib.rs` (composition). Interface: `profile-service.ts` (service and backends), `profile-shadow.ts` (comparison).

## 3. Affected surfaces and files

Surface `desktop` changes (new commands). Changed: `crates/docmapper-desktop/{Cargo.toml,src/lib.rs,src/commands.rs}`, `Cargo.lock`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/components/mapping/ProfileManagementModal.vue`, `frontend/src/views/{MappingStudio,Editor}.vue`, locale files, `docs/architecture/{profiles,desktop-shell,interface}.md`, `TECDOC.md`, `README.md`, `docs/BACKLOG.md`, the manual test suite. New: `crates/docmapper-desktop/src/profiles.rs`, `frontend/src/services/mapping/{profile-service,profile-shadow}.ts` and their tests.

## 4. Tests (`quality-assurance`)

See the "Tests" section of `specs/009-profiles-ui-wiring/plan.md`: Rust tests of every command over an in-memory database, error mapping, export through a test save target, serialized commands; Vitest tests of the service, both backends and the shadow comparison; M3 parity unchanged. Manual tests added for the desktop window: profile lifecycle across restart, import, export and cancel, browser-to-desktop move, refused database, shadow mode with no difference.

## 5. Documentation (`architecture-docs`, `user-docs`)

`profiles.md`, `desktop-shell.md` and `interface.md` edited for today; TECDOC index rebuilt; README section on where profiles are kept and how to bring them from the browser version. No ADR.

## 6. CI, release and observability (`devops-release`)

No workflow change. No version change (part of v0.1.0). Database open failures go to stderr; shadow differences to the window console with the prefix `[profiles shadow]`.

## 7. Security, migration and rollback

No secrets; the window keeps only `core:default`. No schema change. Rollback: revert the pull request; the database file stays and is used again when the change returns.

## 8. Execution steps and milestones

1. `setup`: dependencies (T001-T002).
2. `commands`: profile state, commands, export, composition (T003-T006).
3. `interface`: service, screens, import and export (T007-T009).
4. `shadow`: shadow comparison (T010).
5. `docs`: verification, documentation, manual tests, backlog (T011-T014).
