---
title: Profiles
summary: 'Mapping profiles: the profile store, .dmap import and export, the typed model and the profile repository (local SQLite in the desktop app, browser storage in the browser version).'
code: [frontend/src/services/mapping/profile-service.ts, frontend/src/services/mapping/profile-shadow.ts, frontend/src/services/mapping/profile-store.ts, frontend/src/types/mapping.ts, crates/docmapper-core/src/profiles, crates/docmapper-sqlite, crates/docmapper-desktop/src/profiles.rs]
---

# Profiles

Mapping profiles: the profile store, `.dmap` import and export, the typed model and the profile repository (local SQLite in the desktop app, browser storage in the browser version).

## Responsibilities

Owns mapping profiles: their types, create, list, find, save, delete and duplicate, `.dmap` export and import, and where profiles are kept. It does not own extraction.

## Structure

- `frontend/src/types/mapping.ts`: `MappingProfile`, `FieldDefinition` (label box, value box, validation pattern, required flag), destination mappings and `ExtractionResult`.
- `frontend/src/services/mapping/profile-service.ts`: `ProfileService`, the only entry the screens use (asynchronous): the desktop backend calls the profile commands of the [Desktop Shell](desktop-shell.md); the browser backend wraps `profile-store.ts`. The backend is chosen once at start-up (`isTauri()`); command errors become `Error`s named after their kind (`SyntaxError`, `TypeError`, `RangeError`, `DatabaseError`, `FileError`, `Error` for an invalid file).
- `frontend/src/services/mapping/profile-shadow.ts`: the shadow mode of ADR-0003 (see Behavior).
- `frontend/src/services/mapping/profile-store.ts`: the browser version's store, over the browser's `localStorage`, removed with the browser version (FEAT-027): `createEmptyProfile`, `getAllProfiles`, `getProfileById`, `saveProfile`, `deleteProfile`, `duplicateProfile`, `exportProfileAsDocMapper`, `importProfileFromDocMapper`. It also holds `createBuiltinCmrProfile`, which no screen calls; it is not ported.
- `crates/docmapper-core/src/profiles` (migration module M3, parity module `profiles`), the Rust twin:
  - `store.rs`: `ProfileStore` over a repository, a clock and a random source, one method per TypeScript operation, and `StoreError` (`InvalidFile`, `Syntax`, `Type`, `Range`, `Repository`).
  - `export.rs`: `export_docmapper` gives the file name and text; the caller saves the file.
  - `document.rs`: `ProfileDocument`, a stored profile as an ordered JSON object; `into_ecmascript_order`.
  - `model.rs`: `MappingProfile` and its parts, a typed read model of a stored profile for the modules that use profiles.
  - `ports.rs`: `Clock`, `RandomSource`, `ProfileRepository` (`list`, `save`, `delete`) and `RepositoryError`.
  - `js.rs` and `json_text.rs`: the JavaScript semantics the store needs (strict equality, truthiness, V8 type error texts, template text, `toISOString`, `JSON.parse` with key order, `JSON.stringify(value, null, 2)`).
  - `memory.rs`: `InMemoryProfileRepository`; `system.rs`: `SystemClock` and `StdRandom`.
- `crates/docmapper-sqlite`: `SqliteProfileRepository`, the local repository of ADR-0006 (`rusqlite` with SQLite compiled in).

## Behavior

- Profiles are kept in a stored order. Saving a profile with a known id replaces it in place with a new `updatedAt`; any other profile is appended. The legacy built-in profile id `builtin-cmr-standard` is purged every time profiles are listed.
- Box coordinates are percentages of the page (`x`, `y`, `width`, `height` from 0 to 100) with a 1-based page number.
- Ids are `profile-<milliseconds>-<up to 5 base-36 characters of a random number>`; the clock and the random source are read in the TypeScript order (id, then creation time, then update time, then the save's update time).
- A stored profile keeps every key, in JavaScript property order (array indexes first), including keys the application does not know: import keeps whatever the file holds besides the id, the name and `updatedAt`.
- Duplicate names a copy `<name> (Copy)`, then `(Copy 2)`, `(Copy 3)`, the first not used (case-sensitive), and returns the copy as built; the stored copy has a later `updatedAt`.
- Export writes `JSON.stringify(profile, null, 2)` to `<name>.dmap`, where every UTF-16 unit of the name outside `A-Z a-z 0-9 _ -` becomes `_`.
- Import reads `.dmap` (and legacy `.docmapper`) text, requires a truthy `name` and `fields` and `destinationMappings` lists (`Invalid .dmap file format: ...` otherwise), gives the profile a new id, a name not used yet ignoring case (`<name> (1)`, `(2)`, ...) and a new `updatedAt`, and saves it. Malformed JSON is a `SyntaxError` (the Rust message is its own, ADR-0012). Known kept defects: a truthy name that is not text is accepted when no profile is stored and breaks later imports, and other keys are kept without validation (backlog bugs, fixed after the switch).
- **Shadow mode** (desktop app, off by default): with `docmapper_profile_shadow` set to `1` in the window's storage at start-up, every operation also runs on the browser store of the window and the two results are compared: the returned value, then the stored lists. Top-level `id`, `createdAt` and `updatedAt` are compared by presence only (each store generates its own), database ids are mapped to browser ids only through the profiles create, duplicate and import return on both sides (never by position), and the first difference (key order included) is written to the console as `[profiles shadow]` with its JSON path and both values. Browser store failures are logged, never shown; export is not compared (its text is proven by the parity fixtures).
- The SQLite repository keeps one row per profile (`profile(id, position, document)`, the document as compact JSON), opens files in WAL mode with a 5-second busy timeout, creates and upgrades its schema with numbered, additive migrations tracked by `PRAGMA user_version`, refuses a database written by a newer DocMapper before writing anything, and reports a stored document that is not a JSON object as corrupt with its position. Documents without a text id are refused by both repositories; the interface never saves one.

## Interfaces

- The Mapping Studio, the profile management window and the Processor call `ProfileService`; in the desktop app every profile operation runs in the Rust store over `docmapper.sqlite3` in the application data directory, through the commands of the [Desktop Shell](desktop-shell.md).
- LSIE (M4), batch processing (M6) and stamping (M7) read profiles through `MappingProfile::from_document`.

## Decisions

- [ADR-0006](../adr/0006-profiles-stored-in-a-database-local-sqlite-by-default-centra.md): profiles are read from a database (local SQLite by default, a central database by connection string).
- [ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md): the TypeScript store is the parity oracle.
- [ADR-0011](../adr/0011-unused-assemblyscript-cmr-core-removed-instead-of-ported.md): a parser for one document type is a profile, not code; for the same reason the built-in CMR profile factory is not ported.
- [ADR-0012](../adr/0012-malformed-profile-files-compared-by-error-kind-json-outside.md): malformed files compared by error kind; JSON outside Rust strings and f64 refused.
