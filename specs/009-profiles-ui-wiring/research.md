# Research: Interface wired to the Rust profile store

## R1: Where the store lives in the desktop shell

- **Decision**: the shell builds one `ProfileStore<SqliteProfileRepository, SystemClock, StdRandom>` at start-up in `setup`, from `app.path().app_data_dir()/docmapper.sqlite3` (directory created when absent), and keeps it as managed state behind a `std::sync::Mutex`. When opening fails, the state keeps the error text and every profile command returns it as a `database` error.
- **Rationale**: one connection, one writer (FR-009) without extra crates; the mutex is held only for the store call, never across a dialog. Keeping the error instead of stopping lets the other screens work (FR-001) and refuses a newer database without writing (M3).
- **Alternatives**: open per command (repeats migrations and WAL setup on every call); `tokio::sync::Mutex` (no `await` inside the critical section, not needed); panic at start-up (the whole app is lost for a profile problem).

## R2: Command surface

- **Decision**: one thin command per store operation: `profiles_create_empty(name?)`, `profiles_list()`, `profiles_get(id)`, `profiles_save(profile)`, `profiles_delete(id)`, `profiles_duplicate(id)`, `profiles_import(text)` and `profiles_export(profile)`. Ids and profiles cross as JSON values, so the store keeps its JavaScript semantics (an id that is not text, a profile with unknown keys).
- **Rationale**: the screens call these operations today; the store already holds every rule (FR-003). Values instead of typed structs keep key order and unknown keys (`serde_json` with `preserve_order`, as the workspace already sets).
- **Alternatives**: a generic `profiles(op, args)` command (loses Tauri's per-command typing and permissions); typed `MappingProfile` arguments (drops unknown keys, breaks M3 FR-005).

## R3: Errors across the boundary

- **Decision**: commands return `Result<T, CommandError>` where `CommandError` serializes as `{ kind, message }`, `kind` one of `invalid_file`, `syntax`, `type`, `range`, `database`, `file`; `message` is the `Display` text of the core error. The interface turns it into an `Error` whose `name` follows the JavaScript kind (`Error`, `SyntaxError`, `TypeError`, `RangeError`, `DatabaseError`, `FileError`), so the screens keep their current `catch` code.
- **Rationale**: FR-004; the screens show `err.message` today.

## R4: Export in the desktop window

- **Decision**: `profiles_export(profile)` (async command) calls `export_docmapper` in the core, then the native save dialog of `tauri-plugin-dialog` 2.8 from Rust with the proposed file name and a `.dmap` filter, and writes the text with `std::fs::write`. It returns the saved path, or nothing when the user cancels. The plugin is used from Rust only: no dialog or file system permission is added to the window's capabilities (FR-008).
- **Rationale**: the browser download (`Blob` + `<a download>`) has no reliable behaviour across WebView2, WKWebView and WebKitGTK; a Rust-side dialog keeps the window without file system access.
- **Alternatives**: the dialog and fs plugins from JavaScript (grants the window file system permissions); a webview download handler (platform-specific, no file choice on Linux).

## R5: Profile service in the interface

- **Decision**: `frontend/src/services/mapping/profile-service.ts` exports an asynchronous `ProfileService` interface (the store's operations, with `exportProfile` returning the saved file's name, or null when cancelled) and `profileService`, chosen once: the desktop backend (`invoke` from `@tauri-apps/api/core`) when `isTauri()` is true, the browser backend (the current `profile-store.ts`, wrapped in promises) otherwise, and the shadow wrapper over the desktop backend when the developer setting `docmapper_profile_shadow` is `"1"` in the window's storage.
- **Rationale**: FR-005 and FR-006; the screens change from synchronous calls to `await` only. `createEmptyProfile` is also asynchronous so ids come from the core in the desktop app.
- **Alternatives**: a build-time switch (the browser build and the desktop build share one `dist`); calling `invoke` from the screens (spreads the backend choice).

## R6: Shadow comparison

- **Decision**: the shadow wrapper runs each operation on the desktop backend (the result returned to the screen) and then on the browser store, and compares the returned value and the stored list after the call. Before comparing, every `id`, `createdAt` and `updatedAt` at the top level of a profile is replaced by a placeholder, and ids passed to the browser store are mapped through a table built only from the profiles that create, duplicate and import return on both sides (never by list position, so a browser profile is never changed in place of another). Differences go to `console.warn` with the prefix `[profiles shadow]`, the operation, the first differing JSON path and both values. Browser store errors are logged, never shown. Export is not compared: the browser export downloads a file, and the export text is already proven byte for byte by the M3 parity fixtures.
- **Rationale**: FR-007; the two stores generate ids and times from different clocks and random sources, so those values can only be compared by position and presence; everything else, key order included, must be equal.
- **Alternatives**: injecting the core's clock and random values into the browser store (changes the browser store, which M3 froze as the oracle); comparing only lists (misses returned values such as duplicate names).

## R7: Browser store and FEAT-013

- **Decision**: `profile-store.ts` stays as the browser backend until the browser build is removed (v0.2.0); its unused `createBuiltinCmrProfile` and the template import stay too (removed with the file). FEAT-013 is delivered by the `.dmap` export in the browser version and the import in the desktop app, verified by a manual test, and closed by this plan.
- **Rationale**: the product owner keeps the browser build until v0.2.0; the desktop window's storage is separate from the browser's, so an automatic copy is not possible.

## R8: Tests of the interface

- **Decision**: Vitest unit tests (project `unit`, Node environment) for the service: backend choice, the desktop backend with an injected `invoke` that records commands and returns or rejects payloads, the browser backend over an in-memory storage stub, error mapping, the shadow comparison (normalization, id mapping, a planted difference logged, browser errors swallowed). Rust tests for the commands call the command functions with a store over an in-memory SQLite repository and a fixed clock and random source; the dialog is behind a small `SaveTarget` trait so tests write to a temporary directory.
- **Rationale**: the window cannot run in CI; the commands and the service are the only new code with logic.

## R9: Browser dialogs in the desktop window

- **Finding** (desktop window under Linux, 2026-11-10): `window.alert` and `window.confirm` show nothing in the Tauri window; `confirm` returns `true` at once, so a profile was deleted without confirmation and a failed import showed no message.
- **Decision**: the screens show errors in their notice bars (red) and the delete button asks for a second click within 3.5 seconds; the Mapping Studio's other `alert` calls (sample PDF, preview) use the same notice. The file input is cleared after each import so the same file can be imported again.
- **Alternatives**: the dialog plugin's message and ask dialogs from JavaScript (grants the window a dialog permission and differs between the two builds).
