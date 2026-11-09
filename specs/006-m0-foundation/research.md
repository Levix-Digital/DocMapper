# Research: M0 Foundation

## Desktop shell: Tauri 2 over the existing Vite build

- **Decision**: `crates/docmapper-desktop` with `tauri` 2.x; `devUrl` points to the Vite dev server on a fixed port (5173, `strictPort`), `frontendDist` to `frontend/dist`; `beforeDevCommand` and `beforeBuildCommand` run the frontend scripts. The Tauri CLI comes from the `@tauri-apps/cli` dev dependency of the frontend (`npm run tauri dev`).
- **Rationale**: no change in the interface code; the browser build keeps its own scripts; the CLI from npm avoids a `cargo install` step while Node.js is a development prerequisite anyway.
- **Alternatives considered**: `cargo install tauri-cli` (slower set-up, a second way to run things); moving the frontend into the crate (breaks the browser build).

## Oracle process

- **Decision**: a Node.js process (`tsx parity/oracle/main.ts`) reading newline-delimited JSON requests on stdin and writing one response line per request on stdout; the Rust client starts it once per test binary and reuses it.
- **Rationale**: simple, no ports, no server; one process per test run keeps fuzzing fast (thousands of cases per second).
- **Alternatives considered**: a local HTTP server (ports, start-up races); spawning Node per case (too slow for fuzzing); embedding a JavaScript engine in Rust (would not run the real Vite/TypeScript code paths).

## Running TypeScript outside Vite

- **Decision**: `tsx` for the oracle; Vitest for characterization tests.
- **Rationale**: both run the TypeScript sources as they are, with the same module resolution; Vitest shares the Vite configuration.
- **Alternatives considered**: compiling with `tsc` first (an extra build step and output folder).

## Exact comparison of JSON values

- **Decision**: `serde_json` with `preserve_order` (key order) and `float_roundtrip` (numbers parse to the same f64 JavaScript wrote); comparison of `serde_json::Value` including the order of object keys.
- **Rationale**: ADR-0003 requires key order and f64 values to match; `JSON.stringify` writes the shortest round-trip form, which `float_roundtrip` parses exactly.
- **Alternatives considered**: comparing serialized strings (fails on whitespace and equivalent number spellings); tolerance on numbers (forbidden by ADR-0003 outside LSIE and PDF reading).

## Detecting one-sided ids

- **Decision**: each side writes a run record `target/parity/<side>/<module>.ids` (one id per line) during its test run; `parity-check` compares, per module of `parity/modules.json`, the committed fixture ids with the TypeScript record (always) and with the Rust record (only for modules marked `ported`).
- **Rationale**: catches a fixture without its TypeScript case (stale), a TypeScript case without a committed fixture (not updated), and a ported module whose Rust tests skip fixtures; no list of ids is maintained by hand.
- **Alternatives considered**: hand-written id lists in Rust tests (drift); only comparing files with TypeScript cases (misses the Rust side).

## Self-test module

- **Decision**: `parity/selftest/harness.ts` with two small pure functions (one returning an object with ordered keys and floats, one that throws for some inputs) and their Rust twins in the parity crate's tests.
- **Rationale**: proves writer, fixtures, runner, oracle, fuzzing and checker end to end, before any real module.
- **Alternatives considered**: waiting for M1 (the harness would be debugged together with the first real port).

## Continuous integration

- **Decision**: one GitHub Actions workflow with three jobs on `ubuntu-24.04`, Rust cache by `Swatinem/rust-cache`, npm cache by `actions/setup-node`; Tauri system packages (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`) installed in the jobs that build the desktop crate.
- **Rationale**: Linux is enough to keep the workspace, the interface and parity green; other platforms come with packaging (M10).
- **Alternatives considered**: a matrix over three operating systems now (three times the minutes for no parity benefit yet).
