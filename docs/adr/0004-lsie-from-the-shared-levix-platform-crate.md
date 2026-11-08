---
id: 4
title: LSIE from the shared levix-platform crate
status: accepted
date: '2026-11-08'
version: null
subsystems: [extraction]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0004: LSIE from the shared levix-platform crate

## Context

DocMapper's extractor (`spatial-extractor.ts`, about 550 lines) implements LSIE. The `lsie-algorithm` repository contains `lsie-rs`, a Rust implementation of the published LSIE-2D model (X/Y anchors, Jacobian anomaly gate), which is a different model from DocMapper's TypeScript. levix-platform plans a single shared LSIE crate (FEAT-022) and a common layout map format (FEAT-023) for every Levix product.

## Decision

- DocMapper uses the **shared LSIE crate in levix-platform**, built from `lsie-rs`; DocMapper opens that pull request in levix-platform and keeps it generic. No LSIE crate is created in this repository.
- DocMapper keeps only an adapter that converts a profile (`labelBox`, `valueBox`) to the common layout format, with exact parity for glyph normalization and the adapter.
- For extraction itself, the reference becomes the **expected value of each field in the corpus**, not the output of `spatial-extractor.ts`; every difference from today's results is reported and accepted by the product owner before the switch.

## Alternatives Considered

- **Translate `spatial-extractor.ts` line by line into a DocMapper crate**: exact parity, but a second LSIE implementation diverging from the published model and from the other products.
- **Keep the TypeScript extractor**: against the 100% Rust target.

## Consequences

- LSIE improvements reach every product through one crate, consumed by git tag.
- Module M4 is judged on corpus accuracy, not exact parity; a difference report is part of its acceptance.
