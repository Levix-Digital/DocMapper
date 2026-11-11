# Feature Specification: Interface wired to the Rust profile store

**Feature Branch**: `feat/009-profiles-ui-wiring`

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "Wire the Vue interface to the Rust profiles, .dmap and SQLite repository through application commands" (backlog FEAT-050 and FEAT-013; epic EPIC-004; ADR-0003 steps d and e, ADR-0006)

## User Scenarios & Testing *(mandatory)*

The users of this feature are the people who map documents in the DocMapper desktop app. Today every screen keeps profiles in the browser storage of the window, even in the desktop app. After this feature, the desktop app keeps them in the local SQLite database of ADR-0006, through the Rust profile store proven in M3, and the screens look and behave as before.

The screens that use profiles are:

- **Mapping Studio**: starts a new empty profile, saves the profile being edited, exports it as a `.dmap` file (saved or not), and opens a stored profile for editing.
- **Profile management window**: lists the stored profiles, renames, duplicates, deletes, exports and imports them.
- **Processor screen**: lists the stored profiles to choose the one applied to a batch.

The browser build of the interface (kept until it is removed in release v0.2.0) keeps its browser store.

### User Story 1 - Profiles live in the local database of the desktop app (Priority: P1)

A user of the desktop app creates, saves, renames, duplicates and deletes profiles in the Mapping Studio and the profile management window; the processor screen lists them; after closing and opening the app the profiles are still there, in the same order.

**Why this priority**: It is the feature: ADR-0006 makes the database the only place profiles are read from, and later modules (LSIE, batch, stamping) read profiles from it.

**Independent Test**: In the desktop app, create two profiles, rename one, duplicate it, delete the other, close the app, open it again: the list shows the renamed profile and its copy, in that order; the database file in the application data directory holds the same two profiles.

**Acceptance Scenarios**:

1. **Given** the desktop app with an empty database, **When** the user saves a profile in the Mapping Studio, **Then** the profile management window and the processor screen list it, and it is stored in the database file.
2. **Given** stored profiles, **When** the user renames, duplicates or deletes one, **Then** the list shows the change at once and keeps it after the app is restarted.
3. **Given** stored profiles, **When** the app starts, **Then** the profiles are listed in their stored order, with the legacy built-in profile purged as before.
4. **Given** the database cannot be opened (for example it was written by a newer DocMapper), **When** a screen lists or changes profiles, **Then** the user sees a clear message that names the database problem, nothing is written, and the rest of the app keeps working.

---

### User Story 2 - Import and export `.dmap` files in the desktop app (Priority: P1)

A user imports a `.dmap` (or legacy `.docmapper`) file in the profile management window and exports any profile, stored or being edited, as a `.dmap` file to a place they choose. Profiles made in the browser version reach the desktop app this way (FEAT-013).

**Why this priority**: Import and export are how profiles move between computers and from the browser version; export through the browser download does not work the same way in every desktop window.

**Independent Test**: Export a profile from the browser version, import the file in the desktop app, export it again from the desktop app: the second file is byte for byte the first one except the new id, name (when it collided) and update time, as in the browser version.

**Acceptance Scenarios**:

1. **Given** a valid `.dmap` file, **When** the user imports it, **Then** it is stored with a new id, a name not used yet (ignoring case) and a new update time, and it is selected, as in the browser version.
2. **Given** a file that is not a valid `.dmap` file, **When** the user imports it, **Then** the user sees the same kind of message as in the browser version and nothing is stored.
3. **Given** a profile, **When** the user exports it, **Then** the app asks where to save it, proposing the same file name as the browser version (`<sanitized name>.dmap`), and writes the same text (indented JSON); cancelling writes nothing and shows no error.

---

### User Story 3 - Shadow comparison while the switch is new (Priority: P2)

A developer or a tester turns on the shadow mode; every profile operation then also runs on the browser store of the window, and any difference between the two results (after leaving out the generated ids and times) is written to the log with the operation and the difference.

**Why this priority**: ADR-0003 step d asks for a shadow mode when a module is wired, to catch differences the fixtures and fuzzing did not cover, in real use. The parity fixtures and fuzzing of M3 already prove the store, so the shadow is a diagnostic aid, off by default.

**Independent Test**: Turn the shadow mode on, run every profile operation in the desktop app: no difference is logged; change a stored profile in only one of the two stores: the next listing logs the difference.

**Acceptance Scenarios**:

1. **Given** the shadow mode is on, **When** the user runs any profile operation, **Then** both stores run it and a difference, if any, is logged with the operation name and the first differing path.
2. **Given** the shadow mode is off (the default), **When** the user runs any operation, **Then** only the database store is used.
3. **Given** the shadow mode is on and the browser store fails, **When** the user runs an operation, **Then** the user sees the database store's result and the failure is only logged.

---

### Edge Cases

- A profile whose name or keys the interface does not know (imported from a file): stored, listed and exported with every key in its order, as M3 guarantees.
- Numbers in profiles (coordinates, font sizes) cross the boundary between the interface and the core without changing value.
- Two operations started at the same time (for example a double click): they run one after the other, never interleaved.
- An export of a profile being edited that was never saved: exported from the profile as it is on screen, as in the browser version.
- An export whose chosen file cannot be written (no permission, disk full): the user sees the error; nothing else changes.
- The desktop window's browser storage already holds profiles from an earlier development build: they are not moved; the user exports them from that build and imports them (FEAT-013); the shadow mode reports them as differences.
- A screen opened while a previous operation is still running: it shows the result once the operation ends, never a stale list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The desktop app MUST open the local profile database at start-up in its application data directory, creating it when absent; a failure to open MUST NOT stop the app and MUST be reported by every profile operation.
- **FR-002**: The desktop app MUST expose one application command per profile operation the screens use: create an empty profile, list, find by id, save, delete, duplicate, import `.dmap` text and export a profile to a file the user chooses.
- **FR-003**: Each command MUST give the same result as the M3 profile store over the database (same returned profile, stored profiles and error kind); no business rule is added in the commands.
- **FR-004**: Errors MUST cross to the interface as a kind (invalid file, malformed file, type, range, database, file) and a message; the interface MUST show them as it shows browser store errors today.
- **FR-005**: The interface MUST reach profiles through one profile service with the same operations, asynchronous, choosing the database store in the desktop app and the browser store in the browser build.
- **FR-006**: The Mapping Studio, the profile management window and the processor screen MUST use the profile service only; no screen MUST import the browser store directly.
- **FR-007**: A shadow mode, off by default and turned on by a developer setting, MUST run each operation on both stores and log the differences of the returned values and stored profiles, leaving out generated ids and times.
- **FR-008**: Export in the desktop app MUST ask for the destination with the native save dialog, propose the file name of the browser version, and write the text the core gives; the window MUST NOT receive file system permissions.
- **FR-009**: Commands MUST run one at a time on the database.
- **FR-010**: The profile management window MUST say where profiles are kept (the local database in the desktop app, the browser storage in the browser build).
- **FR-011**: The browser store MUST stay only as the store of the browser build; removing it is part of the removal of the browser build (release v0.2.0).
- **FR-012**: The core MUST NOT change behavior: the M3 parity fixtures and fuzzing MUST still pass unchanged.

### Key Entities

- **Profile document**: a stored profile as an ordered JSON object (M3).
- **Profile command error**: the error kind and message a command gives back to the interface.
- **Profile service**: the interface's single entry to profile operations, backed by the database store (desktop) or the browser store (browser build), with an optional shadow comparison.
- **Shadow difference**: operation name, the path of the first differing value, and both values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the desktop app, 100% of the profile operations of the three screens read and write the local database; profiles survive a restart in the same order.
- **SC-002**: With the shadow mode on, running every profile operation of the manual test suite logs no difference.
- **SC-003**: Listing 1,000 stored profiles in the desktop app shows the list in under 300 ms.
- **SC-004**: A profile exported from the browser version and imported in the desktop app exports again to the same text except id, name collision suffix and update time.
- **SC-005**: The browser build behaves exactly as before.

## Assumptions

- The removal of the browser store (ADR-0003 step e) waits for the removal of the browser build in release v0.2.0, which the product owner decided to keep until then; in the desktop app the database store is the only store from this feature on (the switch of step e for the desktop surface).
- Profiles kept in the browser storage of the browser version are moved by export and import (FEAT-013, closed by this feature); no automatic copy, because the browser version and the desktop window have separate storage.
- The database file is `docmapper.sqlite3` in the application data directory given by the operating system; the central database by connection string (FEAT-012) is a later adapter.
- The free edition limit of three document families (FEAT-014) is a later check in the core, not in the commands.
- The shadow mode is a developer setting in the window's storage, read at start-up; it is not shown in the settings screen.
