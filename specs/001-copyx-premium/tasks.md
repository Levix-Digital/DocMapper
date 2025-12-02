# Tasks: Copyx Premium Version

**Feature**: Copyx Premium Version
**Status**: Planned
**Total Tasks**: 39

## Phase 1: Setup
*Goal: Initialize project structure and dependencies.*

- [ ] T001 Initialize monorepo structure (frontend/backend) in `root`
- [ ] T002 Install frontend dependencies (Vue3, Pinia, Tailwind, pdf-lib, tesseract.js) in `frontend/package.json`
- [ ] T003 Install backend dependencies (Node, Express, PG, Zod) in `backend/package.json`
- [ ] T004 Configure TailwindCSS in `frontend/tailwind.config.js`
- [ ] T005 Setup Vitest and Playwright in `frontend/vite.config.ts`

## Phase 2: Foundational
*Goal: Core architecture and storage.*

- [ ] T006 Define `DocumentModule` interface in `frontend/src/modules/core/types.ts`
- [ ] T007 Setup Dexie (IndexedDB) store in `frontend/src/services/storage/db.ts`
- [ ] T008 Implement `ExtractionProfile` store logic in `frontend/src/stores/extraction-profile.ts`
- [ ] T009 Implement `CompanyProfile` store logic in `frontend/src/stores/company-profile.ts`
- [ ] T010 [P] Setup Backend Auth (JWT) in `backend/src/controllers/auth.ts`
- [ ] T011 [P] Setup Backend Sync Endpoint (Encrypted Blob) in `backend/src/controllers/sync.ts`

## Phase 3: User Story 1 - Core CMR Extraction
*Goal: Upload, extract, verify, and correct CMR documents.*

- [ ] T012 [US1] Create CMR Module structure in `frontend/src/modules/cmr/`
- [ ] T013 [US1] Implement CMR Extractor (Regex/Tesseract) in `frontend/src/modules/cmr/extractor.ts`
- [ ] T014 [US1] Implement CMR Validator (Zod) in `frontend/src/modules/cmr/validator.ts`
- [ ] T015 [US1] Create Split-Screen Layout Component in `frontend/src/components/split-screen/SplitScreen.vue`
- [ ] T016 [US1] Integrate PDF.js Viewer in `frontend/src/components/pdf-viewer/PdfViewer.vue`
- [ ] T017 [US1] Implement Reactive Form for CMR in `frontend/src/modules/cmr/components/CmrForm.vue`
- [ ] T018 [US1] Connect Extraction to Form (Auto-fill) in `frontend/src/views/Editor.vue`
- [ ] T019 [US1] Implement "Save Correction" logic in `frontend/src/services/learning/correction-service.ts`

## Phase 4: User Story 2 - Multi-Template Generation
*Goal: Generate multiple output formats from one dataset.*

- [ ] T020 [US2] Create Template Engine Service in `frontend/src/services/pdf/template-engine.ts`
- [ ] T021 [US2] Implement `pdf-lib` generation logic for CMR in `frontend/src/modules/cmr/exporter.ts`
- [ ] T022 [US2] Create "Delivery Receipt" Module (simplified) in `frontend/src/modules/receipt/`
- [ ] T023 [US2] Implement Multi-Template Selection UI in `frontend/src/components/generation/TemplateSelector.vue`
- [ ] T024 [US2] Implement Batch Generation Logic in `frontend/src/services/pdf/batch-generator.ts`
- [ ] T037 [US2] Implement Data Export Service (XML/JSON) in `frontend/src/services/export/data-exporter.ts`

## Phase 5: User Story 3 - Hybrid AI Extraction
*Goal: Optional Cloud AI for complex docs.*

- [ ] T025 [US3] Create OpenAI Service in `frontend/src/services/ai/openai.ts`
- [ ] T026 [US3] Implement BYOK Settings UI in `frontend/src/views/Settings.vue`
- [ ] T027 [US3] Create "Hybrid Extractor" wrapper in `frontend/src/modules/core/hybrid-extractor.ts`
- [ ] T028 [US3] Add "Try with AI" button and Consent Modal in `frontend/src/components/extraction/AiConsentModal.vue`

## Phase 6: User Story 4 - Team Profiles & Barcodes
*Goal: Professional features and sync.*

- [ ] T029 [US4] Create Company Profile Management UI in `frontend/src/views/Profiles.vue`
- [ ] T030 [US4] Implement QR Code Generation Utility in `frontend/src/services/pdf/qrcode.ts`
- [ ] T031 [US4] Integrate QR Code into PDF Generation pipeline in `frontend/src/services/pdf/template-engine.ts`
- [ ] T032 [US4] Implement Encrypted Sync Client in `frontend/src/services/sync/sync-client.ts`
- [ ] T033 [US4] Connect Sync Client to Pinia Stores in `frontend/src/stores/sync-plugin.ts`
- [ ] T038 [US4] Implement Backend Email Service (Nodemailer) in `backend/src/services/email.ts`
- [ ] T039 [US4] Implement Invite User Endpoint in `backend/src/controllers/team.ts`

## Phase 7: Polish
*Goal: Final verification and optimization.*

- [ ] T034 Verify Offline Mode (Service Worker) in `frontend/src/main.ts`
- [ ] T035 Verify Export Limits (Paged Export) in `frontend/src/services/export/bulk-export.ts`
- [ ] T036 Final UI Polish (Dark Mode, Transitions) in `frontend/src/App.vue`

## Dependencies

- **Phase 1 & 2** are prerequisites for ALL User Stories.
- **Phase 3 (US1)** is a prerequisite for US2 and US3.
- **Phase 4 (US2)** and **Phase 5 (US3)** can be done in parallel.
- **Phase 6 (US4)** depends on Phase 2 (Stores) and Phase 4 (PDF Gen).

## Implementation Strategy

We will start by building the **Core CMR Module** (US1) to prove the "Privacy-First" extraction and "Split-Screen" UI. Once the core loop (Upload -> Extract -> Edit -> Save) is working, we will add the "Premium" layers: Multi-Template (US2), AI (US3), and Sync (US4).
