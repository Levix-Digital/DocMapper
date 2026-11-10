# Backlog

Work captured for later planning: bugs, features, improvements and adjustments, grouped under epics when the product is planned as a whole. Capturing an item takes no discovery; when the user decides to work on items, they are promoted into a plan (`plan-memory/backlog.py promote`), where the discovery and the planning happen. Open bugs come before new work.

Each item: `### <ID>: <title>` with the fields `Severity` (bugs: critical, high, medium, low) or `Priority` (others: high, medium, low), an optional `Epic`, `Status` (open, planned, in_progress), `Found`, `Plan` and `Description`. Epics (`EPIC-NNN`) group items of the complete product; they have no `Plan` and are never promoted: their items are. The roadmap (`docs/ROADMAP.md`) says which items go into which release. Closed items (done, dropped, duplicate, superseded by better defined items) move to `Closed` with a `Closed` note and keep their ids, which are never reused. Edit this file with `plan-memory/backlog.py` or by hand, and check it with `backlog.py validate`.

## Bugs

### BUG-001: Output file name pattern token naming an inherited object member throws
- **Severity**: low
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-09, M1 characterization (specs/007-m1-text-utilities)
- **Plan**: -
- **Description**: formatOutputFileName: a token such as {toString}, {constructor} or {__proto__} that is not an extracted field finds the Object.prototype member and throws TypeError 'extractedData[trimmed].trim is not a function', so the whole document fails. Kept for parity in M1 (ADR-0003); fix after the switch in M6: look up own keys only.

### BUG-002: Dollar patterns in the original file name are expanded in output names
- **Severity**: low
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-09, M1 characterization (specs/007-m1-text-utilities)
- **Plan**: -
- **Description**: formatOutputFileName inserts the original name with String.prototype.replace and a string replacement, so $&, $`, $' and $$ in the name are expanded (a$&b.pdf with {originalName} gives ab.pdf). Kept for parity in M1 (ADR-0003); fix after the switch in M6: insert the name literally.

### BUG-003: Dictionary array holding an object with a toString key fails to flatten
- **Severity**: low
- **Epic**: EPIC-009
- **Status**: open
- **Found**: 2026-11-09, M1 differential fuzzing (specs/007-m1-text-utilities)
- **Plan**: -
- **Description**: flattenDictionary turns arrays into text with String(array); an object item with an own toString key throws TypeError 'Cannot convert object to primitive value'. Translation files do not hold such values today. Kept for parity in M1 (ADR-0003); fix after the switch in M8.

### BUG-004: Profile import accepts a name that is not text and breaks later imports
- **Severity**: low
- **Epic**: EPIC-004
- **Status**: open
- **Found**: 2026-11-09, M3 characterization (specs/008-m3-profiles-storage)
- **Plan**: -
- **Description**: importProfileFromDocMapper only checks that name is truthy: a number, true, an object or an array is stored as the name when no profile is stored, and every later import then throws TypeError 'p.name.toLowerCase is not a function'. Kept for parity in M3 (ADR-0003); fix after the switch of the profile store.

### BUG-005: Profile import stores the other keys of the file without validation
- **Severity**: low
- **Epic**: EPIC-004
- **Status**: open
- **Found**: 2026-11-09, M3 characterization (specs/008-m3-profiles-storage)
- **Plan**: -
- **Description**: importProfileFromDocMapper keeps every key of the file besides id, name and updatedAt as it is (version, createdAt, field and mapping contents, unknown keys), so a .dmap file can store data that does not fit the profile model. Kept for parity in M3 (ADR-0003); fix after the switch of the profile store.

## Features

### FEAT-012: Central PostgreSQL repository by connection string
- **Priority**: medium
- **Epic**: EPIC-004
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Connection string stored in the keychain; no silent fallback to local.

### FEAT-014: Free edition limit of three document families
- **Priority**: high
- **Epic**: EPIC-004
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Enforced with the license check (ADR-0007).

### FEAT-015: Shared LSIE crate in levix-platform (pull request from DocMapper)
- **Priority**: high
- **Epic**: EPIC-005
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Generic, from lsie-rs, FEAT-022 of levix-platform.

### FEAT-016: Profile to common layout adapter with exact parity
- **Priority**: high
- **Epic**: EPIC-005
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: labelBox and valueBox to FEAT-023 format.

### FEAT-017: Corpus of reference PDFs with expected values
- **Priority**: high
- **Epic**: EPIC-005
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: A4, Letter, print to PDF, growing fields, scans, several documents per file; pdf.js glyphs recorded.

### FEAT-018: Difference report against spatial-extractor.ts
- **Priority**: high
- **Epic**: EPIC-005
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Every difference accepted by the product owner before the switch.

### FEAT-019: PdfReader port and pdfium adapter
- **Priority**: high
- **Epic**: EPIC-006
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Text and glyph positions, scanned page detection.

### FEAT-020: Glyph parity test against recorded pdf.js glyphs
- **Priority**: high
- **Epic**: EPIC-006
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Tolerance 0.01 percentage points.

### FEAT-021: Characterization tests and fixtures for batch processing
- **Priority**: high
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Model calls behind an interface with recorded responses.

### FEAT-022: Rust batch pipeline in the core
- **Priority**: high
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Split, extract, gate, fallback, validate, stamp, name.

### FEAT-023: Deterministic profile detection by anchor score
- **Priority**: medium
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Each page is matched to the profile whose anchors score highest above a threshold; unmatched pages go to the user. No model.

### FEAT-024: Background processing of whole folders
- **Priority**: medium
- **Epic**: EPIC-007
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Paid edition.

### FEAT-025: Characterization tests for stamping
- **Priority**: high
- **Epic**: EPIC-008
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Drawn content read back, decoded barcodes, rendered pixels.

### FEAT-026: PdfWriter port and Rust stamping
- **Priority**: high
- **Epic**: EPIC-008
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Helvetica AFM metrics ported and tested width by width.

### FEAT-027: Removal of the browser build and AssemblyScript
- **Priority**: medium
- **Epic**: EPIC-008
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: After M7, per ADR-0001. Removes the browser profile store (`frontend/src/services/mapping/profile-store.ts`) and the browser backend of `profile-service.ts` with it (FEAT-050 left them only for the browser version).

### FEAT-028: Generic VisionModel connector for any model API
- **Priority**: medium
- **Epic**: EPIC-009
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Endpoint, model and key configured by the user or delivered by policy.

### FEAT-029: SecretStore port with the operating system keychain
- **Priority**: medium
- **Epic**: EPIC-009
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Model keys and connection strings.

### FEAT-030: Translation service in Rust
- **Priority**: low
- **Epic**: EPIC-009
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Google Translate endpoint and cache, with the pure helpers from M1.

### FEAT-031: Removal of the online license check and the Express backend
- **Priority**: high
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: First step of the Admin Hub agreement.

### FEAT-032: PolicyGate port called before every restricted core command
- **Priority**: high
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Vision endpoint, cloud key use, export, profile publishing, batch.

### FEAT-033: Draft of the signed product manifest
- **Priority**: high
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: levix-platform manifest format (FEAT-025), signed by Levix. Client kinds desktop and mcp-server, profile format as data definition, seat model per user (per device supported), policy categories vision_fallback, cloud_models, export, profile_publishing, batch, central_database, mcp_server, telemetry; counters documents mapped, exports, vision fallback calls, cloud model calls, batch runs, MCP calls; accepted commands including kill-switch. Admin Hub uses it as the conformance case of its FEAT-027 (ADR-0007).

### FEAT-034: Offline signed license with the levix-platform license crate
- **Priority**: medium
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: File import up to five machines; Admin Hub above.

### FEAT-035: Admin Hub enrollment, policies and counters
- **Priority**: medium
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Offline validity 72 h by default; corporate environment only. Release only after Admin Hub v0.3.0 is released (enrollment, certificates, policy distribution). Counters and MCP audit governed from Admin Hub v0.5.0.

### FEAT-036: Shared levix-onnx crate in levix-platform (pull request from DocMapper)
- **Priority**: medium
- **Epic**: EPIC-011
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Agreement with AnyContext of 2026-11-08: lazy ort::init_from load, CPU first, ort =2.0.0-rc.14 with ONNX Runtime 1.31.0.

### FEAT-037: PP-OCRv5 glyph rebuild for pages without usable text
- **Priority**: medium
- **Epic**: EPIC-011
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: LSIE runs again on the rebuilt glyphs.

### FEAT-038: LiLT key-value extraction when the layout collapses
- **Priority**: medium
- **Epic**: EPIC-011
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Fine-tuned per field type; license checked per checkpoint.

### FEAT-039: MCP server surface (docmapper-mcp, stdio)
- **Priority**: medium
- **Epic**: EPIC-012
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: List profiles, run extractions, read results under the same license and policy checks.

### FEAT-040: First direct ERP connector
- **Priority**: low
- **Epic**: EPIC-013
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Target system chosen on the roadmap.

### FEAT-041: Signed installers for Windows, macOS and Linux
- **Priority**: medium
- **Epic**: EPIC-014
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: pdfium and ONNX Runtime shipped with the app.

### FEAT-042: Rust interface replacing the Vue screens
- **Priority**: low
- **Epic**: EPIC-015
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Framework chosen in an ADR.

### FEAT-043: Removal of Node.js from the build and the parity oracle
- **Priority**: low
- **Epic**: EPIC-015
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Fixtures stay as Rust tests.

### FEAT-044: Export to CSV, JSON and XML with a configurable schema
- **Priority**: medium
- **Epic**: EPIC-012
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Field names, order and formats set per profile.

### FEAT-045: Automatic updates verified through the levix-platform catalog
- **Priority**: medium
- **Epic**: EPIC-014
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Signature checked before install.

### FEAT-046: Metadata-only audit record for every policy denial
- **Priority**: medium
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Rule, command, time, device; never content or paths. Through levix-platform FEAT-015, sent on the Admin Hub channel.

### FEAT-047: Kill-switch handling from the Admin Hub channel
- **Priority**: medium
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Blocks the corporate environment at once; the personal environment is not affected.

### FEAT-048: Encrypted delivery of corporate endpoints, keys and connection strings
- **Priority**: low
- **Epic**: EPIC-010
- **Status**: open
- **Found**: 2026-11-08
- **Plan**: -
- **Description**: Encrypted to the device public key (Admin Hub FEAT-030, v0.5.0), never shown to users, stored in the keychain.

### FEAT-049: Release workflows: pre-release on -rc tags and promote workflow
- **Priority**: high
- **Epic**: EPIC-014
- **Status**: open
- **Found**: 2026-11-09, plan docmapper_m0_foundation
- **Plan**: -
- **Description**: GitHub Actions pre-release for vX.Y.Z-rc.N tags and the promote workflow with the release environment (trunk model); needed before the first v0.1.0 candidate.

## Improvements

## Adjustments

## Epics

### EPIC-001: [migration] M0 Foundation: Cargo workspace, Tauri shell and parity harness
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0001, ADR-0002, ADR-0003. The app runs in a Tauri shell with the logic still in TypeScript.

### EPIC-002: [migration] M1 Text utilities
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: filename-formatter, testRegexPattern, flattenDictionary, sanitizePunctuation with exact parity.

### EPIC-004: [migration] M3 Types, profiles and storage
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0006. mapping.ts types, built-in CMR profile, profile-store rules, .docmapper import and export; storage in a database.

### EPIC-005: [migration] M4 LSIE engine
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0004. Shared levix-platform LSIE crate built from lsie-rs; profile adapter to the common layout format.

### EPIC-006: [migration] M5 PDF reading in Rust
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0009. pdfium replaces pdf.js for extraction; glyph tolerance 0.01 pp; identical extraction on the corpus.

### EPIC-007: [migration] M6 Batch processing
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: mapping-runner: page split, anomaly gate, keyword fallback, confidence, status; model responses recorded in tests.

### EPIC-008: [migration] M7 PDF stamping
- **Priority**: high
- **Status**: open
- **Found**: 2026-11-08
- **Description**: dynamic-stamper and template-engine: font fitting and alignment exact, Code128 and QR by decoded content, pages by pixels.

### EPIC-009: [migration] M8 Network services and model connector
- **Priority**: medium
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0005, ADR-0008. Generic model connector over HTTP, translation service; parity on request bodies and recorded responses.

### EPIC-010: [migration] M9 Licensing and policy enforcement
- **Priority**: medium
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0007, Admin Hub agreement of 2026-11-07. Follows the Admin Hub releases v0.2.0 to v0.5.0.

### EPIC-011: [product] Local vision fallback
- **Priority**: medium
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0005. Local ONNX models through the shared levix-onnx crate, downloaded through the levix-platform catalog.

### EPIC-012: [product] Data export and MCP server
- **Priority**: medium
- **Status**: open
- **Found**: 2026-11-08
- **Description**: Export of results and a second surface for MCP clients.

### EPIC-013: [product] ERP connectors
- **Priority**: low
- **Status**: open
- **Found**: 2026-11-08
- **Description**: Direct connectors on the roadmap after version 1.0.

### EPIC-014: [migration] M10 Packaging and release
- **Priority**: medium
- **Status**: open
- **Found**: 2026-11-08
- **Description**: Installers, code signing, automatic updates for Windows, macOS and Linux.

### EPIC-015: [product] Interface in Rust
- **Priority**: low
- **Status**: open
- **Found**: 2026-11-08
- **Description**: ADR-0001: final 100% Rust target; removes Vue, Vite and Node.js. After version 1.0.

## Closed

### FEAT-001: Cargo workspace with docmapper-core and docmapper-desktop crates
- **Priority**: high
- **Epic**: EPIC-001
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Closed**: 2026-11-09, plan docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Description**: Hexagonal layout from .dev-cycle.json; check_design passes.

### FEAT-002: Tauri 2 shell running the current Vue interface
- **Priority**: high
- **Epic**: EPIC-001
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Closed**: 2026-11-09, plan docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Description**: Browser build keeps working until M7.

### FEAT-003: Parity harness: fixture format, fixture writer, Node oracle and id checker
- **Priority**: high
- **Epic**: EPIC-001
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Closed**: 2026-11-09, plan docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Description**: parity/fixtures/<module>/<case>.json with {input, output}; CI fails when an id exists on one side only.

### FEAT-004: CI with Rust and TypeScript jobs
- **Priority**: high
- **Epic**: EPIC-001
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Closed**: 2026-11-09, plan docmapper_m0_foundation_cargo_workspace_tauri_shell_parity_harness_and_ci
- **Description**: cargo fmt, clippy, test; Vitest; parity checker.

### FEAT-005: Characterization tests and fixtures for the text utilities
- **Priority**: high
- **Epic**: EPIC-002
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m1_text_utilities_characterization_and_rust_port_with_ecmascript_semantics
- **Closed**: 2026-11-09, plan docmapper_m1_text_utilities_characterization_and_rust_port_with_ecmascript_semantics
- **Description**: Full branch coverage in TypeScript.

### FEAT-006: Rust port of the text utilities with ECMAScript regex and string semantics
- **Priority**: high
- **Epic**: EPIC-002
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m1_text_utilities_characterization_and_rust_port_with_ecmascript_semantics
- **Closed**: 2026-11-09, plan docmapper_m1_text_utilities_characterization_and_rust_port_with_ecmascript_semantics
- **Description**: regress, UTF-16 indexing, ECMAScript whitespace; fixtures and proptest fuzzing pass.

### FEAT-007: Characterization tests and fixtures for the CMR core
- **Priority**: high
- **Epic**: EPIC-003
- **Status**: dropped
- **Found**: 2026-11-08
- **Plan**: -
- **Closed**: 2026-11-09, The AssemblyScript CMR core is not called by the interface; removed instead of ported (ADR-0011, decided by the product owner 2026-11-09)
- **Description**: Including unknown document type errors.

### FEAT-008: Rust port of the CMR core
- **Priority**: high
- **Epic**: EPIC-003
- **Status**: dropped
- **Found**: 2026-11-08
- **Plan**: -
- **Closed**: 2026-11-09, The AssemblyScript CMR core is not called by the interface; removed instead of ported (ADR-0011, decided by the product owner 2026-11-09)
- **Description**: Replaces WasmService calls with a Tauri command behind a switch, shadow mode on.

### EPIC-003: [migration] M2 CMR core
- **Priority**: high
- **Status**: dropped
- **Found**: 2026-11-08
- **Closed**: 2026-11-09, The AssemblyScript CMR core is not called by the interface; removed instead of ported (ADR-0011, decided by the product owner 2026-11-09)
- **Description**: AssemblyScript scanner, cleaning, dates, CMR parser and processDocument, byte-identical JSON text.

### FEAT-009: Characterization tests and fixtures for profiles and .docmapper files
- **Priority**: high
- **Epic**: EPIC-004
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Closed**: 2026-11-09, plan docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Description**: Parity on the stored JSON of each profile.

### FEAT-010: Rust profile model and ProfileRepository port
- **Priority**: high
- **Epic**: EPIC-004
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Closed**: 2026-11-09, plan docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Description**: Ids and clock injected.

### FEAT-011: Local SQLite repository
- **Priority**: high
- **Epic**: EPIC-004
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Closed**: 2026-11-09, plan docmapper_m3_profiles_characterization_rust_profile_store_and_local_sqlite_repository
- **Description**: WAL mode, additive migrations.

### FEAT-050: Interface wired to the Rust profile store through application commands
- **Priority**: high
- **Epic**: EPIC-004
- **Status**: done
- **Found**: 2026-11-09, M3 plan (specs/008-m3-profiles-storage)
- **Plan**: docmapper_profiles_ui_wiring_desktop_commands_over_the_rust_profile_store_and_sqlite
- **Closed**: 2026-11-10, plan docmapper_profiles_ui_wiring_desktop_commands_over_the_rust_profile_store_and_sqlite
- **Description**: ADR-0003 steps d and e for the profiles module: desktop commands over ProfileStore and the SQLite repository in the application data directory, the interface calling them with a shadow mode that compares the stored JSON with the browser store and logs differences, then removal of the browser store. Decided by the product owner on 2026-11-09 as a separate item after M3.

### FEAT-013: Import of profiles from the browser version
- **Priority**: medium
- **Epic**: EPIC-004
- **Status**: done
- **Found**: 2026-11-08
- **Plan**: docmapper_profiles_ui_wiring_desktop_commands_over_the_rust_profile_store_and_sqlite
- **Closed**: 2026-11-10, plan docmapper_profiles_ui_wiring_desktop_commands_over_the_rust_profile_store_and_sqlite
- **Description**: Through .docmapper export and import.
