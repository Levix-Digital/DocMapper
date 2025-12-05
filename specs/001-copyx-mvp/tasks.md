# Tasks: Copyx MVP (Porting Reference App)

**Input**: Design documents from `/specs/001-copyx-mvp/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Manual verification against reference app output.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install dependencies (jsbarcode, jszip, file-saver) in frontend/package.json
- [x] T002 Create assets file for base64 template in frontend/src/services/pdf/assets.ts
- [x] T003 [P] Define CMRData interfaces in frontend/src/modules/cmr/types.ts

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Port Regex extraction logic to frontend/src/modules/cmr/extractor.ts
- [x] T005 Update Template Engine to use embedded asset in frontend/src/services/pdf/template-engine.ts
- [x] T006 Implement Barcode generation logic in frontend/src/services/pdf/template-engine.ts

**Checkpoint**: Core logic (Extraction + Generation) ready.

## Phase 3: User Story 1 - Generate Standard Shipment Document from CMR (Priority: P1) 🎯 MVP

**Goal**: Upload CMR, Extract Data, Generate PDF, and Download.

**Independent Test**: Upload `CMRs.pdf` -> Check generated file fields.

### Implementation for User Story 1

- [x] T007 [US1] Remove Tesseract/Worker logic from frontend/src/views/Editor.vue
- [x] T008 [US1] Implement Drag-and-Drop UI in frontend/src/views/Editor.vue
- [x] T009 [US1] Wire up Extraction -> Generation loop in frontend/src/views/Editor.vue
- [x] T010 [US1] Implement "Download All" (ZIP) functionality in frontend/src/views/Editor.vue

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Story 1 (Phase 3)**: Depends on Foundational logic

### Within Each User Story

- Core logic (extractor/engine) before UI (Editor.vue)

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational Logic
3. Complete Phase 3: Integration in Editor.vue
4. **STOP and VALIDATE**: Test manually with `CMRs.pdf`
5. Deploy/Demo
