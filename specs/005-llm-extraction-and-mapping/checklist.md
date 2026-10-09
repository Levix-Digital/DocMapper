# Quality & Requirements Checklist: Visual Mapping Studio & LLM Pattern Extraction

**Purpose**: Validate requirements completeness, architectural clarity, edge case coverage, and consistency  
**Created**: 2026-10-08  
**Feature**: [spec.md](file:///c:/Users/guilh/source/repos/DocMapper/specs/005-llm-extraction-and-mapping/spec.md) | [plan.md](file:///c:/Users/guilh/source/repos/DocMapper/specs/005-llm-extraction-and-mapping/plan.md)  
**Status**: 100% Verified

---

## 1. Constitution & Architectural Principles Compliance

- [x] CHK001 **Zero Server Upload (Principle 2)**: Are all PDF parsing, text extraction, template rendering, and profile storage executed strictly in-browser without network calls transmitting document contents?
- [x] CHK002 **Deterministic Runtime (Principle 3)**: Is batch document processing 100% deterministic (spatial coordinates + regex validation) with zero LLM API calls during regular execution?
- [x] CHK003 **No-Container Simplicity (Principle 1)**: Can the full application run without any new background service, container, or backend API changes?
- [x] CHK004 **Stack Consistency (Principle 4)**: Are all new components and services written using Vue 3 Composition API (`<script setup lang="ts">`), TypeScript 5.9, and Tailwind CSS?

---

## 2. Visual Mapping Studio (`/mapping`) & Origin Canvas (US1)

- [x] CHK005 **Interactive SVG Canvas**: Can users upload a sample PDF and see page rendering with responsive SVG overlays supporting drag-to-draw, resize handles, and selection?
- [x] CHK006 **Normalized Coordinates**: Are all bounding boxes stored as percentages `(x%, y%, width%, height%, pageNumber)` so zoom level and screen resizing do not alter spatial anchors?
- [x] CHK007 **Label/Value Grouping**: Does the UI visually link paired Label (dashed outline) and Value (solid outline) boxes with matching distinctive color tags?
- [x] CHK008 **Multi-Page Navigation**: Can users switch between pages on multi-page sample documents and define fields across different pages?
- [x] CHK009 **Spatial Text Extraction**: Does `spatial-extractor.ts` accurately extract glyphs/words strictly inside the bounding box based on `pdfjs-dist` transformation matrices?
- [x] CHK010 **Multi-Line & Text Flow Handling**: Does spatial extraction properly handle multi-line text (e.g. addresses) preserving word order?
- [x] CHK011 **Scanned PDF Notification**: If a PDF page contains no digital text stream (scanned/raster only), does the canvas notify the operator that OCR pre-processing is required?

---

## 3. Setup-Only LLM Pattern Generator & Rule Fallback (US1)

- [x] CHK012 **Gemini Prompt & Schema**: Does `gemini-service.ts` supply the label name, sample extracted text, and document context, enforcing a strict JSON response schema (`regex`, `dataType`, `sampleMatch`, `explanation`)?
- [x] CHK013 **API Key Storage**: Is the Gemini API key stored securely in local browser storage (`localStorage`), never hardcoded or sent to Levix backend?
- [x] CHK014 **Sample Test & Confidence**: Does the studio run an immediate test of the generated regex against the sample value, displaying 100% confidence when matching?
- [x] CHK015 **Offline / Manual Fallback**: If the Gemini API is unreachable or the user opts out of AI, can regex patterns and data types be edited or created manually?

---

## 4. Destination Template Placement & Rendering (US2)

- [x] CHK016 **Template Upload & Page Navigation**: Can operators upload any destination PDF template and inspect its pages on an interactive placement canvas?
- [x] CHK017 **Target Placement Boxes**: Can operators draw destination boxes and bind each to an origin field definition?
- [x] CHK018 **Text Auto-Fit**: When rendering formatted text, does `dynamic-stamper.ts` calculate dynamic font sizes (8–14pt) to prevent text clipping within destination boxes?
- [x] CHK019 **Code 128 Barcode Rendering**: When render format is `CODE128`, does the stamper generate a clean 1D barcode image via `JsBarcode` and embed it accurately at target coordinates?
- [x] CHK020 **QR Code Rendering**: When render format is `QR_CODE`, does the stamper generate a 2D QR code via `qrcode` and embed it at target coordinates?

---

## 5. Local Persistence & Portable Sharing (US2, US4)

- [x] CHK021 **Browser Storage Persistence**: Are saved `MappingProfile` objects stored in `localStorage` / `IndexedDB` and reloaded automatically on app startup?
- [x] CHK022 **Self-Contained `.docmapper` Export**: Does exporting a profile download a single `.docmapper` JSON file embedding field coordinates, regex rules, and the destination PDF template as Base64?
- [x] CHK023 **Drop & Pick Import**: Can a `.docmapper` file be imported by drag-and-drop or file picker in any browser session without external network requests?
- [x] CHK024 **Duplicate Profile Naming**: When importing or duplicating a profile with an existing name, does the store append an incrementing suffix `(1)` to avoid overwriting existing profiles?
- [x] CHK025 **Profile Management Actions**: Can users rename, duplicate, delete, and set default profiles from the Profile Management Hub?

---

## 6. Runtime Batch Execution & Document Processor (US3)

- [x] CHK026 **Profile Selection in Processor**: Does `Editor.vue` provide a clean Profile Selector dropdown allowing users to choose between "Standard CMR (Built-in)" and any custom profiles?
- [x] CHK027 **Batch Spatial Execution**: When a custom profile is active, does `mapping-runner.ts` process each uploaded PDF using local spatial queries and regex validation?
- [x] CHK028 **Confidence Scoring**: Does the runtime calculate an individual confidence score per field and an overall document score (0–100%)?
- [x] CHK029 **Performance Benchmark (< 500ms/page)**: Does execution on standard client hardware meet the < 500ms per page threshold (SC-001)?
- [x] CHK030 **Batch Output & Export**: Can generated destination documents be previewed in-app, downloaded individually, or downloaded as a batch `.zip` archive with `summary.csv`?

---

## 7. Navigation, Routing & Non-Regression

- [x] CHK031 **Header Navigation**: Does `MainLayout.vue` provide direct tab navigation between "Document Processor" (`#/`) and "Mapping Studio" (`#/mapping`)?
- [x] CHK032 **Backward Compatibility**: Does the existing hardcoded CMR processing flow continue to function completely untouched when the default profile is selected?
- [x] CHK033 **TypeScript & Build Sanity**: Does `npm run build` (`vue-tsc -b && vite build`) compile with zero errors and zero type warnings?
