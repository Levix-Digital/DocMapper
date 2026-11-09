---
id: 10
title: Validation pattern errors compared by presence, not by message
status: accepted
date: '2026-11-09'
version: null
subsystems: [text-utilities, parity]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0010: Validation pattern errors compared by presence, not by message

## Context

ADR-0003 requires the Rust port of each module to give exactly the outputs of the TypeScript code. `testRegexPattern` returns `{matches, error?}`, and for an invalid pattern `error` holds the message of the JavaScript engine (V8: `Invalid regular expression: /(/: Unterminated group`). The Rust port uses the `regress` crate (named by ADR-0003), whose messages differ (`Unbalanced parenthesis`). V8 and `regress` agree on which patterns are invalid (checked by fixtures and differential fuzzing), but not on the words. No caller reads `error`: `mapping-runner.ts` and `gemini-service.ts` read only `matches`.

## Decision

- For `testRegexPattern` (Rust: `check_validation_pattern`), parity compares `matches` and the presence of `error` exactly; the text of `error` is not compared. The Rust value is the `regress` message.
- The parity test of the `text` module replaces the value of `error`, when present, by a fixed marker on both sides before the exact comparison (`assert_module_with` in `crates/docmapper-parity/src/runner.rs`), so a missing or extra error still fails.
- Every other output and error of the module keeps exact equality, names and messages included.

## Alternatives Considered

- **Map each `regress` error to the V8 text**: brittle; for a pattern with several errors V8 and `regress` can report a different one first, and the mapping would follow every engine change.
- **A fixed message on both sides**: changes the TypeScript behavior during the migration, against ADR-0003.
- **Embed a JavaScript engine**: adds a runtime dependency the 100% Rust target (ADR-0001) rules out.

## Consequences

- An invalid validation pattern reports a different message after the switch; nothing shows it today.
- If a later feature shows the message to users, it uses the Rust text; this ADR does not need to change.
- Verified by the `text` fixtures (`pattern-invalid-*`) and the `test_regex_pattern_matches_typescript` property.
