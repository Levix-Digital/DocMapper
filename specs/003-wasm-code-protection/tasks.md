# Tasks: WASM Code Protection

**Input**: Design documents from `/specs/003-wasm-code-protection/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install AssemblyScript dependencies and Vite plugins (vite-plugin-wasm, vite-plugin-top-level-await)
- [x] T002 Configure `vite.config.ts` to use WASM plugins
- [x] T003 Configure `package.json` with AssemblyScript build scripts (`asbuild`)
- [x] T004 Create `frontend/src/modules/core-wasm` project structure

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `assembly/interfaces/DocumentParser.ts` interface
- [x] T006 Create `assembly/index.ts` (Factory Entry Point) with empty Switch structure
- [x] T007 Implement `frontend/src/services/WasmService.ts` to load the WASM binary
- [x] T008 [P] Implement `assembly/utils/dates.ts` helper (Foundation for strategies)
- [x] T009 [P] Implement `assembly/utils/cleaning.ts` helper (Foundation for strategies)

**Checkpoint**: Foundation ready - Strategy implementation can now begin

---

## Phase 3: User Story 1 - Secure Client-Side Extraction (Priority: P1) 🎯 MVP

**Goal**: Move CMR Regex logic to WASM

**Independent Test**: Drop CMR PDF, verify extraction works, inspect sources (no TS visible)

### Implementation for User Story 1

- [x] T010 [US1] Create `assembly/parsers/cmr.ts` (Strategy Implementation)
- [x] T011 [US1] Port "Seal Number" extraction logic to AssemblyScript
- [x] T012 [US1] Port "Shipment Number" extraction logic to AssemblyScript
- [x] T013 [US1] Port "Consignments" extraction logic to AssemblyScript
- [x] T014 [US1] Port "Trailer Number" extraction logic to AssemblyScript
- [x] T015 [US1] Update `assembly/index.ts` Factory to include CMR Case
- [x] T016 [US1] Update `Editor.vue` to use `WasmService.process`
- [x] T017 [US1] **CRITICAL**: Delete `frontend/src/modules/cmr/extractor.ts`

**Checkpoint**: User Story 1 fully functional. Legacy code gone.

---

## Phase 4: User Story 2 - Modular Document Architecture (Priority: P2)

**Goal**: Prepare architecture for future documents (BOL) - Note: This is mostly architectural verification as the tasks are handled in Phase 2/3 Strategy Pattern setup.

### Implementation for User Story 2

- [x] T018 [US2] Verify `DocumentParser` interface is reusable
- [x] T019 [US2] Verify `index.ts` is open for extension

**(This Phase is largely covered by proper execution of T005 and T006, but T018/19 are verification steps)**

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T020 Run full build (`npm run build`) and verify `dist/` contains `.wasm` file
- [x] T021 Manual Test: Check `dist/` JS bundle does not contain Regex strings
