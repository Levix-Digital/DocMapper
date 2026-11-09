# Implementation Plan: M1 Text utilities: characterization and Rust port with ECMAScript semantics

**Branch**: `feat/007-m1-text-utilities` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-m1-text-utilities/spec.md`

## Summary

Characterize and port the four pure text utilities of the application (`formatOutputFileName`, `testRegexPattern`, `flattenDictionary`, `sanitizePunctuation`) as the parity module `text`: a frozen TypeScript copy under `parity/text/` with characterization tests at 100% branch coverage writing the fixtures; Rust twins in `docmapper-core` (`text` module) built on a small ECMAScript-semantics layer (whitespace, trim, case, replacement patterns, string length limit, property order, value to text) and on `regress` for patterns; Rust fixture tests and `proptest` differential fuzzing through the oracle; the module registered as `ported`. The application is not wired to the Rust code in this milestone (spec assumptions).

## Technical Context

**Language/Version**: Rust 1.97.0 (edition 2021, `rust-toolchain.toml`); TypeScript 5.9 on Node.js 22 for the reference copy and the oracle

**Primary Dependencies**: new in `docmapper-core`: `regress` 0.12 (feature `utf16`), `ryu-js` 1, `serde_json` (workspace, `preserve_order`, `float_roundtrip`); new frontend dev dependency `@vitest/coverage-v8` (same major as Vitest); existing `proptest` in the parity crate

**Storage**: N/A (fixtures in `parity/fixtures/text`)

**Testing**: `cargo test --workspace`; Vitest parity project with branch coverage; `proptest` through the Node oracle in the parity job; `parity-check`

**Target Platform**: library code in the core, built for every desktop target; tests on Ubuntu in CI

**Project Type**: desktop app (Tauri shell over a Rust library core)

**Performance Goals**: each utility well under 1 ms per call for inputs of translation and file-name size (no regex compiled per call in the file-name formatter); parity job under 5 minutes (SC-004)

**Constraints**: exact parity (ADR-0003) except the invalid-pattern message (FR-008); no forbidden core import; no change in the application interface

**Scale/Scope**: about 600 lines of Rust in the core, 400 lines of Rust tests, 300 lines of TypeScript cases, 1 ADR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Design | One file per utility plus one for ECMAScript semantics and one for property order; errors are typed enums with the input in context; no `unwrap` on input | Pass |
| II. Simplicity first | No port or trait: the date is a parameter until the batch use case needs a clock (M6); no general JavaScript runtime, only the algorithms the four utilities use | Pass |
| III. Hexagonal | Pure domain code in `docmapper-core`; `regress`, `ryu-js` and `serde_json` are libraries, not frameworks or drivers, and none is in `forbidden_core_imports`; JavaScript error texts stay in the parity tests | Pass |
| IV. Development cycle | Plan with tests, docs, CI and rollback sections; defects go to the backlog; no attribution in artifacts | Pass |
| Parity (ADR-0003) | Steps a to c for the module; one exception (FR-008) recorded in a new ADR as ADR-0003 requires for exceptions | Pass (with the ADR) |
| Final target 100% Rust | No runtime dependency outside Rust; Node.js only in development | Pass |

Post-design re-check: Pass (Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/007-m1-text-utilities/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/core-text-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
crates/docmapper-core/
├── Cargo.toml                       # + regress (utf16), ryu-js, serde_json
└── src/
    ├── lib.rs                       # + pub mod text
    └── text/
        ├── mod.rs                   # public API of the four utilities
        ├── ecmascript.rs            # whitespace, trim, lower case, UTF-16 length, pad_start, GetSubstitution
        ├── property_map.rs          # PropertyMap: ECMAScript property order, __proto__ rule
        ├── js_value.rs              # String(value) for JSON values (ryu-js numbers, arrays, objects)
        ├── file_name.rs             # FileNameOptions, CalendarDate, FileNameError, format_output_file_name
        ├── validation_pattern.rs    # check_validation_pattern, legacy pattern normalization
        └── translation.rs           # flatten_dictionary, sanitize_punctuation
crates/docmapper-parity/
├── src/runner.rs                    # + assert_module_with (normalization before the exact comparison)
└── tests/text.rs                    # fixture test, error mapping to JavaScript, proptest properties
parity/
├── text/                            # frozen TypeScript copy (from f38b9e9) + clock wrapper
│   ├── filename-formatter.ts
│   ├── validation-pattern.ts
│   ├── translation-text.ts
│   ├── fixed-clock.ts
│   └── text.parity.test.ts          # characterization cases
├── oracle/modules.ts                # + text table
├── modules.json                     # + "text": "ported"
└── fixtures/text/*.json             # generated, reviewed, committed
frontend/package.json, vitest.config.ts   # + @vitest/coverage-v8, coverage of parity/text at 100% branches
```

**Structure Decision**: the utilities live in one core module `text` because they share the ECMAScript layer; the TypeScript copy follows the parity layout of M0 (`parity/<module>/`).

## Complexity Tracking

None.

## Dev Cycle Protocol

### Backlog items and release

FEAT-005 and FEAT-006 (epic EPIC-002), release v0.1.0 Desktop core. Low bugs kept for parity (ADR-0003) and fixed after each switch: BUG-001 (a pattern token naming an inherited object member throws) and BUG-002 (`$` patterns in the original file name are interpreted) in v0.2.0 with M6, as accepted by the product owner; BUG-003 (found by fuzzing: a dictionary array holding an object with a `toString` key throws) in v0.3.0 with M8.

### Tests (quality-assurance)

- TypeScript: characterization cases for every branch of the four functions and every edge case of the spec (about 60 cases), with coverage of `parity/text/**` at 100% branches enforced by the Vitest threshold.
- Rust unit tests in the core: each ECMAScript helper (whitespace set against the spec list, `trim`, final sigma and `İ`, `pad_start` limit, every `GetSubstitution` form), `PropertyMap` order and `__proto__` rule, value to text (`1e21`, `0.1`, `-1e-7`, integers above 2^53, nested arrays), `CalendarDate` (epoch, leap days, 9999-12-31), pattern normalization (`\u{61}`, `\\u{61}`, `[\u{61}]`, `a`).
- Rust parity tests: `text` fixtures with exact comparison (with the FR-008 normalization for `testRegexPattern`); four `proptest` properties through the oracle, 256 cases each, `#[ignore]` and run by the parity job.
- Parity crate: unit test of `assert_module_with`.
- Manual tests: none added; the utilities have no interface of their own in this milestone, and the curated suite is unchanged.
- Acceptance: every acceptance scenario of the spec; all CI jobs green; `check_design` passes.

### Documentation (architecture-docs, user-docs)

- New subsystem page `docs/architecture/text-utilities.md` (the four utilities, the ECMAScript layer, known kept defects, where they are wired later); `docs/architecture/parity.md` edited (module `text`, `assert_module_with` and normalization); `docs/architecture/localization.md` and `docs/architecture/batch.md` link to it; `TECDOC.md` index rebuilt.
- New ADR: "Validation pattern errors compared by presence, not by message" (exception to ADR-0003 exact equality, alternatives from research).
- README: no change (no user-visible change).

### CI, release and observability (devops-release)

- No workflow change: the `parity` job already runs `npm run test:parity` (now with coverage), the ignored Rust tests and `parity-check`; the `rust` job runs the core tests.
- Version: no bump; 0.1.0 is not released yet and this work is part of it.
- Observability: none; pure functions with no I/O. Logging comes with the wiring in M6 and M8 (shadow mode logs differences).

### Security, migration and rollback

- No secrets, no data, no migration. Validation patterns come from profiles and the user: `regress` compiles them without a backtracking limit, as V8 does today; a limit is a later decision when the batch use case runs in Rust (noted in the subsystem page).
- Rollback: revert the pull request; nothing in the application uses the Rust code yet.
