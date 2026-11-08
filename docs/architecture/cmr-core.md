---
title: CMR Core
summary: AssemblyScript module compiled to WebAssembly that parses CMR text by keywords.
code: [frontend/src/modules/core-wasm, frontend/src/services/WasmService.ts]
---

# CMR Core

AssemblyScript module compiled to WebAssembly that parses CMR text by keywords.

## Responsibilities

Owns keyword-based parsing of CMR text into structured data, compiled from AssemblyScript to WebAssembly. It does not read PDFs.

## Structure

- `frontend/src/modules/core-wasm/assembly/index.ts`: `processDocument(docType, content)`, returning JSON as text.
- `parsers/cmr.ts` with the `DocumentParser` interface, and the utilities `scanner.ts`, `cleaning.ts` and `dates.ts`.
- `frontend/src/services/WasmService.ts` loads the compiled module in the browser and calls it.

## Behavior

- A factory picks the parser for the document type (`CMR`); an unknown type returns a structured error.
- The CMR parser scans the text for known labels and returns the values as a JSON string.

## Interfaces

- Called through `WasmService` by the interface.

## Decisions

- [ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md): ported in module M2 with byte-identical JSON output.
