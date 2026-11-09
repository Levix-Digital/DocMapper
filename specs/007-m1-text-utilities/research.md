# Research: M1 Text utilities

## Reference sources and frozen copy

- **Decision**: copy the four functions, unchanged, into `parity/text/` (`filename-formatter.ts`, `validation-pattern.ts`, `translation-text.ts`), each with a header naming the source file and the commit (`f38b9e9`). The copies hold only the functions: the localStorage clean-up at the top of `translation-service.ts` and the Gemini client around `testRegexPattern` are left out because they are not part of the utilities.
- **Rationale**: ADR-0003 keeps a frozen copy outside the app until the last module switches; copying the functions alone keeps the copy free of browser APIs and network code, so it runs in Vitest and in the Node oracle.
- **Alternatives considered**: importing the application files directly (the oracle would load browser-only code and change whenever the app changes); copying the whole files (dead code in the parity tooling).

## Injected clock for `{date}`

- **Decision**: the oracle and Vitest call a wrapper `formatOutputFileName(options, nowMs)` that replaces the global `Date` with a subclass whose no-argument constructor returns `nowMs`, calls the frozen function, and restores `Date` in a `finally`. The Rust function takes a `CalendarDate` built from Unix milliseconds by the caller.
- **Rationale**: FR-004 asks for a deterministic date without changing the TypeScript copy; the wrapper changes only the test seam. In Rust, the date is a plain parameter: a `Clock` port is added when the batch use case (M6) needs one (constitution II, no abstraction without a second implementation or a seam needed today).
- **Alternatives considered**: `vi.setSystemTime` (only inside Vitest, not in the oracle); editing the copy to take a date (breaks the frozen-copy rule).

## ECMAScript regular expressions in Rust

- **Decision**: the `regress` crate 0.12 with the `utf16` feature, compiled without flags and matched with `find_from_ucs2` over the UTF-16 code units of the candidate.
- **Rationale**: ADR-0003 names `regress`. A probe of 32 patterns (legacy forms such as `a{`, `]`, `\8`, `\c`, `\k`, `[\c]`, `\01`, plus syntax errors) gave the same accept or reject answer as V8 for every one. Matching over code units (UCS-2) reproduces JavaScript without the Unicode flag: `^.$` does not match `😀`, `^..$` does; matching over `&str` would treat the emoji as one character.
- **Known gap**: without the Unicode flag, JavaScript reads `\u{61}` as the letter `u` repeated 61 times; `regress` reads it as the code point `a`. The port normalizes the pattern before compiling: a `\u` not followed by four hex digits becomes `u` (an identity escape), inside and outside character classes, skipping escaped backslashes. Every other difference fuzzing finds is handled the same way (a normalization step with its own unit tests) or, if it cannot be, reported to the product owner before the module is marked as ported.
- **Error message**: `regress` messages differ from V8 (`Unbalanced parenthesis` against `Invalid regular expression: /(/: Unterminated group`). No caller reads the message (`mapping-runner.ts` and `gemini-service.ts` read only `matches`). Decided by the product owner (2026-11-09): exception to exact equality for this field only, recorded in a new ADR (FR-008). The comparison replaces the message by a fixed marker on both sides before the exact comparison, so a missing or extra error still fails.
- **Alternatives considered**: mapping each `regress` error to the V8 text (brittle: V8 and `regress` can report different errors first for a pattern with several); a fixed message on both sides (changes the TypeScript behavior, against ADR-0003); embedding a JavaScript engine (a runtime dependency the 100% Rust target rules out).

## ECMAScript strings

- **Decision**: a small `ecmascript` module in the core with: the whitespace set of `String.prototype.trim` and `\s` (WhiteSpace plus LineTerminator: U+0009, U+000A, U+000B, U+000C, U+000D, U+0020, U+00A0, U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF); `trim`; `to_lower_case` (Rust `str::to_lowercase`, which applies the same full mapping and final sigma rule as `String.prototype.toLowerCase`); `utf16_len`; `pad_start` with the V8 maximum string length (2^29 − 24 = 536,870,888 code units, `RangeError: Invalid string length` above it); and `GetSubstitution` for string replacements (`$$`, `$&`, `` $` ``, `$'`, `$n`, `$nn`, `$<name>`).
- **Rationale**: Rust's `char::is_whitespace` differs from ECMAScript (it includes U+0085 and excludes U+FEFF); the other helpers are the exact spec algorithms the four utilities rely on.
- **Alternatives considered**: running the TypeScript regex literals of `formatOutputFileName` through `regress` (works, but the replacements are simple enough to write directly, and direct code avoids compiling regexes per call); a general JavaScript string library (none found that covers these semantics without an engine).

## ECMAScript values and property order

- **Decision**: a `PropertyMap` type in the core that keeps keys in ECMAScript order (canonical array indexes, 0 to 2^32 − 2, first in ascending numeric order, then other keys in insertion order), overwrites in place, and ignores a `__proto__` assignment of a non-object value; `to_js_string` for JSON values (numbers with `ryu-js`, which follows `Number.prototype.toString`; integers above 2^53 go through `f64` first, as `JSON.parse` does; booleans; arrays joined with `,`, `null` inside arrays as empty text, objects as `[object Object]`).
- **Rationale**: `flattenDictionary` iterates `Object.keys`, assigns into an object and converts leaves with `String(...)`; each of these has observable ECMAScript rules (probe: `{"b":"1","__proto__":"x","10":2,"2":[1,[null,3]]}` flattens to `{"2":"1,,3","10":"2","b":"1"}`).
- **Alternatives considered**: `serde_json::Map` order alone (insertion order only, would put `"b"` before `"10"`).

## Behavior kept although it is a defect

- **Decision**: reproduced as they are, and captured in the backlog as bugs to fix after the switch (ADR-0003):
  - a pattern token naming an inherited object member (`{toString}`, `{constructor}`, `{__proto__}`, and the other `Object.prototype` names) throws `TypeError: extractedData[trimmed].trim is not a function`;
  - an original file name with `$` replacement patterns is inserted with replacement semantics (`a$&b.pdf` with `{originalName}` gives `ab.pdf`).
- **Rationale**: the TypeScript code is the oracle; fixing during the port would break parity and hide the change.

## Branch coverage

- **Decision**: `@vitest/coverage-v8` as a frontend dev dependency; the parity Vitest project measures coverage of `parity/text/**` with a 100% branch threshold, run by `npm run test:parity`.
- **Rationale**: FR-002 needs an automatic check; V8 coverage needs no instrumentation build.
- **Alternatives considered**: Istanbul instrumentation (slower, same result for this code).

## Fuzzing generators

- **Decision**: `proptest` strategies built from weighted pieces: the ECMAScript and Rust whitespace sets, `;:.,`, `{}`, `$&`, `$1`, `$$`, the token names in all cases, `Object.prototype` member names, canonical and non-canonical integer keys (`"2"`, `"02"`, `"4294967295"`), accented and case-special letters (`İ`, `Σ`, `ß`), and plain ASCII; validation patterns from a small grammar (literals, classes, anchors, groups, bounded quantifiers, legacy escapes) that cannot backtrack catastrophically; 256 cases per property.
- **Rationale**: uniform random text almost never hits the branches that matter.
