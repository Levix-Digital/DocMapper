---
title: Text Utilities
summary: ECMAScript-exact Rust twins of the file name, validation pattern and dictionary helpers.
code: [crates/docmapper-core/src/text, parity/text]
---

# Text Utilities

ECMAScript-exact Rust twins of the file name, validation pattern and dictionary helpers.

## Responsibilities

Owns four pure text functions of the core, each giving exactly what its TypeScript original gives (parity module `text`, migration module M1): output file names, validation pattern checks, dictionary flattening and punctuation alignment. It owns the ECMAScript rules they depend on. It does not run batches (Batch Processing) or translate (Localization); those call it once they move to Rust.

## Structure

- `crates/docmapper-core/src/text/file_name.rs`: `format_output_file_name(&FileNameOptions, CalendarDate)`, twin of `formatOutputFileName`. Steps in the TypeScript order: `{originalName}` (with `$` replacement patterns), `{seq}` and `{seq:N}`, `{index}`, `{date}`, field tokens (exact key, then the first key equal ignoring case), then illegal characters, white space and edges, then `.pdf`. Errors: `FileNameError::InheritedMemberToken` and `FileNameError::StringTooLong`.
- `crates/docmapper-core/src/text/validation_pattern.rs`: `check_validation_pattern(pattern, candidate)`, twin of `testRegexPattern`, on `regress` over UTF-16 code units, with the legacy rewrites and early errors listed under Behavior.
- `crates/docmapper-core/src/text/translation.rs`: `flatten_dictionary(&Map, prefix)` and `sanitize_punctuation(source, translated)`, twins of `flattenDictionary` and `sanitizePunctuation`.
- `crates/docmapper-core/src/text/ecmascript.rs`: white space set, `trim`, lower case, UTF-16 length, `pad_start` with the V8 maximum string length, `GetSubstitution`.
- `crates/docmapper-core/src/text/property_map.rs`: `PropertyMap`, keys in ECMAScript property order (array indexes first), `__proto__` assignment rule.
- `crates/docmapper-core/src/text/js_value.rs`: `String(value)` for JSON values, numbers through `ryu-js`.
- `parity/text/`: the frozen TypeScript copies, the fixed clock and the characterization cases.

## Behavior

- **Clock**: the `{date}` token takes a `CalendarDate` (UTC, 1970 to 9999) from the caller; no clock port until a use case needs one.
- **Patterns**: compiled without flags and matched over UTF-16 code units, as JavaScript does without the `u` flag. Before compiling, the pattern is rewritten where `regress` reads legacy syntax differently: `\u` without four hex digits is the letter `u`; a `\uHHHH` surrogate escape is passed as one raw code unit; `\c` without a control letter is a literal backslash. Two errors V8 reports and `regress` accepts are checked first: a quantified `\b` or `\B`, and a repeated capture group name. The message of an invalid pattern comes from `regress` (ADR-0010). Patterns compile with no backtracking limit, as in V8 today.
- **Defects kept for parity** (ADR-0003, in the backlog to fix after the switch): a field token naming an inherited object member (`{toString}`) throws; `$` patterns in the original file name are expanded; a dictionary array holding an object with a `toString` key throws.

## Interfaces

- Used by the parity tests (`crates/docmapper-parity/tests/text.rs`) today; by Batch Processing (M6) and Localization (M8) when they move to Rust, with the shadow mode of ADR-0003.

## Decisions

- [ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md): TypeScript as parity oracle, `regress`, `ryu-js`, injected clock.
- [ADR-0010](../adr/0010-validation-pattern-errors-compared-by-presence-not-by-messag.md): invalid pattern messages compared by presence.
