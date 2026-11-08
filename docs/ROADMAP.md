# Roadmap

The releases of the product in delivery order, from the MVP onwards. Each release has a goal and the backlog items (`docs/BACKLOG.md`) it delivers; the roadmap is the only place that says which item goes into which release. Discovery starts from the open items of the current release (the first one not released), after the bugs that come first.

Each release: `## vX.Y.Z: <name>` with the fields `Status` (planned, in_progress, released), an optional `Target`, `Released` (the date, once released), `Goal` and `Items` (backlog ids separated by commas, `-` when empty). Edit this file with `plan-memory/roadmap.py` or by hand, and check it with `roadmap.py validate`.

## v0.1.0: Desktop core
- **Status**: planned
- **Goal**: The app runs as a Tauri desktop app with text utilities, CMR core, profiles in SQLite and LSIE in Rust, proven by parity fixtures
- **Items**: FEAT-001, FEAT-002, FEAT-003, FEAT-004, FEAT-005, FEAT-006, FEAT-007, FEAT-008, FEAT-009, FEAT-010, FEAT-011, FEAT-013, FEAT-015, FEAT-016, FEAT-017, FEAT-018, FEAT-031, FEAT-032, FEAT-033

## v0.2.0: Full flow in Rust
- **Status**: planned
- **Goal**: PDF reading, batch processing and stamping run in Rust; the browser build and AssemblyScript are removed
- **Items**: FEAT-019, FEAT-020, FEAT-021, FEAT-022, FEAT-023, FEAT-025, FEAT-026, FEAT-027

## v0.3.0: Connected and governed
- **Status**: planned
- **Goal**: Model connector and local vision fallback, keychain secrets, central PostgreSQL, export and MCP server, offline license and Admin Hub policy enforcement
- **Items**: FEAT-028, FEAT-029, FEAT-030, FEAT-034, FEAT-035, FEAT-036, FEAT-037, FEAT-038, FEAT-039, FEAT-044, FEAT-012, FEAT-014, FEAT-024, FEAT-046, FEAT-047, FEAT-048

## v1.0.0: Desktop 1.0
- **Status**: planned
- **Goal**: Signed installers and verified automatic updates for Windows, macOS and Linux
- **Items**: FEAT-041, FEAT-045

## v1.1.0: ERP
- **Status**: planned
- **Goal**: First direct ERP connector
- **Items**: FEAT-040

## v2.0.0: 100% Rust
- **Status**: planned
- **Goal**: The interface is rewritten in Rust and Node.js leaves the product
- **Items**: FEAT-042, FEAT-043
