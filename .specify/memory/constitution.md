<!--
SYNC IMPACT REPORT
- Version change: Template -> 1.0.0
- Modified principles: Defined Principles I-V based on Copyx Spec.
- Added sections: Technology Stack & Constraints, Development Workflow.
- Templates requiring updates: 
  - .specify/templates/plan-template.md (Check for alignment with Privacy-First)
  - .specify/templates/spec-template.md (Ensure modularity sections are present)
-->
# Copyx Constitution

## Core Principles

### I. Privacy-First (Client-Side Processing)
All parsing, extraction, and data handling **MUST** occur in the browser (client-side). Personal or shipment data **MUST NOT** be stored on servers. The backend is strictly limited to user accounts, template metadata, mapping configurations, and user preferences.

### II. Modular Document Architecture
The system **MUST** be built as a set of independent document modules (e.g., CMR, BOL, PARS). Each module **MUST** implement a standard interface containing its own extractor, field schema, validator, mapping definitions, and exporters. Adding a new document type **MUST NOT** require changes to the core engine.

### III. User-Driven Flexibility
The system **MUST** avoid hardcoded document layouts for output. Users **MUST** be able to define their own templates and mappings. The architecture **MUST** support dynamic mapping of extracted fields to user-provided PDF templates.

### IV. Offline-First PWA
The application **MUST** be a Progressive Web App (PWA) capable of functioning offline. All heavy operations, including OCR (Tesseract.js) and PDF generation (pdf-lib), **MUST** run locally on the user's device.

### V. Visual Excellence & Usability
The interface **MUST** utilize a split-screen design (PDF Viewer vs. Editable Form) to maximize verification efficiency. The design **MUST** be premium, responsive, and utilize modern UI patterns (Vue 3 + TypeScript) to ensure a high-quality user experience.

## Technology Stack & Constraints

- **Frontend:** Vue 3 (Composition API) + TypeScript.
- **Backend:** NodeJS + TypeScript (strictly for metadata/auth).
- **Local Storage:** IndexedDB (via Dexie.js) for saving extraction profiles and work-in-progress.
- **PDF Processing:** pdf.js (parsing), pdf-lib (generation/modification).
- **OCR:** Tesseract.js (in-browser).
- **Validation:** Zod for runtime schema validation.

## Development Workflow

- **Module Implementation:** New document types must be implemented by creating a new module adhering to the `DocumentModule` interface.
- **Strict Typing:** All code **MUST** be written in TypeScript with strict mode enabled.
- **Testing:** Unit tests **MUST** be written for extractors and validators.
- **Verification:** Changes to the core engine **MUST** be verified against all existing document modules to ensure no regressions.

## Governance

- This constitution supersedes all other technical decisions and architectural choices.
- Amendments to these principles require a formal version bump and a consistency check across all dependent modules and templates.
- Any deviation from the "Privacy-First" principle requires explicit user consent and clear UI indication (e.g., for optional cloud AI features).

**Version**: 1.0.0 | **Ratified**: 2025-12-02 | **Last Amended**: 2025-12-02
