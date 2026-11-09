# Implementation Plan: M3 Profiles: characterization, Rust profile store and local SQLite repository

**Branch**: `feat/008-m3-profiles-storage` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-m3-profiles-storage/spec.md`

## Summary

Characterize the profile store of the interface (`profile-store.ts`) as the parity module `profiles`: a frozen copy under `parity/profiles/` with an in-memory browser storage stub, a ticking clock and a scripted random source, and cases at 100% branch coverage of the ported part. Port it to a `profiles` module of `docmapper-core`: ordered profile documents, a typed read model, the `Clock`, `RandomSource` and `ProfileRepository` ports, the store operations, the `.dmap` export writer and the import. Add the adapter crate `docmapper-sqlite` (rusqlite, WAL, additive migrations). Every fixture runs on the in-memory and the SQLite repository; `proptest` differential fuzzing goes through the oracle. The interface is not wired in this milestone (spec assumptions).

## Technical Context

**Language/Version**: Rust 1.97.0 (edition 2021); TypeScript 5.9 on Node.js 22 for the reference copy and the oracle

**Primary Dependencies**: core: none new (`serde_json`, `ryu-js` from M1; `serde` derive from the workspace for the typed model); new crate `docmapper-sqlite`: `rusqlite` 0.41 (feature `bundled`), dev `tempfile` 3; parity crate dev: `docmapper-sqlite`

**Storage**: local SQLite file (WAL), schema version 1

**Testing**: `cargo test --workspace`; Vitest parity project with branch coverage; `proptest` through the Node oracle in the parity job; `parity-check`

**Target Platform**: library code built for every desktop target; tests on Ubuntu in CI

**Project Type**: desktop app (Tauri shell over a Rust library core and adapters)

**Performance Goals**: listing 1,000 profiles from SQLite under 100 ms (SC-004); one statement per repository call

**Constraints**: exact parity (ADR-0003) except FR-009; no forbidden core import; no change in the interface

**Scale/Scope**: about 900 lines of Rust (core and adapter), 600 lines of Rust tests, 400 lines of TypeScript cases, 1 ADR

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. Design | One responsibility per file (document, model, ports, JavaScript helpers, store, export writer, memory repository; adapter: connection, migrations, repository); typed errors; no `unwrap` on input or stored data | Pass |
| II. Simplicity first | Three small ports the backlog asks for (clock, random, repository); no generic JavaScript runtime; one SQLite table with the document as JSON, more tables only when a query needs them | Pass |
| III. Hexagonal | Domain and ports in `docmapper-core`; `rusqlite` only in `docmapper-sqlite`, which depends on the core; `check_design` keeps `rusqlite` out of the core | Pass |
| IV. Development cycle | Plan with tests, docs, CI and rollback sections; defects to the backlog; no attribution | Pass |
| Parity (ADR-0003) | Steps a to c; one exception (FR-009) recorded in a new ADR; the unused built-in profile left out as ADR-0011 did for the CMR core | Pass (with the ADR) |
| Storage (ADR-0006) | Profiles read through `ProfileRepository`; local SQLite adapter; PostgreSQL later as another adapter | Pass |
| Final target 100% Rust | SQLite is compiled into the binary (`bundled`), no runtime dependency; Node.js only in development | Pass |

Post-design re-check: Pass (Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/008-m3-profiles-storage/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/core-profiles-api.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
Cargo.toml                               # + member crates/docmapper-sqlite, workspace deps rusqlite, tempfile
crates/docmapper-core/src/
├── lib.rs                               # + pub mod profiles
├── text/ecmascript.rs                   # + number_to_radix_string (V8 DoubleToRadixCString)
└── profiles/
    ├── mod.rs                           # public API
    ├── document.rs                      # ProfileDocument, object spread
    ├── model.rs                         # typed MappingProfile read model
    ├── ports.rs                         # Clock, RandomSource, ProfileRepository, RepositoryError
    ├── js.rs                            # strict equality, truthiness, property read, V8 type error texts
    ├── json_text.rs                     # JSON.stringify(value, null, 2)
    ├── store.rs                         # ProfileStore operations, StoreError
    ├── export.rs                        # export_docmapper, file name sanitization
    ├── memory.rs                        # InMemoryProfileRepository
    └── system.rs                        # SystemClock, StdRandom
crates/docmapper-sqlite/
├── Cargo.toml
└── src/{lib.rs, migrations.rs, repository.rs}
crates/docmapper-parity/tests/profiles.rs  # fixtures on both repositories, error mapping, proptest properties
parity/profiles/
├── profile-store.ts                     # frozen copy (from 60a4b51, built-in factory removed)
├── harness.ts                           # storage stub, ticking clock, scripted random, operation wrappers
└── profiles.parity.test.ts              # characterization cases and browser-only stub tests
parity/oracle/modules.ts, parity/modules.json, parity/fixtures/profiles/*.json
frontend/vitest.config.ts                # + parity/profiles in coverage
```

**Structure Decision**: the store logic is domain code in the core; the SQLite adapter is its own crate so the core and later adapters (PostgreSQL in v0.3.0) never link SQLite.

## Complexity Tracking

None.

## Dev Cycle Protocol

### Backlog items and release

FEAT-009, FEAT-010 and FEAT-011 (epic EPIC-004), release v0.1.0 Desktop core. Two low bugs to capture (research R8), fixed after the switch. New feature item in v0.1.0: wiring the interface to the Rust store through application commands with shadow mode, then removing the browser store (ADR-0003 steps d and e); FEAT-013 follows it.

### Tests (quality-assurance)

- TypeScript: characterization cases for every branch of the ported operations and every edge case of the spec (about 70 cases), coverage of `parity/profiles/**` at 100% branches; stub tests for the browser-only branches.
- Rust unit tests: object spread, strict equality, truthiness, V8 type error texts, `number_to_radix_string` (values checked against Node), `JSON.stringify` writer (empty containers, nesting, escapes, `1e+21`, `-1e-7`), export file name (BMP and non-BMP), typed model reading the fixtures' profiles, ISO times.
- SQLite adapter tests: create, reopen, order kept across save, replace and delete; WAL mode; migration from an empty file; a newer `user_version` refused without writes; corrupt row reported; pinned SQL of migration 1; 1,000-profile listing time.
- Rust parity tests: `profiles` fixtures with exact comparison on both repositories (FR-009 normalization for `SyntaxError`); `proptest` properties through the oracle (create, save, delete, duplicate, import, export), 256 cases each, `#[ignore]` and run by the parity job.
- Manual tests: none added; no interface change.

### Documentation (architecture-docs, user-docs)

- `docs/architecture/profiles.md` rewritten for today (Rust store, ports, SQLite adapter, browser store until the switch; coordinates 0 to 100; `.dmap` with legacy `.docmapper`); `parity.md` gains the `profiles` module; `TECDOC.md` rebuilt.
- New ADR: "Malformed profile files compared by error kind; JSON outside Rust strings and f64 refused" (extends ADR-0010's rule to `SyntaxError`).
- README: no change.

### CI, release and observability (devops-release)

- No workflow change: the `rust` job builds the new crate (SQLite is compiled from the bundled source, a few seconds); the `parity` job runs the new tests.
- Version: no bump (part of v0.1.0, not released).
- Observability: repository errors are typed and carry the row position; logging comes with the wiring item.

### Security, migration and rollback

- No secrets. The database file holds the customer's profiles on the customer's computer (TECH_SPEC). SQL uses bound parameters only.
- Migration: schema version 1 is new; later steps are only added; a newer database is refused, never downgraded.
- Rollback: revert the pull request; nothing in the application uses the Rust code yet.
