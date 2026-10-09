# Implementation Plan: Visual Mapping Studio & LLM Pattern Extraction

**Branch**: `005-llm-extraction-and-mapping` | **Date**: 2026-10-08 | **Spec**: [specs/005-llm-extraction-and-mapping/spec.md](file:///c:/Users/guilh/source/repos/Copyx/specs/005-llm-extraction-and-mapping/spec.md)  
**Input**: Feature specification from `specs/005-llm-extraction-and-mapping/spec.md`

## Summary

Build an interactive, browser-native **Visual Mapping Studio** (`/mapping`) and client-side extraction engine for Copyx. Operators can upload any sample PDF (e.g., CMR), visually draw paired Label/Value bounding boxes over an SVG-rendered PDF canvas, generate deterministic regex validation patterns via Google Gemini (setup phase only), map destination placement coordinates on target PDF templates (rendering as text, Code 128, or QR Code), and run high-speed batch extractions 100% locally in the browser with zero cloud document upload.

## Technical Context

**Language/Version**: TypeScript 5.9, Vue 3.5 (Composition API)  
**Primary Dependencies**: `pdfjs-dist` (v5.4.x), `pdf-lib` (v1.17.x), `jsbarcode` (v3.12.x), `qrcode` (v1.5.x), `lucide-vue-next`, Tailwind CSS  
**Storage**: Client-side `IndexedDB` / `localStorage` (`copyx_mapping_profiles`) + portable `.copyx` self-contained JSON packages (Base64 destination template included)  
**Testing**: Manual interactive test suite + component/service unit verification  
**Target Platform**: Modern Desktop Browsers (Chrome, Edge, Firefox, Brave) on Windows/macOS/Linux  
**Project Type**: Web Application (Single-Page App with client-side reactive routing)  
**Performance Goals**: < 500ms per page runtime extraction (SC-001)  
**Constraints**: Zero-knowledge document processing (Principle 2: no document uploads to servers), deterministic runtime (Principle 3: zero LLM calls in batch runs), lightweight SVG overlay (no heavy external canvas frameworks like Fabric.js/Konva)  
**Scale/Scope**: Arbitrary multi-page PDF documents, up to 100+ documents per batch, instant profile import/export  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Justification |
|-----------|-------------|--------|---------------|
| **1. Simplicity First** | Minimal local tooling, standard browser runtime (`npm install && npm run dev`) | **PASS** | Runs purely in browser using existing Vite build. No Docker, no new backend services. |
| **2. Privacy by Design** | All document processing and extraction local to browser | **PASS** | PDFs are parsed in `pdfjs-dist` and stamped via `pdf-lib` in the browser memory. Zero document data sent to remote servers. |
| **3. Deterministic over Probabilistic** | Prefer explicit extraction logic over AI for core workflows | **PASS** | Runtime extraction uses spatial coordinates + regex validation. Gemini is strictly used during setup to create the regex rules; batch runtime has 0 LLM calls. |
| **4. Modern Stack Standard** | Vue 3 Composition API, TypeScript, Tailwind CSS | **PASS** | Pure `<script setup lang="ts">`, reactive composables, Tailwind utility styling. |

## Project Structure

### Documentation (this feature)

```text
specs/005-llm-extraction-and-mapping/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan output)
└── tasks.md             # Actionable task list (/speckit.tasks output)
```

### Source Code Architecture

```text
frontend/src/
├── types/
│   └── mapping.ts                           # Data contracts (BoundingBox, FieldDefinition, MappingProfile, etc.)
├── composables/
│   └── useRouter.ts                         # Lightweight reactive client-side router (/ and /mapping)
├── services/
│   ├── pdf/
│   │   ├── spatial-extractor.ts             # Geometry-based text item extraction using pdfjs-dist transforms
│   │   └── dynamic-stamper.ts               # pdf-lib coordinate stamper (text auto-fit, Code128, QR Code)
│   ├── llm/
│   │   └── gemini-service.ts                # Direct client REST call to Gemini for pattern generation (Setup only)
│   └── mapping/
│       ├── profile-store.ts                 # LocalStorage/IndexedDB persistence + .copyx import/export
│       └── mapping-runner.ts                # Batch runtime execution (spatial query + regex validation + confidence)
├── components/
│   ├── layout/
│   │   └── MainLayout.vue                   # Updated header with navigation between Processor and Studio
│   └── mapping/
│       ├── InteractivePdfCanvas.vue         # Reactive SVG overlay over PDF canvas (drag, resize, color grouping)
│       ├── FieldListDrawer.vue              # Sidebar for field management, Gemini pattern triggers, regex testing
│       ├── DestinationPlacementCanvas.vue   # Target template canvas to map destination coordinates and render modes
│       └── ProfileManagementModal.vue       # Profile hub (Export .copyx, Duplicate, Delete, Rename)
└── views/
    ├── MappingStudio.vue                    # Visual Mapping Studio view (/mapping)
    └── Editor.vue                           # Main document processor updated with Profile selector
```

## Detailed Component & Service Architecture

### 1. Data Models (`frontend/src/types/mapping.ts`)
- `BoundingBox`: `{ x: number, y: number, width: number, height: number, page: number }` (normalized 0-100%).
- `FieldDefinition`: `{ id: string, name: string, color: string, labelBox?: BoundingBox, valueBox: BoundingBox, validationPattern: string, dataType: 'text' | 'alphanumeric' | 'date' | 'number' | 'multiline', isRequired: boolean }`.
- `DestinationFieldMapping`: `{ id: string, fieldId: string, targetBox: BoundingBox, renderFormat: 'TEXT' | 'CODE128' | 'QR_CODE', fontSize?: number }`.
- `MappingProfile`: `{ id: string, name: string, version: number, createdAt: string, updatedAt: string, fields: FieldDefinition[], destinationTemplateBase64?: string, destinationMappings: DestinationFieldMapping[] }`.
- `ExtractionResult`: `{ documentIndex: number, fileName: string, extractedData: Record<string, string>, confidenceScores: Record<string, number>, overallConfidence: number, status: 'APPROVED' | 'FAILED', pdfBlob?: Blob }`.

### 2. Spatial Extractor (`frontend/src/services/pdf/spatial-extractor.ts`)
- Utilizes `page.getTextContent({ includeMarkedContent: true })`.
- Extracts individual glyph/item bounding boxes via transformation matrix:
  $x = transform[4]$, $y = transform[5]$, $w = item.width$, $h = item.height$.
- Normalizes PDF coordinate space (bottom-left origin) to canvas SVG coordinate space (top-left origin).
- Queries all text tokens whose bounding boxes intersect or fall inside the normalized `BoundingBox` (with configurable padding tolerance).
- Concatenates words logically preserving visual line breaks.

### 3. Setup-Only LLM Pattern Generator (`frontend/src/services/llm/gemini-service.ts`)
- Direct client REST call using `fetch` to Google Gemini API (`gemini-2.0-flash` or `gemini-1.5-flash`).
- Prompts Gemini with: Label name, sample text extracted from Value Box, and surrounding document snippet.
- Requests strict JSON schema response: `{ regex: string, dataType: string, sampleMatch: boolean, explanation: string }`.
- Provides graceful fallback: if API key is not configured or network fails, user can manually input or refine regex pattern.
- User API key saved in browser `localStorage.getItem('copyx_gemini_api_key')`.

### 4. Interactive SVG Canvas (`frontend/src/components/mapping/InteractivePdfCanvas.vue`)
- Renders PDF page to underlying `<canvas>` via `pdfjs-dist`.
- Superimposes a reactive `<svg class="absolute inset-0 w-full h-full">` layer.
- Mouse events (`mousedown`, `mousemove`, `mouseup`) handle box drawing and interactive handles (corners) for resizing.
- Stores coordinates as percentage of page width/height so zoom levels and responsive resizing never distort anchors.
- Renders paired Label (dashed outline) and Value (solid outline) boxes with matching dynamic color tag per field.

### 5. Destination Placement & Dynamic Stamper (`dynamic-stamper.ts`)
- Loads destination template PDF via `PDFDocument.load(templateBytes)`.
- For `TEXT`: draws text using `page.drawText` with Helvetica/Courier, calculating font size to prevent overflow.
- For `CODE128`: renders barcode offscreen via `JsBarcode` onto a canvas, converts to PNG buffer, embeds in `PDFDocument`, and draws at `targetBox` coordinates.
- For `QR_CODE`: renders QR code offscreen via `qrcode`, converts to PNG buffer, embeds in `PDFDocument`, and draws at `targetBox` coordinates.

### 6. Profile Store & Portability (`profile-store.ts`)
- Manages profiles in `localStorage` under `copyx_mapping_profiles`.
- Exports profile as a standalone `.copyx` JSON file with destination PDF template embedded as Base64.
- Imports `.copyx` file, auto-resolving name collisions with numeric suffixes `Profile (1)`.

### 7. Main Processor Integration (`Editor.vue` & `mapping-runner.ts`)
- Adds a Profile Selector dropdown to the main document upload screen.
- Default selection: "Standard CMR (Built-in)".
- Custom profiles: when selected, batch runs bypass hardcoded CMR parser and execute `mapping-runner.ts` using the chosen profile's spatial coordinates and regex validation.
- Displays confidence score badge (0-100%) per file and allows downloading generated PDFs and `summary.csv`.

## Implementation Phases

- **Phase 1: Dependencies & Core Types**: Install `qrcode`, implement `types/mapping.ts` contracts.
- **Phase 2: PDF Spatial Extraction Service**: Implement `spatial-extractor.ts` and test coordinate extraction against PDF sample pages.
- **Phase 3: Dynamic PDF Stamper Service**: Implement `dynamic-stamper.ts` supporting Text, Code 128, and QR Code stamping via `pdf-lib`.
- **Phase 4: Profile Storage & Portability**: Implement `profile-store.ts` for local persistence and `.copyx` JSON import/export.
- **Phase 5: Gemini Pattern Generator**: Implement `gemini-service.ts` for setup-time regex generation with manual fallback.
- **Phase 6: Visual Mapping Studio UI**: Build `InteractivePdfCanvas.vue`, `FieldListDrawer.vue`, `DestinationPlacementCanvas.vue`, and assemble `MappingStudio.vue`.
- **Phase 7: Navigation & Router**: Implement lightweight router and update `MainLayout.vue` with tab switcher.
- **Phase 8: Main Processor Integration**: Update `Editor.vue` and `mapping-runner.ts` to execute custom profiles in batch mode.
- **Phase 9: End-to-End Verification**: Verify all 4 user stories, edge cases, and success criteria SC-001 to SC-004.
