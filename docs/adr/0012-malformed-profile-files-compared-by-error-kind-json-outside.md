---
id: 12
title: Malformed profile files compared by error kind; JSON outside Rust strings and f64 refused
status: accepted
date: '2026-11-09'
version: null
subsystems: [profiles, parity]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0012: Malformed profile files compared by error kind; JSON outside Rust strings and f64 refused

## Context

ADR-0003 requires the Rust port of each module to give exactly the outputs of the TypeScript code. `importProfileFromDocMapper` reads a `.dmap` file with `JSON.parse`; for text that is not JSON it throws a `SyntaxError` whose message is V8's (`Unexpected end of JSON input`, `Expected property name or '}' in JSON at position 1 (line 1 column 2)` and about twenty other forms), and the profile management screen shows that message in its import alert. The Rust core reads JSON with `serde_json`, whose messages differ. Two inputs JavaScript accepts cannot be held by the Rust reader at all: a lone UTF-16 surrogate escape (`"\ud800"`; Rust strings are valid Unicode) and a number beyond the f64 range (`1e400`, which JavaScript turns into `Infinity` and then stores as `null`). No real `.dmap` file holds either: both sides write only valid Unicode and finite numbers.

## Decision

- For `importProfileFromDocMapper` (Rust: `ProfileStore::import_docmapper`), parity compares a malformed file by the error name `SyntaxError` only; the message is the Rust reader's, with line and column. The parity test of the `profiles` module replaces the message of a `SyntaxError` by a fixed marker on both sides before the exact comparison (as ADR-0010 does for pattern errors).
- Text holding a lone surrogate escape or a number beyond the f64 range is refused by the Rust side as a `SyntaxError`. These inputs are left out of fixtures and fuzzing, as M1 left out lone surrogates.
- Every other output and error of the module keeps exact equality: the invalid file error, the type errors and the stored profiles.

## Alternatives Considered

- **A JSON reader that reproduces V8's messages and positions**: a parser written to another engine's wording, to change only the text of an alert.
- **A string model that holds lone surrogates in the core**: every part of the core would pay for an input no real file has.
- **Accept `1e400` and store `null` as JavaScript does**: keeps a silent data change the Rust side has no reason to copy; refusing the file is visible and safe.

## Consequences

- After the switch, the import alert for a malformed file shows the Rust message; the error kind is the same.
- A file with a lone surrogate escape or an out-of-range number is refused instead of imported with altered text or `null`.
- Verified by the `profiles` fixtures (`import-malformed`, `import-empty-text`, `import-trailing-text`), the unit tests of the core reader and the `import_matches_typescript` property.
