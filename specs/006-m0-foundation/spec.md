# Feature Specification: M0 Foundation: Cargo workspace, desktop shell, parity harness and CI

**Feature Branch**: `feat/006-m0-foundation`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "M0 Foundation: Cargo workspace, Tauri shell, parity harness and CI" (backlog FEAT-001, FEAT-002, FEAT-003, FEAT-004; epic EPIC-001; ADR-0001, ADR-0002, ADR-0003)

## User Scenarios & Testing *(mandatory)*

The users of this milestone are the people who build DocMapper. End users see no change: the application behaves exactly as today, now also inside a desktop window.

### User Story 1 - Run the current application as a desktop app (Priority: P1)

A developer starts DocMapper as a desktop application on their computer and gets the current interface, with every existing screen and flow working as it does in the browser. The same sources still build and run in the browser.

**Why this priority**: The desktop shell is the frame every later module is wired into; without it no module can be switched from TypeScript to Rust.

**Independent Test**: Start the desktop app in development mode and from a release build; open each main screen; build and serve the browser version from the same sources.

**Acceptance Scenarios**:

1. **Given** a clean checkout with the development prerequisites, **When** the developer runs the documented desktop development command, **Then** a desktop window opens showing the current interface.
2. **Given** the desktop app is running, **When** the developer maps and processes a document as in the browser, **Then** the result is the same as in the browser version.
3. **Given** the same checkout, **When** the developer runs the documented browser build, **Then** it completes and the browser version works as before.
4. **Given** the desktop app is running, **When** the interface asks the shell for the core version, **Then** it receives the version of the Rust core (proof that the shell reaches the core).

---

### User Story 2 - Prove a module with parity fixtures (Priority: P1)

A developer writes characterization tests for a TypeScript module that record golden fixtures (an input and the output the TypeScript code gives for it). Rust tests later read the same fixtures and must give exactly the same outputs. Differential fuzzing sends random inputs to the TypeScript code through an oracle process and compares with Rust.

**Why this priority**: The migration rule (ADR-0003) is that no module switches without proof of identical outputs; the harness is that proof, needed by every milestone from M1 on.

**Independent Test**: Run the harness self-test module: its TypeScript tests write fixtures, its Rust tests read them, the oracle answers random inputs, and the checker passes; then remove a fixture or a test on one side and see the checker fail.

**Acceptance Scenarios**:

1. **Given** a characterization test, **When** it runs in update mode, **Then** it writes `parity/fixtures/<module>/<case>.json` with the case id, the input and the output (or the error).
2. **Given** committed fixtures, **When** the characterization tests run in check mode and the TypeScript output differs from a fixture, **Then** the run fails and names the case.
3. **Given** a module marked as ported, **When** the Rust parity tests run, **Then** every fixture of the module is compared with exact equality and the run lists the ids it checked.
4. **Given** a fixture id produced by only one side (TypeScript tests, committed fixtures, Rust tests), **When** the checker runs, **Then** it fails and lists each missing id with the side it is missing from.
5. **Given** the oracle process is started, **When** Rust sends a request for a module function with an input, **Then** it receives the TypeScript output, or the TypeScript error, for that input.

---

### User Story 3 - Every pull request is checked automatically (Priority: P2)

Each pull request runs the Rust checks (format, lint, tests), the TypeScript checks (type check and build, unit and characterization tests) and the parity checker, and cannot be merged while any of them fails.

**Why this priority**: The checks protect the parity rule over the whole migration; they are useful as soon as the first module starts, but the shell and the harness come first.

**Independent Test**: Open a pull request with a formatting error, a failing test, or a fixture without its test, and see the matching check fail; fix it and see every check pass.

**Acceptance Scenarios**:

1. **Given** a pull request into `main`, **When** it is opened or updated, **Then** the Rust, TypeScript and parity checks run and report their status on the pull request.
2. **Given** any check fails, **When** the result is reported, **Then** the log names the failing step.

---

### Edge Cases

- A fixture file that is not valid JSON or misses a required field: the reader fails with the file path and the problem.
- A fixture whose module is not listed in the module registry: the checker fails.
- A module with fixtures that is not yet ported to Rust: only TypeScript and fixtures must agree; the Rust side is not required yet.
- The TypeScript function throws for an input: the fixture records the error (name and message) instead of an output, and Rust must reproduce the same error.
- Floating point numbers in inputs and outputs: compared exactly as the JSON numbers TypeScript writes, with no tolerance.
- Object key order in outputs: preserved and compared, as TypeScript writes it.
- The oracle process is missing, crashes or answers something that is not a response: the Rust caller fails with the reason, never treats it as a match.
- The desktop development command is run before the interface dependencies are installed: it fails with the missing step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST hold a Rust workspace with a core crate and a desktop crate in the hexagonal layout set in the project configuration; the core MUST NOT depend on any framework or driver listed as forbidden, checked by the design checker.
- **FR-002**: The desktop crate MUST open the current interface in a desktop window, in development mode (live interface server) and from a release build (bundled interface files).
- **FR-003**: The desktop crate MUST expose a command that returns the core version, as the first proof that the shell reaches the core.
- **FR-004**: The browser build of the interface MUST keep working from the same sources, with no change in behavior.
- **FR-005**: The desktop window MUST be granted only the permissions it needs now (no file system, shell or other system access beyond the defaults).
- **FR-006**: The parity harness MUST define one fixture format: one file per case at `parity/fixtures/<module>/<case>.json` with the case id, module, function, input and either output or error.
- **FR-007**: The harness MUST provide a TypeScript fixture writer used by characterization tests, with an update mode that writes fixtures and a check mode that fails when the TypeScript output differs from the committed fixture.
- **FR-008**: The harness MUST provide a Rust fixture reader that runs every fixture of a module against a Rust function with exact equality (including key order and number values) and records the ids it checked.
- **FR-009**: The harness MUST provide an oracle process that answers requests (module, function, input) with the TypeScript output or error, and a Rust client for it usable from property-based tests.
- **FR-010**: The harness MUST provide a checker that compares the case ids of the committed fixtures, of the TypeScript run and of the Rust run, per module, using a registry that says whether each module is characterized or ported, and fails when an id is missing on any required side.
- **FR-011**: The harness MUST include a self-test module that exercises every part of the harness end to end, so the harness is proven before the first real module.
- **FR-012**: Continuous integration MUST run on every pull request into `main` and on every push to `main`: Rust format check, lint with warnings as errors, Rust tests; TypeScript type check and build, TypeScript tests; and the parity run with the checker.
- **FR-013**: The development documentation MUST describe how to install the prerequisites, run the desktop app, run the browser version, run every test and add parity fixtures.

### Key Entities

- **Fixture**: one case of one module function: id, module, function, input, and output or error.
- **Module registry**: the list of modules under migration with their state (characterized, ported).
- **Run record**: the list of case ids one side (TypeScript or Rust) checked in a run, per module.
- **Oracle request and response**: a module, a function and an input; an output or an error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with the prerequisites installed goes from a clean checkout to the desktop app showing the current interface by following the documentation alone, in under 15 minutes (excluding download times).
- **SC-002**: 100% of the existing interface flows behave the same in the desktop window and in the browser (manual check of the main flows).
- **SC-003**: The checker fails for 100% of the one-sided id cases (fixture without TypeScript case, TypeScript case without fixture, fixture of a ported module without Rust case) in its own tests.
- **SC-004**: Every pull request into `main` shows the result of all checks; a pull request with any failing check cannot be merged.
- **SC-005**: The full set of checks completes in under 20 minutes on the continuous integration service.

## Assumptions

- Continuous integration runs on Linux only in this milestone; building and checking on Windows and macOS comes with packaging (M10).
- The reference TypeScript of a module is copied into `parity/` when that module's characterization starts (M1 onward); M0 ships only the harness and its self-test module.
- The current interface keeps calling its TypeScript and WebAssembly code; no module logic moves to Rust in M0.
- The online license check stays as it is until FEAT-031 removes it, also inside the desktop window.
- The desktop window loads no content security policy beyond the defaults in M0, so the current network calls (translation and model services) keep working; a policy is set when those calls move to Rust (M8).
- Node.js remains a development prerequisite during the migration (interface and parity oracle), as the technical specification allows.
