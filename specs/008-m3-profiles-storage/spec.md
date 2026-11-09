# Feature Specification: M3 Profiles: characterization, Rust profile store and local SQLite repository

**Feature Branch**: `feat/008-m3-profiles-storage`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Start milestone M3 of the Rust migration: profiles, .docmapper files and SQLite" (backlog FEAT-009, FEAT-010, FEAT-011; epic EPIC-004; ADR-0003, ADR-0006)

## User Scenarios & Testing *(mandatory)*

The users of this milestone are the people who build DocMapper. End users see no change: the interface keeps its profile store in the browser storage; this milestone produces the proven Rust profile store, its storage port and the local SQLite repository. A following item of release v0.1.0 wires the desktop interface to it through application commands, with the shadow mode of ADR-0003.

The profile store of the application (`frontend/src/services/mapping/profile-store.ts`) has these operations:

- **Create an empty profile** (`createEmptyProfile`): a new profile with a generated id, the given name (default `Untitled Profile`), version 1, creation and update times, no fields, no destination mappings and the default output name pattern.
- **List and find** (`getAllProfiles`, `getProfileById`): all stored profiles in their stored order; the legacy built-in profile id `builtin-cmr-standard` is purged when found.
- **Save** (`saveProfile`): replaces the stored profile with the same id in place, or appends it, with a new update time.
- **Delete** (`deleteProfile`): removes every profile with the id.
- **Duplicate** (`duplicateProfile`): a deep copy with a new id, the name `<name> (Copy)` or `<name> (Copy N)` not yet used, and new times.
- **Export** (`exportProfileAsDocMapper`): the profile as indented JSON text in a file named after the profile name with characters outside `A-Z a-z 0-9 _ -` replaced by `_` and the `.dmap` extension.
- **Import** (`importProfileFromDocMapper`): reads `.dmap` or legacy `.docmapper` JSON text, checks it has a name, a field list and a destination mapping list, gives it a new id, a name not used yet ignoring case (`<name> (N)`) and a new update time, keeps every other key as it is, and saves it.

The built-in CMR profile factory (`createBuiltinCmrProfile`) is not called by the application (only its id is used, by the purge) and is a ready-made profile, which the product vision rules out: it is not ported (same reasoning as ADR-0011).

### User Story 1 - Record what the TypeScript profile store does today (Priority: P1)

A developer runs characterization tests over a frozen copy of the profile store. Each case starts from a given set of stored profiles, a clock and a random source, calls one operation, and records what it returned and the stored profiles after it, or the error it threw.

**Why this priority**: The fixtures are the definition of correct behavior for the port (ADR-0003). ADR-0006 asks for parity on the stored JSON of each profile.

**Independent Test**: Run the characterization tests in check mode with branch coverage: every fixture matches and the coverage of the frozen copy is 100% of branches.

**Acceptance Scenarios**:

1. **Given** the frozen copy, **When** the characterization tests run in update mode, **Then** they write one fixture per case under the `profiles` module, with the input (stored profiles, clock, random values, arguments) and the output (returned value and stored profiles) or the error.
2. **Given** committed fixtures, **When** the characterization tests run in check mode, **Then** every case matches and branch coverage of the frozen copy is 100%.

---

### User Story 2 - The Rust profile store gives the same results on every repository (Priority: P1)

A developer runs the Rust parity tests: each fixture runs against the Rust profile store twice, once over an in-memory repository and once over the SQLite repository, and both give exactly the returned value, stored profiles (key order included) and errors recorded.

**Why this priority**: This is the port itself, and it proves that the SQLite repository stores each profile exactly as the browser store does.

**Independent Test**: Run the Rust parity tests of the `profiles` module and the parity checker.

**Acceptance Scenarios**:

1. **Given** the committed fixtures, **When** the Rust parity tests run on the in-memory repository and on the SQLite repository, **Then** every case gives the same output or error as recorded, on both.
2. **Given** an exported profile, **When** both sides export it, **Then** the file name and the file text are byte for byte the same (JavaScript number formatting and indentation included).
3. **Given** the module is marked as ported, **When** the parity checker runs, **Then** it finds the same ids in the TypeScript run, the fixtures and the Rust run.

---

### User Story 3 - Profiles survive in a local SQLite database (Priority: P1)

The SQLite repository keeps profiles in a database file: profiles saved, deleted and reordered are read back the same after the database is closed and opened again; the database is in WAL mode; its schema is created and upgraded by additive migrations; a database written by a newer version of DocMapper is refused instead of being changed.

**Why this priority**: ADR-0006 makes the database the only place profiles are read from.

**Independent Test**: Run the repository tests of the SQLite adapter on a temporary file.

**Acceptance Scenarios**:

1. **Given** a new database file, **When** the repository opens it, **Then** the schema is created at the latest version and the journal mode is WAL.
2. **Given** saved profiles, **When** the database is closed and opened again, **Then** the profiles and their order are read back unchanged.
3. **Given** a database whose schema version is newer than the application knows, **When** the repository opens it, **Then** it fails with a clear error and does not write to it.
4. **Given** a stored document that is not a valid profile JSON object, **When** the profiles are listed, **Then** the repository reports which row is corrupt instead of dropping it.

---

### User Story 4 - Random inputs give the same results (Priority: P2)

Differential fuzzing sends generated stores, names (case variants, `(Copy)` and `(N)` collisions, Unicode case and sanitization cases), clocks, random values and `.dmap` texts to the TypeScript oracle and to the Rust profile store, and compares the results.

**Why this priority**: Fixtures cover the branches; fuzzing covers name collisions, case folding, number formatting and key order that hand-written cases miss.

**Independent Test**: Run the fuzzing properties against the oracle in the parity job.

**Acceptance Scenarios**:

1. **Given** the oracle is running, **When** each property runs its generated cases, **Then** every Rust result equals the TypeScript result.

---

### Edge Cases

- An imported file whose keys come in any order, with unknown keys or duplicate keys: the stored profile keeps the key order and values JavaScript gives (`id`, `name` and `updatedAt` keep their position when present, and are appended when absent; a duplicate key keeps its first position and its last value).
- An imported name that differs from a stored name only by case (including non-ASCII case such as `İ` or final sigma): renamed `<name> (1)`, then `(2)`, and so on.
- An imported name that is not text but is truthy (a number, `true`, an object, an array): stored as it is when no profile is stored; a type error when there are stored profiles, as in JavaScript (captured as a low bug).
- An imported file that is not an object, is `null`, or lacks a truthy name or the two lists: the same error as in JavaScript.
- An imported file that is not valid JSON: both sides fail with a syntax error; only the error kind is compared, not the message (FR-009).
- A duplicate when `(Copy)` and several `(Copy N)` names already exist: the first free number is used; the comparison is case-sensitive, unlike import.
- A profile name with characters outside the BMP: each UTF-16 unit becomes one `_` in the export file name (an emoji gives `__`).
- Numbers in profiles (box coordinates, font sizes): kept as the same value when stored and written in JavaScript form when exported (`16`, not `16.0`; `1e+21`).
- A random value whose base-36 text is shorter than 7 characters (for example `0.5` gives `0.i`): the id suffix is shorter, as in JavaScript; the random value 0 gives an empty suffix.
- Two operations at the same clock instant giving the same id: save replaces the profile with that id, as in JavaScript.
- The legacy built-in profile id in the store: purged on every listing, as in JavaScript.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A frozen copy of the profile store, unchanged from the application except for the removal of the unused built-in profile factory and its template import, MUST live under the parity tooling, with characterization tests that write the `profiles` module fixtures.
- **FR-002**: The characterization tests MUST cover 100% of the branches of the frozen copy that the Rust store reproduces; the browser-only branches (no `window`, corrupted browser storage text, the download through the page) are characterized by stub tests and recorded as not ported, because the storage medium changes (ADR-0006).
- **FR-003**: The core MUST provide a profile store with the same operations, giving the same returned value, stored profiles and errors (name and message) for every fixture, except FR-009.
- **FR-004**: The clock and the random source used for ids and times MUST be injected on both sides (ports in Rust, a wrapper in the parity tooling); ids MUST keep the form `profile-<milliseconds>-<base-36 random text>` with JavaScript number-to-text rules.
- **FR-005**: A stored profile MUST keep every key in its JavaScript order and every value exactly, including keys the application does not know.
- **FR-006**: The core MUST define a typed profile model (boxes, fields, destination mappings, profile) that reads a stored profile for the later modules, and a `ProfileRepository` port that lists, saves (replace in place or append) and deletes profiles in their stored order.
- **FR-007**: The SQLite repository MUST implement the port in a separate adapter crate, store each profile document and its position, use WAL mode, create and upgrade its schema by additive, numbered migrations and refuse a database newer than it knows.
- **FR-008**: The export text MUST be the JavaScript `JSON.stringify(profile, null, 2)` text, byte for byte.
- **FR-009**: For import text that is not valid JSON, both sides MUST fail with a `SyntaxError`; the message text is exempt from exact equality and the Rust side gives its own message (decision to record in an ADR, extending ADR-0010).
- **FR-010**: Differential fuzzing MUST compare the store operations against the TypeScript oracle with generated inputs biased toward the edge cases above.
- **FR-011**: The `profiles` module MUST be registered as ported, and the parity checker MUST pass.
- **FR-012**: The core MUST NOT depend on `rusqlite` or any other forbidden crate.
- **FR-013**: Defects found in the TypeScript behavior MUST be captured in the backlog, not corrected in this milestone.

### Key Entities

- **Profile document**: one stored profile, a JSON object in JavaScript key order.
- **Mapping profile (typed)**: id, name, version, times, fields, destination template, destination mappings and output name pattern, read from a profile document.
- **Profile repository**: the ordered set of stored profile documents.
- **Profile fixture**: case id, operation, stored profiles before, clock start, random values, arguments, and the returned value and stored profiles after, or the error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the `profiles` fixtures pass on the TypeScript side and on both Rust repositories; branch coverage of the ported part of the frozen copy is 100%.
- **SC-002**: Each fuzzing property passes at least 256 generated cases in every parity run, with no difference.
- **SC-003**: The parity checker reports no one-sided id for the `profiles` module.
- **SC-004**: Listing 1,000 stored profiles from SQLite takes under 100 ms on the CI machine; the parity job stays under 5 minutes and the whole CI under 20 minutes.
- **SC-005**: The application behaves exactly as before for end users (no file of the interface changes).

## Assumptions

- Wiring the interface to the Rust store (application commands, shadow mode, then removal of the browser store: steps d and e of ADR-0003) is a separate item of release v0.1.0, done after this milestone; so is FEAT-013 (import of profiles from the browser version), which then uses this import.
- The central PostgreSQL repository (FEAT-012) and the free edition limit of three document families (FEAT-014) belong to v0.3.0; the port is shaped so they are new adapters and checks, not changes to it.
- Inputs are valid Unicode text and numbers within the f64 range: lone UTF-16 surrogates and numbers JSON parsing turns into infinities cannot reach the Rust side and are left out of fixtures and fuzzing, as in M1 (recorded in the same ADR as FR-009).
- Coordinates in profiles are percentages of the page (0 to 100), as `mapping.ts` says; the subsystem page that says 0 to 1 is corrected.
