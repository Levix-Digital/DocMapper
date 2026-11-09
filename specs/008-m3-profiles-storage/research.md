# Research: M3 Profiles

## R1. What is ported, and from which state

- **Decision**: port the seven operations the interface calls (`createEmptyProfile`, `getAllProfiles`, `getProfileById`, `saveProfile`, `deleteProfile`, `duplicateProfile`, `exportProfileAsDocMapper`, `importProfileFromDocMapper`). Each fixture starts from a list of stored profiles; the frozen copy runs over an in-memory `localStorage` stub holding `JSON.stringify(list)`.
- **Not ported**: `createBuiltinCmrProfile` (no caller; a ready-made profile, ruled out by the vision; ADR-0011 reasoning), and three browser-only branches: no `window` (returns an empty list), corrupted storage text (reset with a warning) and the download through the page (Blob, anchor, click). The SQLite repository has no equivalent of the first two (a corrupt row is an explicit error, R6); the download becomes "return the file name and text" and the interface saves it (wiring item).
- **Alternatives**: characterize from raw storage text (would force the Rust side to emulate `localStorage`, a medium ADR-0006 removes); port the built-in profile (a ready-made profile no user reaches).

## R2. Profile document: ordered JSON, not only a typed struct

- **Decision**: the store works on `ProfileDocument`, a JSON object with `preserve_order` (`serde_json::Map`), because import spreads the parsed file (`{...parsed, id, name, updatedAt}`): unknown keys are kept and key order is observable in the stored JSON and in the export text. Object spread semantics are reproduced: an existing key keeps its position and gets the new value; a new key is appended. A typed `MappingProfile` (serde) is read from a document for the later modules (M4 adapter); it is not what is stored.
- **Alternatives**: typed struct with a flattened map of unknown keys (loses the position of unknown keys relative to known ones, so export text and stored JSON would differ).

## R3. JavaScript semantics needed

- Value to text for template literals (`${name} (Copy)`): `js_value::to_js_string` from M1.
- Strict equality (`===`) for ids and names: primitives by value (numbers as f64), objects and arrays never equal.
- `toLowerCase` on names: `ecmascript::to_lower_case` from M1; on a non-text name the V8 type error (`p.name.toLowerCase is not a function`, `uniqueName.toLowerCase is not a function`, `Cannot read properties of null (reading 'toLowerCase')`), in the same evaluation order (`p.name` first).
- Property read on the parsed file (`parsed.name`): `null` gives `Cannot read properties of null (reading 'name')`; other primitives and arrays give `undefined`.
- Truthiness for `!parsed.name`: `""`, `0`, `false`, `null` and a missing key are falsy.
- `String.prototype.replace(/[^a-zA-Z0-9_\-]/g, '_')` per UTF-16 unit for the export file name; a non-text name gives `profile.name.replace is not a function`.
- `Number.prototype.toString(36)` for the random part of ids: port of V8 `DoubleToRadixCString` (f64 arithmetic in the same order, round-half-even on the last digit), unit-tested on the values V8 gives (`0.5` → `0.i`, `0.123` → `0.4feornbt361`).
- `Date.prototype.toISOString`: `CalendarDate::iso` from M1 with milliseconds.
- `JSON.stringify(value, null, 2)`: a small writer in the core (two-space indent, `[]` and `{}` for empty containers, `serde_json` string escaping, which matches V8 for valid Unicode, numbers through `ryu-js`).

## R4. Clock and random source

- **Decision**: two ports in the core, `Clock::now_millis() -> f64` (`Date.now()` and `new Date()`) and `RandomSource::next_f64() -> f64` (`Math.random()`); the store reads them in the TypeScript order (id, then `createdAt`, then `updatedAt`, then `saveProfile`'s `updatedAt`). Fixtures use a ticking clock (start, step 1 ms per read) so a different read order shows as a different output. The parity wrapper replaces `Date` and `Math.random` around the call, without editing the frozen copy (same approach as `parity/text/fixed-clock.ts`).
- **Production adapters**: `SystemClock` and a random source from the standard library (`std::hash::RandomState` seeded `u64` mapped to `[0, 1)`), so the core gets no new random crate.
- **Alternatives**: an `IdGenerator` port returning the whole id (hides the id format from parity); fixed clock (does not catch read order).

## R5. Repository port

- **Decision**: `ProfileRepository` with `list() -> Vec<ProfileDocument>` (stored order), `save(document)` (replace in place when a document with the same id exists, else append) and `delete(id)` (removes every match). Errors: `RepositoryError` (`InvalidDocument(String)`, `Corrupt { position, reason }`, `Unavailable(String)`, `NewerSchema { found, known }`). The store calls `list` once per JavaScript `getAllProfiles` call and `delete` for the purge, so the number of reads and writes follows the TypeScript code. An in-memory repository lives in the core (`profiles::memory`) for tests and as the reference.
- **Alternatives**: `replace_all(list)` mirroring `localStorage.setItem` (rewrites the whole table for every save); one method per store operation in the repository (moves domain rules into adapters, duplicated in PostgreSQL later).

## R6. SQLite adapter

- **Decision**: new crate `crates/docmapper-sqlite` with `rusqlite` 0.41 (feature `bundled`, so no system SQLite is needed on any platform). Table `profile(id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, document TEXT NOT NULL) STRICT`; the document is compact JSON with key order kept; append takes `max(position) + 1`. Migrations are a numbered list of SQL steps applied in one transaction each and tracked with `PRAGMA user_version`; steps are only added, never edited (a test pins the SQL of released steps). On open: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`; a `user_version` above the latest known step is refused before any write. A stored document that does not parse as a JSON object is `Corrupt` with its position.
- **Database path**: chosen by the caller (the desktop wiring will use the application data directory, `docmapper.sqlite3`); the adapter takes a path or opens in memory.
- **Alternatives**: `sqlx` (async, heavier, and its SQLite driver still links C); one table per entity (fields, mappings) now (no query needs them; would break the key-order parity; can be added by migration when a query needs them).

## R7. Malformed JSON and values outside Rust strings and f64

- **Finding**: V8 `JSON.parse` messages (`Unexpected end of JSON input`, `Expected property name or '}' in JSON at position 1 (line 1 column 2)`, and about twenty more forms) are shown to the user in the import alert. Reproducing them means a JSON parser written to V8's error positions and wording.
- **Decision (to confirm by the product owner)**: compare `SyntaxError` by name only (as ADR-0010 does for pattern errors), and give a Rust message with line and column. Lone surrogate escapes (`"\ud800"`) and numbers beyond the f64 range (`1e400`, which JavaScript turns into `Infinity` and stores as `null`) are refused by the Rust reader as a `SyntaxError`; they are left out of fixtures and fuzzing. One new ADR records both.
- **Alternatives**: a V8-compatible JSON reader (large, for a message only); a WTF-16 string model in the core (all of the core would pay for a case no real `.dmap` file has).

## R8. Defects found (kept for parity, ADR-0003)

- Import accepts a truthy name that is not text (a number, `true`, an object) when the store is empty; every later import then fails with a type error. To capture as a low bug, fixed after the switch.
- Import keeps the file's `createdAt` and `version` and any other key as they are, without validation (a `.dmap` file can store any data). To capture as a low bug with the same timing.
