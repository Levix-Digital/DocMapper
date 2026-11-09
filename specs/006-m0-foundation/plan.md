# Implementation Plan: M0 Foundation: Cargo workspace, desktop shell, parity harness and CI

**Branch**: `feat/006-m0-foundation` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-m0-foundation/spec.md`

## Summary

Create the Rust side of the repository without moving any logic yet: a Cargo workspace with `docmapper-core` (pure, no dependencies besides serialization) and `docmapper-desktop` (Tauri 2 shell and composition root) that opens the current Vue interface unchanged; a parity harness (`parity/` plus the `docmapper-parity` dev crate) with one fixture format, a TypeScript fixture writer for Vitest, a Node oracle process, a Rust fixture runner and oracle client, and an id checker; and a GitHub Actions workflow running Rust, TypeScript and parity checks on every pull request. A self-test module (`harness`) proves the harness end to end before M1.

## Technical Context

**Language/Version**: Rust 1.97.0 (pinned in `rust-toolchain.toml`, edition 2021); TypeScript 5.9 on Node.js 22 for the interface and the oracle

**Primary Dependencies**: `tauri` 2.x and `tauri-build` 2.x (desktop crate only); `serde` and `serde_json` with `preserve_order` and `float_roundtrip` (parity crate); `proptest` (dev dependency of the parity crate); Vitest 4 and `tsx` 4 (frontend dev dependencies); `@tauri-apps/cli` 2.x (frontend dev dependency, runs the desktop app)

**Storage**: N/A (fixtures are files in `parity/fixtures`)

**Testing**: `cargo test --workspace`; Vitest for the TypeScript side; the parity checker binary

**Target Platform**: Windows 10+, macOS 12+, Linux x64 (Ubuntu 22.04+) for the desktop app; CI on Ubuntu only in this milestone

**Project Type**: desktop app (Tauri shell over a Rust library core) with a temporary web interface

**Performance Goals**: CI under 20 minutes (SC-005); the parity run of a module under 1 minute

**Constraints**: no behavior change in the interface; the core imports nothing in `forbidden_core_imports`; no new runtime dependency in the product besides the Tauri shell (Node.js only for development)

**Scale/Scope**: 3 crates, 1 workflow, about 1,000 lines of harness code and tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Design: one responsibility per unit, explicit errors | Core, shell and harness are separate crates; the harness splits fixture model, runner, oracle client and checker into modules; every harness error carries the file path or the request | Pass |
| II. Simplicity first | No port is defined in M0 (no use case needs one yet); the shell has one command; the oracle protocol is newline-delimited JSON over stdio, no server | Pass |
| III. Hexagonal | `crates/docmapper-core` has no framework or driver dependency; the desktop crate is the driving adapter and composition root; the parity crate is a development tool, never a dependency of the core or the shell | Pass |
| IV. Development cycle | Plan with tests, docs, CI and rollback sections below; no attribution in artifacts | Pass |
| Parity (ADR-0003, TECH_SPEC constraints) | No behavior change; harness implements the five-step rule's tooling | Pass |
| Final target 100% Rust | Node.js used only for development (interface build, oracle), allowed during the migration | Pass |

Post-design re-check: Pass (no new violations; Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/006-m0-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── fixture.schema.json
│   ├── oracle-protocol.md
│   └── desktop-commands.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
Cargo.toml                      # workspace: members, shared package metadata, version 0.1.0
rust-toolchain.toml             # 1.97.0 with rustfmt and clippy
crates/
├── docmapper-core/             # domain (empty in M0 except the version); no forbidden imports
│   └── src/lib.rs
├── docmapper-desktop/          # Tauri 2 shell: composition root and commands
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json         # devUrl http://localhost:5173, frontendDist ../../frontend/dist
│   ├── capabilities/default.json
│   ├── icons/
│   └── src/{main.rs,lib.rs,commands.rs}
└── docmapper-parity/           # development tool, publish = false
    └── src/{lib.rs,fixture.rs,runner.rs,oracle.rs,registry.rs,check.rs,bin/parity-check.rs}
parity/
├── modules.json                # module registry: name -> characterized | ported
├── fixtures/<module>/<case>.json
├── oracle/                     # Node oracle (TypeScript, run with tsx)
│   ├── main.ts
│   └── modules.ts              # module name -> function table
├── writer/fixture-writer.ts    # used by Vitest characterization tests
└── selftest/                   # the 'harness' self-test module (TS reference + Vitest cases)
frontend/
├── package.json                # + vitest, tsx, @tauri-apps/cli; scripts test, test:parity, tauri
├── vite.config.ts              # + fixed dev port, test config
└── vitest.config.ts
.github/workflows/ci.yml        # rust, frontend, parity jobs
target/parity/{ts,rust}/<module>.ids   # run records (not committed)
```

**Structure Decision**: workspace at the repository root with crates under `crates/` as `.dev-cycle.json` (`architecture.core_path`) and ADR-0002 set; the interface stays in `frontend/`; everything about parity lives under `parity/` (data and TypeScript) and `crates/docmapper-parity` (Rust), so both are removed together after the last module switches.

## Complexity Tracking

None.

## Dev Cycle Protocol

### Backlog items and release

FEAT-001, FEAT-002, FEAT-003, FEAT-004 (epic EPIC-001), release v0.1.0 Desktop core.

### Tests (quality-assurance)

- Rust: core version test; desktop command test (`core_version` returns the core version, without a window); parity crate unit tests for fixture parsing (valid, invalid JSON, missing fields, output and error both or neither), exact comparison (key order, numbers, error name and message), the runner's run record, the registry, and the checker for every one-sided case (SC-003); an oracle client test against the real Node oracle with the self-test module (marked `#[ignore]`, run by the parity job with `--ignored`), plus a `proptest` property over the self-test module through the oracle.
- TypeScript: Vitest tests for the fixture writer (update mode writes, check mode fails on difference, error cases) and for the oracle request handling; the self-test module's characterization tests that write its fixtures.
- Manual tests (curated suite `tests/MANUAL_TESTS.md`, created): "Desktop app opens the current interface" and "Main flows behave the same in the desktop app and in the browser" (SC-002), for Linux, Windows and macOS; these cannot be automated before packaging (M10).
- Acceptance: every acceptance scenario of the spec; all CI jobs green; `check_design` passes.

### Documentation (architecture-docs, user-docs)

- New subsystem page `docs/architecture/parity.md` (harness: fixture format, writer, oracle, runner, checker, registry, how to add a module) and `docs/architecture/desktop-shell.md` (workspace layout, shell, commands, capabilities, dev and release modes); `docs/architecture/interface.md` edited for the desktop window; `TECDOC.md` index rebuilt.
- No new ADR: the decisions are already in ADR-0001, ADR-0002 and ADR-0003; the choices below (oracle over stdio, tsx, ids in run records) are recorded in `research.md` and the parity page.
- README: new "Development" section (prerequisites, desktop app, browser version, tests, parity fixtures).

### CI, release and observability (devops-release)

- New `.github/workflows/ci.yml` on `pull_request` into `main` and `push` to `main`, concurrency that cancels superseded runs of a pull request, `contents: read`. Jobs: `rust` (system packages for Tauri on Ubuntu, `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`), `frontend` (`npm ci`, AssemblyScript build, `npm run build`, `npm test`), `parity` (Vitest parity run writing TypeScript run records in check mode, `cargo test -p docmapper-parity -- --include-ignored`, `parity-check`).
- `devops.version_files` set to `["Cargo.toml"]`, workspace version `0.1.0` (minor for the first desktop release). The release workflows (pre-release on `-rc` tags and the promote workflow) are not part of M0; they are proposed as a backlog item for v0.1.0, before its first candidate.
- Branch protection on `main` (required checks `rust`, `frontend`, `parity`) is a repository setting for the user to enable after the first green run.
- Observability: the shell logs start-up and command errors to stderr in M0; structured logs come with the first ported module.

### Security, migration and rollback

- No secrets; no data migration. The desktop window gets only `core:default` permissions (FR-005); content security policy stays at the default until M8 (spec assumptions).
- Rollback: revert the pull request; the browser version is untouched, so nothing else depends on this change.
