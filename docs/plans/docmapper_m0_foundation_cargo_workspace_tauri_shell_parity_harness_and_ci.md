---
plan_id: docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
project: docmapper
title: 'M0 Foundation: Cargo workspace, Tauri shell, parity harness and CI'
kind: feature
version: v0.1.0
status: completed
author: LeviGuilherme
created_at: '2026-11-09T12:11:08'
updated_at: '2026-11-09T12:50:28'
session_id: null
tags: []
supersedes: null
superseded_by: null
parent_plan_id: null
backlog_items:
- FEAT-001
- FEAT-002
- FEAT-003
- FEAT-004
spec_dir: specs/006-m0-foundation
milestones:
- name: setup
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: desktop-shell
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: parity-harness
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: ci
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
- name: docs
  done: true
  done_at: '2026-11-09'
  by: LeviGuilherme
status_log:
- at: '2026-11-09T12:11:08'
  by: LeviGuilherme
  status: draft
  note: Plan created
- at: '2026-11-09T12:14:55'
  by: LeviGuilherme
  status: planned
  note: Plan updated
- at: '2026-11-09T12:33:34'
  by: LeviGuilherme
  status: in_progress
  note: Approved by Levi on 2026-11-09
- at: '2026-11-09T12:50:23'
  by: LeviGuilherme
  note: Milestone 'setup' completed
- at: '2026-11-09T12:50:25'
  by: LeviGuilherme
  note: Milestone 'desktop-shell' completed
- at: '2026-11-09T12:50:26'
  by: LeviGuilherme
  note: Milestone 'parity-harness' completed
- at: '2026-11-09T12:50:27'
  by: LeviGuilherme
  note: Milestone 'ci' completed
- at: '2026-11-09T12:50:28'
  by: LeviGuilherme
  note: Milestone 'docs' completed
- at: '2026-11-09T12:50:28'
  by: LeviGuilherme
  status: completed
  note: All milestones completed
---

# M0 Foundation: Cargo workspace, Tauri shell, parity harness and CI

Envelope of the Spec Kit feature `specs/006-m0-foundation/` (spec, plan, research, data model, contracts, tasks). The detail lives there; this file holds the goal, the decisions and the milestones.

## Backlog items

### FEAT-001: Cargo workspace with docmapper-core and docmapper-desktop crates
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: Hexagonal layout from .dev-cycle.json; check_design passes.

### FEAT-002: Tauri 2 shell running the current Vue interface
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: Browser build keeps working until M7.

### FEAT-003: Parity harness: fixture format, fixture writer, Node oracle and id checker
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: parity/fixtures/<module>/<case>.json with {input, output}; CI fails when an id exists on one side only.

### FEAT-004: CI with Rust and TypeScript jobs
- **Priority**: high
- **Found**: 2026-11-08
- **Description**: cargo fmt, clippy, test; Vitest; parity checker.

## 1. Goal and decisions

Lay the foundation of the Rust migration (EPIC-001) without moving any logic: a Cargo workspace with the core and the Tauri desktop shell running the current Vue interface, the parity harness every later module needs, and CI on every pull request. Decisions already accepted: ADR-0001 (Tauri with a Rust core), ADR-0002 (hexagonal layout), ADR-0003 (TypeScript as parity oracle). Choices made in this plan, with alternatives, are in `specs/006-m0-foundation/research.md`: the oracle is a Node process over newline-delimited JSON on stdio, TypeScript runs through Vitest and tsx, exact JSON comparison with key order and round-trip floats, one-sided ids detected from run records of each side, a `harness` self-test module, CI on Linux only until packaging.

## 2. Design (`software-design`)

See `specs/006-m0-foundation/plan.md` (Project Structure, Constitution Check) and `data-model.md`. `docmapper-core` stays pure; `docmapper-desktop` is the driving adapter and composition root with one command (`core_version`); `docmapper-parity` is a development crate never used by the product. No port is defined yet (no use case needs one).

## 3. Affected surfaces and files

Surface `desktop` is created; `mcp` is untouched. New: `Cargo.toml`, `rust-toolchain.toml`, `crates/`, `parity/`, `.github/workflows/ci.yml`, `tests/MANUAL_TESTS.md`, two architecture pages. Changed: `frontend/package.json`, `frontend/vite.config.ts`, `.gitignore`, `.dev-cycle.json`, `README.md`, `docs/architecture/interface.md`, `TECDOC.md`.

## 4. Tests (`quality-assurance`)

See the "Tests" section of `specs/006-m0-foundation/plan.md`: Rust unit tests for the core, the command and every harness part (including all one-sided id cases), the oracle integration test and a property test, Vitest tests for the writer and the oracle, and two manual tests for the desktop window.

## 5. Documentation (`architecture-docs`, `user-docs`)

New `docs/architecture/parity.md` and `docs/architecture/desktop-shell.md`, `interface.md` edited, TECDOC index rebuilt, README "Development" section. No new ADR.

## 6. CI, release and observability (`devops-release`)

New `ci.yml` with jobs `rust`, `frontend`, `parity`; version 0.1.0 in `Cargo.toml` (`devops.version_files`). Release workflows (pre-release on `-rc` tags, promote) come before the first v0.1.0 candidate, proposed as a backlog item. Branch protection with the three checks is for the user to enable after the first green run.

## 7. Security, migration and rollback

No secrets, no data. The window gets `core:default` permissions only; the content security policy stays at the default until the network calls move to Rust (M8). Rollback: revert the pull request; the browser version is untouched.

## 8. Execution steps and milestones

1. `setup`: workspace, toolchain, configuration, frontend dev dependencies (tasks T001-T006).
2. `desktop-shell`: Tauri shell with the current interface (T007-T012).
3. `parity-harness`: writer, fixtures, oracle, runner, checker, self-test module (T013-T020).
4. `ci`: workflow green (T021-T022).
5. `docs`: architecture pages, README, manual tests, final checks (T023-T026).
