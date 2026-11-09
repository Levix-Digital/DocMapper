# Feature Specification: M1 Text utilities: characterization and Rust port with ECMAScript semantics

**Feature Branch**: `feat/007-m1-text-utilities`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Start milestone M1 of the Rust migration: the text utilities" (backlog FEAT-005, FEAT-006; epic EPIC-002; ADR-0003)

## User Scenarios & Testing *(mandatory)*

The users of this milestone are the people who build DocMapper. End users see no change: the four text utilities keep running in TypeScript inside the application; this milestone produces their proven Rust twins, which are wired in when their callers move to Rust (batch processing in M6, localization in M8).

The four utilities are:

- **Output file name formatting** (`formatOutputFileName`): builds the name of each output PDF from a profile pattern with the tokens `{originalName}`, `{seq}`, `{seq:N}`, `{index}`, `{date}` and any extracted field name, removes characters that file systems refuse and guarantees the `.pdf` extension.
- **Validation pattern check** (`testRegexPattern`): tells whether a field value matches the field's validation pattern, or that the pattern is invalid.
- **Dictionary flattening** (`flattenDictionary`): turns a nested translation dictionary into dot-separated keys and text values.
- **Punctuation alignment** (`sanitizePunctuation`): removes trailing `;`, `:`, `.` or `,` that a translation added when the source text does not end with it.

### User Story 1 - Record what the TypeScript utilities do today (Priority: P1)

A developer runs characterization tests over a frozen copy of the four TypeScript utilities. The tests cover every branch of the code and write golden fixtures: an input and the exact output or error the TypeScript code gives for it.

**Why this priority**: The fixtures are the definition of correct behavior for the port (ADR-0003); nothing can be ported before they exist.

**Independent Test**: Run the characterization tests in check mode with branch coverage: every fixture matches and the coverage of the frozen copy is 100% of branches.

**Acceptance Scenarios**:

1. **Given** the frozen copy of the utilities, **When** the characterization tests run in update mode, **Then** they write one fixture per case under the `text` module, with the input and the output or the error.
2. **Given** committed fixtures, **When** the characterization tests run in check mode, **Then** every case matches and branch coverage of the frozen copy is 100%.
3. **Given** a case where the TypeScript code throws, **When** its fixture is written, **Then** it records the error name and message instead of an output.

---

### User Story 2 - Rust utilities give the same results (Priority: P1)

A developer runs the Rust tests of the core: each of the four utilities reads every fixture of the `text` module and gives exactly the same output or error.

**Why this priority**: This is the port itself and the proof the migration rule asks for.

**Independent Test**: Run the Rust parity tests of the `text` module and the parity checker: every fixture is compared with exact equality and no fixture id is one-sided.

**Acceptance Scenarios**:

1. **Given** the committed fixtures, **When** the Rust parity tests run, **Then** every case gives the same output or the same error (name and message) as recorded.
2. **Given** the module is marked as ported, **When** the parity checker runs, **Then** it finds the same ids in the TypeScript run, the fixtures and the Rust run.
3. **Given** an invalid validation pattern, **When** both sides check it, **Then** both say the pattern does not match and both report an error (the message text is the one exception, see FR-008).

---

### User Story 3 - Random inputs give the same results (Priority: P2)

Differential fuzzing sends generated inputs, biased toward the hard cases (Unicode whitespace and case, `$` replacement patterns, braces, integer-like and reserved object keys, numbers), to the TypeScript oracle and to the Rust utilities, and compares the results.

**Why this priority**: Fixtures cover the branches; fuzzing covers the semantics of strings, regular expressions, numbers and object key order that hand-written cases miss.

**Independent Test**: Run the fuzzing properties against the oracle in the parity job: all pass with the configured number of cases.

**Acceptance Scenarios**:

1. **Given** the oracle is running, **When** each property runs its generated cases, **Then** every Rust result equals the TypeScript result.
2. **Given** a property fails, **When** the run reports it, **Then** it shows the shrunk input that differs.

---

### Edge Cases

- A pattern token naming a member every JavaScript object inherits (for example `{toString}` or `{constructor}`): today the TypeScript code throws a type error; the port reproduces it, and the defect is captured in the backlog to be fixed after the switch (ADR-0003).
- An original file name containing `$&`, `$1`, `$$`, `` $` `` or `$'`: today the name is inserted with JavaScript replacement-pattern semantics; the port reproduces it.
- An original file name or extracted value containing another token (for example `{seq}`): today it is expanded by the later steps; the port reproduces the same order.
- A `{seq:N}` width so large that the padded text exceeds the JavaScript maximum string length: the TypeScript code throws a range error; the port reproduces it.
- Whitespace characters that JavaScript and Rust classify differently (for example U+FEFF and U+0085): the port uses the ECMAScript set.
- Case conversion of non-ASCII text (for example `İ`, final sigma): the port uses the full Unicode case mapping JavaScript uses.
- Dictionary keys that are canonical array indexes (for example `"10"` and `"2"`): JavaScript lists them first, in numeric order; the port reproduces that order in its output.
- A top-level dictionary key `__proto__` with a text value: JavaScript drops it from the result; the port reproduces it.
- Dictionary values that are numbers, booleans, arrays or `null`: numbers and booleans become JavaScript text, arrays become comma-joined text, `null` is skipped; numbers use JavaScript formatting (for example `1e+21`, `0.1`).
- An empty pattern, a pattern of only spaces or a pattern that sanitizes to nothing: the default name `<original>_<seq>.pdf` is used.
- Validation patterns using legacy JavaScript syntax accepted without the Unicode flag (for example `a{`, `]`, `\8`, `\k`): accepted the same way by both sides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A frozen copy of the four TypeScript utilities, unchanged from the application, MUST live under the parity tooling, with characterization tests that write the `text` module fixtures.
- **FR-002**: The characterization tests MUST cover 100% of the branches of the frozen copy, checked automatically.
- **FR-003**: The core MUST provide Rust versions of the four utilities that give the same output or the same error (name and message) for every fixture.
- **FR-004**: The date used by the `{date}` token MUST come from an injected clock on both sides, so fixtures and fuzzing are deterministic; the TypeScript copy is not changed to achieve this.
- **FR-005**: String handling MUST follow ECMAScript semantics: whitespace set, trimming, full Unicode case mapping, replacement patterns, string length in UTF-16 units and the maximum string length.
- **FR-006**: Values turned into text MUST follow ECMAScript conversion rules (numbers, booleans, arrays), and objects produced MUST keep ECMAScript property order.
- **FR-007**: Validation patterns MUST be interpreted with ECMAScript regular expression syntax and semantics, without flags, including the legacy syntax JavaScript accepts in that mode.
- **FR-008**: For an invalid validation pattern, both sides MUST report no match and an error; the error message text is exempt from exact equality and the comparison of that case checks only that a message exists (decision recorded in an ADR).
- **FR-009**: Differential fuzzing MUST compare each utility against the TypeScript oracle with generated inputs biased toward the edge cases above.
- **FR-010**: The `text` module MUST be registered as ported, and the parity checker MUST pass.
- **FR-011**: The core MUST NOT gain any dependency on a framework or driver listed as forbidden.
- **FR-012**: Defects found in the TypeScript behavior MUST be captured in the backlog, not corrected in this milestone.

### Key Entities

- **Text fixture**: a case of the `text` module: case id, function name, input and the recorded output or error.
- **Output file name options**: pattern (optional), original file name, extracted field values, document index and total number of documents.
- **Translation dictionary**: a nested set of keys whose leaves are text, numbers, booleans, arrays or nothing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the `text` fixtures pass on both sides, and branch coverage of the frozen TypeScript copy is 100%.
- **SC-002**: Each of the four fuzzing properties passes at least 256 generated cases in every parity run, with no difference.
- **SC-003**: The parity checker reports no one-sided id for the `text` module.
- **SC-004**: The parity job stays under 5 minutes and the whole CI under 20 minutes.
- **SC-005**: The application behaves exactly as before for end users (no file of the application interface changes).

## Assumptions

- Wiring the Rust utilities into the application (steps d and e of ADR-0003, switch and shadow mode) happens when their callers move to Rust: batch processing (M6) for file names and pattern checks, localization (M8) for the dictionary utilities. M1 covers steps a to c.
- Inputs are valid Unicode text: lone UTF-16 surrogates cannot reach the Rust side (Rust strings and the JSON reader refuse them) and are left out of fixtures and fuzzing.
- The document index is a whole number from 0 up to the largest safe JavaScript integer, as the callers pass a list position; extracted values are text; the pattern is text or absent.
- The clock gives dates between the years 1970 and 9999, the range where the ISO date has four year digits.
- Dictionary nesting stays below the depth limit of the JSON reader (128 levels); deeper input is outside what translation files contain.
- Unicode data may differ between the JavaScript engine and Rust for characters added in recent Unicode versions; fuzzing draws from characters assigned in both.
