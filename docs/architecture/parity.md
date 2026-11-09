---
title: Parity Harness
summary: 'Fixtures, fixture writer, TypeScript oracle, Rust runner and id checker that prove each ported module gives the same outputs as the TypeScript code.'
code: [parity, crates/docmapper-parity]
---

# Parity Harness

Fixtures, fixture writer, TypeScript oracle, Rust runner and id checker that prove each ported module gives the same outputs as the TypeScript code (ADR-0003).

## Responsibilities

Records what the TypeScript code does for a set of inputs, checks that the Rust port does exactly the same, fuzzes both with random inputs, and fails CI when a case exists on one side only. It is a development tool: the product never depends on it, and it is removed with the last TypeScript module.

## Structure

- `parity/modules.json`: the module registry, each module `characterized` (TypeScript cases and fixtures exist) or `ported` (Rust must pass them).
- `parity/fixtures/<module>/<case>.json`: one case per file with `id`, `module`, `function`, `input` (the argument list) and either `output` or `error` (`name`, `message`); schema in `parity/fixture.schema.json`.
- `parity/oracle/modules.ts`: the module table, the functions the characterization tests and the oracle may call.
- `parity/writer`: the fixture writer (`fixture-writer.ts`) and its Vitest binding (`vitest-parity.ts`).
- `parity/oracle/main.ts`: the oracle process; `handler.ts` turns one request into one response.
- `parity/shared/outcome.ts`: calls a function and captures what it returned or threw; rejects values JSON cannot carry exactly (`undefined`, `NaN`, infinities, negative zero, class instances).
- `parity/selftest`: the `harness` self-test module and its cases.
- `crates/docmapper-parity`: `fixture` (reader and validation), `compare` (exact comparison), `runner` (runs a module's fixtures, writes the Rust run record), `oracle` (client of the oracle process), `registry`, `check` and the `parity-check` binary.

## Behavior

- **Characterization**: a `*.parity.test.ts` file declares cases with `parityModule(MODULES, '<module>').case(id, function, input)`. In check mode (default) each case fails when its outcome differs from the committed fixture or the fixture is missing; with `PARITY_UPDATE=1` it writes the fixture. After the run it writes the TypeScript run record `target/parity/ts/<module>.ids`.
- **Rust**: a module's parity test calls `runner::assert_module("<module>", |function, input| ...)`, which runs every fixture, panics with every difference (with the JSON path of the first difference) and writes `target/parity/rust/<module>.ids`.
- **Exact comparison**: object key order must match; numbers compare as the f64 value JavaScript holds (`3` equals `3.0`, negative zero differs from zero); errors compare by name and message. Fixtures are parsed with round-trip floats, so a number written by `JSON.stringify` reads back as the same f64.
- **Oracle**: newline-delimited JSON on stdio; request `{seq, module, function, input}`, response `{seq, output}`, `{seq, error}` or `{seq, failure}`. The Rust client starts it with Node.js (`PARITY_NODE`, default `node`) and the frontend's `tsx`; a failure, a malformed line, a wrong `seq` or the process exiting is an error, never a match. Tests share one process per test binary.
- **Id checker**: `parity-check` compares, per registered module, the committed fixture ids with the TypeScript run record and, for ported modules, with the Rust run record. It fails for an id missing from any required side, a missing run record, a registered module without fixtures, and a fixture folder not in the registry.

## Adding a module

1. Copy the module's reference TypeScript under `parity/` and add its functions to `parity/oracle/modules.ts`.
2. Write its characterization cases, run `PARITY_UPDATE=1 npm run test:parity --prefix frontend`, review and commit the fixtures, and add the module to `parity/modules.json` as `characterized`.
3. Port it to Rust, add its parity test with `assert_module` and a `proptest` property through the oracle (`#[ignore]`, run by the parity job), and mark it `ported`.

## Interfaces

- Reads the TypeScript code of the modules under migration; used by the Rust tests of the core.
- Run by the `parity` job of `.github/workflows/ci.yml`.
