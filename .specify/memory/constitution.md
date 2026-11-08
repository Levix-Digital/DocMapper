<!-- dev-cycle-constitution
generated-by: dev-cycle-protocol/constitution.py (do not edit; change a source and regenerate)
sources-sha256: 6607c979202566bb49e8447469b6d51fcbf72305c5b479dec0b49d6860833683
content-sha256: 32eae7ccadc0ce0a3829b34d250822a8a20eaa385d6a9505943bbe16fe180f6e
-->
# docmapper Constitution

The non-negotiable rules every specification, plan and task of this project follows. It is generated from the project's sources of truth by `dev-cycle-protocol/constitution.py`; change a source and regenerate it, never edit it.

## Core Principles

### I. Design

*Source: software-design*

#### Modularity and separation of responsibilities
- One module, type or function has **one reason to change**. When a description needs "and", split it.
- Group code by what it is about (a domain concept or a feature), not by what kind of file it is, unless the architecture style says otherwise.
- Business rules never live in the user interface, in transport code (HTTP handlers, CLI argument parsing) or in persistence code.
- Dependencies point toward stable code: details (frameworks, databases, network, UI) depend on the core, never the other way around.

#### SOLID, in practice
| Principle | What it means when writing code | Smell that it is violated |
|---|---|---|
| **S**ingle responsibility | Each unit does one job and can be named without "and". | A 600-line file mixing parsing, rules and output. |
| **O**pen/closed | Add behavior by adding a new implementation, not by growing an `if/else` chain in stable code. | Every new provider edits the same `match` in five places. |
| **L**iskov substitution | Any implementation of an interface can replace another without surprises. | An implementation that panics or ignores half the contract. |
| **I**nterface segregation | Small interfaces shaped by what the caller needs. | Callers implementing methods they never use. |
| **D**ependency inversion | High-level code depends on abstractions it owns; adapters implement them. | Core code constructing an HTTP client or a database driver. |

#### Clean Code
- **Names** say what something is or does; no abbreviations a newcomer cannot decode; no `data`, `info`, `manager`, `util` as whole names.
- **Small functions** that do one thing at one level of abstraction; early returns instead of deep nesting.
- **No magic values**: named constants with units in the name (`TIMEOUT_MS`).
- **Comments explain why**, never what; delete commented-out code and dead code.
- **Consistency over preference**: follow the conventions already in the codebase (naming, error types, layout) unless the change is an agreed refactor.
- **Duplication**: remove it when the same rule exists twice; tolerate it when two pieces only look alike today.

#### Explicit error handling
- Never swallow an error (`except: pass`, `let _ =` on a meaningful result, an empty `catch`, a blind `.unwrap()` on input that can fail).
- Errors carry context (what was being done, with which input) and use the project's canonical error types.
- Decide at each boundary: recover, translate into the caller's error type, or propagate. Report to the user once, at the edge.
- Fallbacks are allowed only when they are explicit, logged and visible in status output; a silent fallback that changes behavior is a defect.

#### Testability
- Pure logic is separated from I/O so it can be unit-tested without mocks.
- External services sit behind an interface the tests can replace.
- A structure that is hard to test is a design problem, not a testing problem.

### II. Simplicity First

*Source: software-design*

Principles applied mechanically produce over-engineering. The rule: **the simplest solution that keeps responsibilities separate.**

- Introduce an abstraction (trait, interface, base class, factory) only when at least one of these is true:
  1. there is a **second implementation** now (not "maybe later");
  2. it creates a **test seam** you need today;
  3. it isolates an **external dependency** (framework, service, database, OS API).
- No speculative configuration, plugin systems or generic frameworks for a single use case.
- Prefer composition over inheritance; prefer plain data and functions over class hierarchies.
- Three similar lines are better than a premature helper with five parameters.

#### Design patterns: only when they solve a real problem
| Problem actually present | Pattern that fits |
|---|---|
| Several interchangeable algorithms or providers chosen at runtime | Strategy |
| A third-party or legacy interface that does not match yours | Adapter |
| Construction is complex or depends on configuration | Factory / Builder |
| Behavior changes with an explicit lifecycle state | State machine |
| Actions must be queued, logged, undone or dispatched uniformly | Command |
| Persistence must be swappable or mocked | Repository |
| Several parts react to an event without knowing each other | Observer / event channel |

If you cannot point to the problem in the left column, do not use the pattern. Name the pattern in code or docs only when it helps the reader.

### III. Architecture Style: hexagonal

*Source: software-design/styles/hexagonal.md*

##### Structure

- **Core (domain + application services)**: entities, business rules, use cases and the **ports** they need (interfaces/traits for storage, providers, clocks, file systems). No framework, UI, transport or driver code.
- **Driving adapters** (input): CLI, TUI, HTTP handlers, RPC, MCP servers. They translate requests into core calls and core results into output.
- **Driven adapters** (output): database repositories, HTTP clients, model providers, file system access. They implement the core's ports.
- **Composition root**: one place per executable that builds the adapters and wires them into the core.

##### Dependency rule

Adapters depend on the core; the core depends on nothing outside itself except plain libraries (serialization, math, date handling). List the adapter and framework modules in `architecture.forbidden_core_imports` so `check_design` enforces the rule.

##### Where things go

| Piece | Location |
|---|---|
| A business rule or validation | Core service or entity |
| A new user command | Core command/use case, then one thin handler per surface |
| Database schema or query | Driven adapter implementing a core repository port |
| A new LLM, payment or storage provider | Driven adapter implementing an existing port |
| Output formatting, colors, layout | Driving adapter |

##### Common mistakes

- Business logic in a CLI handler or TUI event loop "because it was quicker".
- The core constructing its own HTTP client, database connection or UI widget.
- Ports shaped like the first adapter's API (leaking driver types into the core).
- A port for something with one implementation and no test need (see "Simplicity First").

### IV. Development Cycle

*Source: dev-cycle-protocol*

1. **Design**: modular code with clear responsibilities, SOLID, Clean Code, explicit errors, patterns only when needed, in the project's architecture style (`software-design`).
2. **Evidence**: every change is proven by automated tests; manual tests cover only what cannot be automated, in one curated suite (`quality-assurance`).
3. **Documentation describes today**: technical docs and README are edited in place; history lives in Git and release notes (`architecture-docs`, `user-docs`).
4. **Plans are shared and complete**: approved plans are versioned files in the project (`plan-memory`).
5. **Safe delivery**: short-lived branches on the project's branching model, CI on every pull request, release candidates, the user's release gate (`devops-release`).
6. **Security**: no secrets in Git, backward-compatible data migrations, a rollback path for every release.
7. **Bugs first**: open `critical`, `high` and `medium` bugs are planned and fixed before new features, improvements and adjustments; a `low` bug goes into the next release at the latest; no known bug stays untriaged (a severity, and a release for the ones that do not block). Only the user can explicitly accept the risk. Nothing found is lost, it is fixed now or captured in the backlog.
8. **Follow-through**: the agent follows CI and releases to the end and fixes what fails; the user's decisions (plan approval, candidate acceptance, the release gate) are never taken by the agent.
9. **No AI attribution, anywhere**: no artifact names an AI, a model or a coding agent as author, co-author, reviewer or source: commits and their trailers, tags, branches, pull and merge requests, reviews and review comments, issues, plans, documentation, release notes and code comments. Everything is authored by the repository's Git identity (`devops-release`). Configuration a project needs for its tools (an agent's settings folder, an integration name) is technical, not attribution. Text posted through any tool other than `pr_sync` (a platform tool, a connector, the web page) is checked first with `"<skills_root>/dev-cycle-protocol/bin/dev-cycle" dev-cycle-protocol _no_ai --file <text>`, and read back after posting: a footer, link or marker the tool appended ("Generated by ...", an agent's session or thread link) is edited out at once. Gate 8 also refuses commits whose author or committer is an AI identity.

## Product Requirements and Constraints

*Source: docs/product/TECH_SPEC.md*

### Non-Functional Requirements

#### Performance

- Extraction of one document, including PDF reading, under 1 second on a computer with 4 CPU cores and 8 GB of RAM; LSIE resolution alone under 10 ms per page.
- A batch of 100 one-page documents processed in under 60 seconds on the same computer, without the vision fallback.
- Application start to a usable screen in under 3 seconds.
- Local vision fallback under 5 seconds per page on CPU.

#### Security and Privacy

- Documents and extracted data are processed only on the user's computer and stored only in the customer's database (local SQLite or the central database the customer configures). Levix never receives documents or extracted values.
- No network call happens unless the user or the policy enables it: a model API endpoint, a central database or the Admin Hub. Each call is listed in the product manifest.
- Secrets (model API keys, connection strings) live only in the operating system keychain; never in the database, logs or `.docmapper` files.
- The license is verified offline against the Levix signature; policies are accepted only when signed by the Admin Hub key pinned at enrollment.
- Telemetry, when the Admin Hub is used, carries counts only, never content.
- Personal data in documents is under the customer's control, which supports GDPR and LGPD obligations.

#### Availability and Recovery

- The application works fully offline, except for the features the user points to the network.
- Corporate environment: the last valid policy and certificate apply for the validity the company sets (default 72 hours); after that only the corporate environment is suspended.
- Local SQLite is written in WAL mode; profiles can always be exported to `.docmapper` files as a backup. Backup of a central database is the customer's responsibility.

#### Accessibility and Localization

- Interface text in every language the product offers, with English as the source; extraction and stamping handle any Unicode text in documents.
- Keyboard access to every action and a minimum contrast ratio of 4.5:1 for text (WCAG 2.1 AA as the target).

### Constraints

- **Parity**: no behavior changes during the migration; each module switches only when its fixtures, fuzzing and shadow mode pass ([ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md)).
- **On-premise**: no Levix-hosted service in the processing path.
- **Final target 100% Rust**: no new Node.js or other runtime dependency in the product; the Vue interface and the parity oracle are the only temporary exceptions.
- **Shared code**: LSIE, licensing and policy code live in levix-platform; changes there are generic, go through pull requests, and must not break other products.
- **Third-party model licenses**: every default local model must allow commercial use and redistribution; licenses are checked per checkpoint before a model enters the catalog.
- **Development setup**: Rust toolchain and Node.js (until the Rust interface epic); no Docker and no server.

## Architecture Decisions

Accepted decisions; a plan that contradicts one needs a new ADR that supersedes it.

- ADR-0001: Tauri desktop app with a Rust core, toward a 100% Rust product (`docs/adr/0001-tauri-desktop-app-with-a-rust-core-toward-a-100-rust-product.md`)
- ADR-0002: Hexagonal architecture (`docs/adr/0002-hexagonal-architecture.md`)
- ADR-0003: Module-by-module migration with the TypeScript code as parity oracle (`docs/adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md`)
- ADR-0004: LSIE from the shared levix-platform crate (`docs/adr/0004-lsie-from-the-shared-levix-platform-crate.md`)
- ADR-0005: Deterministic extraction first, vision fallback through a generic model connector (`docs/adr/0005-deterministic-extraction-first-vision-fallback-through-a-gen.md`)
- ADR-0006: Profiles stored in a database: local SQLite by default, central database by connection string (`docs/adr/0006-profiles-stored-in-a-database-local-sqlite-by-default-centra.md`)
- ADR-0007: Licensing and policy enforcement through the levix-platform crates (`docs/adr/0007-licensing-and-policy-enforcement-through-the-levix-platform.md`)
- ADR-0008: Secrets in the operating system keychain (`docs/adr/0008-secrets-in-the-operating-system-keychain.md`)
- ADR-0009: PDF reading with pdfium and a fixed glyph tolerance (`docs/adr/0009-pdf-reading-with-pdfium-and-a-fixed-glyph-tolerance.md`)

## Governance

- This constitution supersedes other practices for specifications, plans and tasks. A plan passes the Constitution Check or records each justified violation in its Complexity Tracking table; a lasting exception becomes an ADR.
- Amendments change the source, not this file: an ADR for decisions, the technical specification for requirements and constraints, `.dev-cycle.json` for the architecture style, the skills for principles. Then run `constitution.py generate` and commit the result with the change.
- Gate 3 of the development cycle blocks a plan while this file is stale or edited by hand.

**Version**: 1.0.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08
