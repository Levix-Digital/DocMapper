---
id: 3
title: Module-by-module migration with the TypeScript code as parity oracle
status: accepted
date: '2026-11-08'
version: null
subsystems: [parity]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0003: Module-by-module migration with the TypeScript code as parity oracle

## Context

The product owner requires that the Rust code produce exactly the same outputs as the current code, module by module, with every test recreated in Rust. The repository has no automated tests and no Python code: the current behavior is defined only by the TypeScript and AssemblyScript sources (about 2,600 lines of logic at commit 3d22bcd).

## Decision

- The current TypeScript is the **parity oracle**: no behavior is corrected during the migration. A bug found on the way goes to the backlog and is ported as it is; the fix comes later.
- Each module follows five steps: (a) characterization tests in TypeScript (Vitest, full branch coverage for pure modules) that write golden fixtures `parity/fixtures/<module>/<case>.json` with `{input, output}`; (b) port to Rust; (c) Rust tests over the same fixtures with exact equality, plus differential fuzzing (`proptest` against a Node oracle process); (d) wiring in the app behind a switch, with a shadow mode that runs both and logs differences; (e) final switch and removal of that module's TypeScript.
- A checker fails CI when a fixture id exists on only one side.
- `parity/` keeps a frozen copy of the reference TypeScript, outside the app, until the last module is switched; the fixtures then remain as ordinary Rust tests.
- Module order: M0 foundation, M1 text utilities, M2 CMR core, M3 types and profiles, M4 LSIE, M5 PDF reading, M6 batch, M7 stamping, M8 network services, M9 licensing and policy enforcement, M10 packaging.
- Known JavaScript semantics are reproduced explicitly: f64 arithmetic in the same order, stable sorting, UTF-16 string indexing in the parsers, ECMAScript whitespace and case rules, ECMAScript regular expressions (`regress` crate), key order of objects, JavaScript number formatting (`ryu-js`), injected clock and id generator.

## Alternatives Considered

- **Rewrite from the specifications**: no way to prove the same outputs; rejected by the product owner.
- **Port everything at once**: one very large change with no intermediate checkpoints.

## Consequences

- Every module switch is proven by fixtures, fuzzing and shadow mode before the TypeScript is removed.
- Exceptions where byte equality is impossible are decided separately: LSIE (ADR-0004), PDF reading (ADR-0009) and stamped PDFs (compared by drawn content, decoded barcodes and rendered pixels).
