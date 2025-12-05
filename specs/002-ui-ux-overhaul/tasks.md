---
description: "Task list for UI/UX Overhaul implementation"
---

# Tasks: UI/UX Overhaul

**Input**: Design documents from `specs/002-ui-ux-overhaul/`
**Prerequisites**: plan.md, research.md, data-model.md
**Organization**: Phases based on dependencies (Setup -> Components -> Integration).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1 (Refactor Editor)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize dependencies and global styles.

- [x] T001 Install `lucide-vue-next` in package.json
- [x] T002 Configure tailwind.config.js with Brand Colors and Animations
- [x] T003 [P] Update style.css with Font Family and Utility Classes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create atomic components required for the UI.

**⚠️ CRITICAL**: Must complete before Editor refactor.

- [x] T004 Create `src/components/ui/Button.vue` (Primary/LED, Secondary, Ghost)
- [x] T005 [P] Create `src/components/ui/Card.vue` (Unified Panel style)
- [x] T006 [P] Create `src/components/layout/MainLayout.vue` (Header, Dark Mode Toggle)

**Checkpoint**: Components ready for story integration.

---

## Phase 3: User Story 1 - Editor Overhaul (Priority: P1) 🎯 MVP

**Goal**: Apply "Robot Shell" aesthetic to the main Editor view.

**Independent Test**: Verify drag-drop, loading, and results using new visual components.

### Implementation for User Story 1

- [x] T007 [US1] Wrap App.vue content in `<MainLayout>`
- [x] T008 [US1] Refactor `src/views/Editor.vue` to use `<Card>` and `<Button>`
- [x] T009 [US1] Implement Drag-Drop Zone visual in `src/views/Editor.vue`
- [x] T010 [US1] Implement Loading State (Spectrum Pulse) in `src/views/Editor.vue`
- [x] T011 [US1] Implement Validation visuals (Red/Green LED) in `src/views/Editor.vue`
- [x] T012 [US1] Add Icons (Upload, Download, File) to `src/views/Editor.vue`

**Checkpoint**: Full UI Overhaul complete.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Visual consistency checks.

- [x] T013 Verify Dark Mode contrast across all components
- [x] T014 Run build verification `vue-tsc`

---

## Phase 5: User Refinements

- [x] T015 Update Header Branding to "Copyx"
- [x] T016 Implement Page Footer (Privacy, Terms, Version)
- [x] T017 Implement "How it Works" Modal
- [x] T018 Update "CMR Processor" H1 to Action Title "Generate Receipts"

---

## Dependencies & Execution Order

1. **Setup (Phase 1)**: Blocks everything.
2. **Foundational (Phase 2)**: Blocks Phase 3. Button/Card can be built in parallel.
3. **Integration (Phase 3)**: Sequential after components are ready.
