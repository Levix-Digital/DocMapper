# Implementation Plan: Copyx Premium Version

**Branch**: `001-copyx-premium` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-copyx-premium/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The **Copyx Premium Version** transforms the application into a professional-grade PWA for logistics documentation. Key enhancements include a **Modular Document Engine** for supporting multiple document types (starting with CMR), **Hybrid AI Extraction** (OpenAI GPT-4o with BYOK) for complex files, **Team/Company Profiles** with encrypted cloud sync, and **Multi-Template Output** capabilities. The architecture adheres strictly to **Privacy-First** principles by performing all OCR, parsing, and generation client-side, using the backend only for encrypted profile sync and auth.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict Mode)
**Primary Dependencies**: 
- **Frontend**: Vue 3 (Composition API), Pinia (State), Vue Router
- **PDF/OCR**: `pdf-lib` (Generation/Editing), `pdf.js` (Rendering), `tesseract.js` (OCR)
- **Storage**: `dexie` (IndexedDB wrapper)
- **Validation**: `zod`
- **UI**: TailwindCSS (presumed based on "Premium" reqs), Headless UI or similar
**Storage**: 
- **Local**: IndexedDB (Dexie.js) for Extraction Profiles, Drafts, App State
- **Remote**: Node.js + PostgreSQL (Metadata, Auth, Encrypted Blobs)
**Testing**: `vitest` (Unit), `playwright` (E2E)
**Target Platform**: Modern Browsers (PWA), Offline-First
**Project Type**: Web Application (Monorepo: Frontend + Backend)
**Performance Goals**: <5s for multi-template generation, smooth 60fps split-screen resizing.
**Constraints**: 
- **Offline-First**: Must function without network (except Sync/AI).
- **Client-Side Only**: No sensitive data sent to backend (except encrypted blobs).
- **BYOK AI**: User provides API key for AI features.
**Scale/Scope**: Modular architecture to support N document types.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Check |
|-----------|--------|-------|
| **I. Privacy-First** | ✅ PASS | Core processing (OCR, Parsing, Gen) is client-side. Sync is encrypted. |
| **II. Modular Arch** | ✅ PASS | Plan includes `DocumentModule` interface implementation. |
| **III. User Flexibility** | ✅ PASS | Drag-and-drop mapping and multi-template output supported. |
| **IV. Offline-First** | ✅ PASS | PWA architecture with local IndexedDB and Tesseract.js. |
| **V. Visual Excellence** | ✅ PASS | Split-screen UI and premium design specs included. |

## Project Structure

### Documentation (this feature)

```text
specs/001-copyx-premium/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── modules/             # Modular Document Engines
│   │   ├── core/            # Base interfaces (DocumentModule, etc.)
│   │   └── cmr/             # CMR Implementation
│   ├── components/          # Shared UI Components
│   │   ├── split-screen/    # Split view logic
│   │   └── pdf-viewer/      # PDF.js wrapper
│   ├── stores/              # Pinia stores (Profiles, Sync)
│   ├── services/            # Core services
│   │   ├── storage/         # Dexie/IndexedDB
│   │   ├── sync/            # Encrypted Sync Service
│   │   ├── ai/              # OpenAI Integration
│   │   └── pdf/             # pdf-lib generation logic
│   └── views/
└── tests/

backend/
├── src/
│   ├── controllers/         # Auth, Sync endpoints
│   ├── middleware/          # Auth checks
│   └── services/            # Database interaction
└── tests/
```

**Structure Decision**: Standard Monorepo with `frontend` and `backend` directories. The `modules` directory in frontend is key for the Modular Document Architecture.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | | |
