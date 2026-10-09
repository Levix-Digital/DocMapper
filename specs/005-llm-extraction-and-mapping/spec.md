# Feature Specification: Visual Mapping Studio & LLM Pattern Extraction

**Feature Branch**: `005-llm-extraction-and-mapping`  
**Created**: 2026-10-08  
**Status**: Draft  
**Input**: Interactive visual mapping studio for customizable document extraction using spatial anchors, LLM-generated validation patterns, destination template placement, and high-speed client-side execution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Field Mapping & LLM Pattern Generation (Priority: P1)

As a logistics operator, I want to upload a sample document (such as a CMR PDF) and visually draw bounding boxes for Labels and Values, so that the system records their spatial positions and uses an LLM to generate robust data validation rules.

**Why this priority**: Core value proposition. Eliminates hardcoded document structures and allows Copyx to extract data from any document format.

**Independent Test**: Upload a sample `CMR.pdf` on `/mapping`, draw boxes around "Shipment" and "Seal", trigger rule generation via Gemini, and verify that the system extracts and validates the values from the sample page.

**Acceptance Scenarios**:

1. **Given** a sample document rendered on an interactive canvas, **When** the user draws bounding boxes for a **Label** (e.g., "Shipment:") and a **Value** (e.g., "015-TSO-1234"), **Then** the system visually groups them with matching colors, assigns a field name, and stores their normalized coordinates `(x, y, w, h)` and page number.
2. **Given** the defined field pair, **When** pattern generation is requested, **Then** Google Gemini analyzes the context to produce a deterministic format validation rule (regex mask and data type).
3. **Given** the generated validation rule, **When** tested against the sample document, **Then** the system displays an immediate preview with confidence score (100% on sample) and allows the user to accept or manually edit the pattern.

---

### User Story 2 - Destination Template Mapping & Profile Persistence (Priority: P1)

As an operator, I want to upload a destination document (PDF template) and map where the extracted fields should be placed, so that I can generate filled delivery documents automatically.

**Why this priority**: Completes the end-to-end transformation pipeline (Origin Document ➡️ Destination Template).

**Independent Test**: Upload a destination PDF template, draw target boxes for "Shipment" and "Seal", choose render format (Text vs Barcode), save the profile, and verify it appears in the profile selector.

**Acceptance Scenarios**:

1. **Given** an uploaded destination template on `/mapping`, **When** the user draws target boxes and links each to an extracted field, **Then** the system binds the source field definition to the target coordinates.
2. **Given** a destination box, **When** configuring its properties, **Then** the user can choose whether the value renders as formatted text, a **Code 128 1D Barcode**, or a **2D QR Code**.
3. **Given** complete origin and destination mappings, **When** the user clicks "Save Profile", **Then** the system stores the `MappingProfile` in local browser storage (`IndexedDB` / `localStorage`).

---

### User Story 3 - High-Speed Client-Side Runtime Execution (Priority: P1)

As an operator processing batches of documents, I want the system to extract data and generate destination PDFs client-side in milliseconds without recurring AI API latency or cloud data leakage.

**Why this priority**: Preserves Copyx's core value proposition: ultra-fast processing and zero-knowledge client-side privacy (Constitution Principles 1 & 2).

**Independent Test**: Select a saved profile on the main document processor, upload a batch of PDFs, and verify processing completes locally in milliseconds without external network calls for extraction.

**Acceptance Scenarios**:

1. **Given** a batch of uploaded PDFs and an active `MappingProfile`, **When** batch processing executes, **Then** the runtime engine extracts text within the mapped spatial boundaries and validates values against the profile's validation rules without calling remote LLMs.
2. **Given** valid matches, **When** generation completes, **Then** destination PDFs are rendered with stamped fields and barcodes, appearing in the output stream ready for preview, individual download, or ZIP download with `summary.csv`.

---

### User Story 4 - Portable Profile Sharing (Priority: P1)

As an operator, I want to export and import mapping profiles as self-contained files, so that I can share mappings with colleagues or back them up without cloud dependencies.

**Why this priority**: Essential for team usability while keeping all document data strictly local (Constitution Principle 2).

**Independent Test**: Export a profile to a `.copyx` file, open the app in another browser session, import the file, and verify documents can be processed immediately without re-uploading templates.

**Acceptance Scenarios**:

1. **Given** a saved profile, **When** the user clicks "Export Profile", **Then** the system downloads a self-contained `.copyx` (JSON) file packaging all field rules, spatial coordinates, and the destination PDF template encoded in Base64.
2. **Given** an exported `.copyx` file, **When** selected or dragged into the application, **Then** the profile is instantly imported and ready for production use. If a profile with the same name already exists, an incrementing numeric suffix (e.g., `Profile (1)`) is appended to prevent overwrites.

---

### Edge Cases

- **PDF Text Stream Disordering**: In many PDFs, text stream order does not match visual layout. The system MUST query text elements based on spatial bounding boxes `(x, y, w, h)` rather than relying purely on concatenated string offsets.
- **Scanned / Raster-Only PDFs**: If a PDF page contains no digital text stream, the system MUST notify the user that OCR pre-processing is required.
- **Multi-line Values**: Fields like addresses or remarks can span multiple lines. Spatial anchors MUST capture all text items within the vertical bounds of the box.
- **Offline / LLM Unavailable during Setup**: If Gemini API is unreachable during setup, the user MUST be able to manually enter or edit the validation regex pattern.
- **Print Jitter / Scan Offsets**: Scans or printer margins can shift text slightly. Spatial matching MUST include configurable tolerance margins (padding around bounding boxes).

---

## Requirements *(mandatory)*

### Functional Requirements

#### Visual Mapping Studio (`/mapping`)
- **FR-001**: System MUST provide a dedicated `/mapping` route and interface accessible from the main navigation header.
- **FR-002**: System MUST render uploaded origin PDFs on an interactive canvas allowing drag-and-drop creation, selection, resizing, and deletion of bounding boxes.
- **FR-003**: System MUST support creating paired **Label** and **Value** boxes sharing a distinct color per field, supporting multi-page documents with page navigation.
- **FR-004**: System MUST record spatial coordinates normalized to page dimensions `(x %, y %, width %, height %, pageNumber)` to remain resolution- and zoom-independent.
- **FR-005**: System MUST extract digital text located strictly within the defined spatial boxes using `pdf.js` text positioning coordinates.
- **FR-006**: System MUST integrate Google Gemini in the setup phase to generate a data validation pattern (regex format mask) and semantic data type based on the selected label and value context.
- **FR-007**: System MUST provide an instant self-test mechanism on the mapping screen to verify that the generated rule matches the sample value.
- **FR-008**: System MUST allow fallback to manual regex rule editing if LLM generation is skipped or fails.

#### Destination Template & Placement
- **FR-009**: System MUST allow users to upload a destination PDF template, navigate pages, and draw target placement boxes mapped to defined source fields.
- **FR-010**: System MUST allow designating whether each target placement box renders as plain formatted text, a **Code 128 1D Barcode**, or a **2D QR Code**.

#### Profile Storage & Portable Sharing
- **FR-011**: System MUST store mapping profiles client-side in the browser (`IndexedDB` / `localStorage`) and ensure zero customer profile, template, or document data is transmitted to remote servers (Constitution Principle 2).
- **FR-012**: System MUST export complete, self-contained portable profile packages (`.copyx` file format, serialized JSON) containing field definitions, spatial coordinates, validation rules, and the destination PDF template encoded in Base64.
- **FR-013**: System MUST support importing `.copyx` profile packages via file picker or drag-and-drop, instantly hydrating the profile ready for production use.
- **FR-014**: System MUST provide a Profile Management Hub on `/mapping` featuring actions to Edit, Duplicate, Delete, and Export `.copyx`.

#### Runtime Batch Extraction
- **FR-015**: System MUST execute batch runtime extractions completely on the client, using spatial extraction + regex validation with zero external LLM calls during daily operations.
- **FR-016**: System MUST calculate a **Confidence Score** (0–100%) for each extracted field based on spatial match and validation pattern adherence.
- **FR-017**: System MUST generate filled destination PDFs embedding text (with dynamic font auto-fit) and barcodes at the mapped coordinates via `pdf-lib`.
- **FR-018**: System MUST support individual in-app PDF preview, individual download, and batch download as a `.zip` archive containing all generated PDFs and a `summary.csv`.

---

### Key Entities

- **BoundingBox**: Normalized coordinates `{ x: number, y: number, width: number, height: number, page: number }`.
- **FieldDefinition**: 
  - `id`: Unique identifier (string).
  - `name`: Human-readable name (e.g., "Shipment Number").
  - `labelBox`: `BoundingBox` for anchor text.
  - `valueBox`: `BoundingBox` for value text.
  - `validationPattern`: Regex string used for format verification.
  - `dataType`: Semantic type (`text`, `alphanumeric`, `date`, `number`, `multiline`).
  - `isRequired`: Boolean.
- **DestinationFieldMapping**:
  - `fieldId`: Reference to `FieldDefinition.id`.
  - `targetBox`: `BoundingBox` on destination template.
  - `renderFormat`: Format enum (`TEXT`, `CODE128`, `QR_CODE`).
  - `fontSize`: Number (optional / auto-fit).
- **MappingProfile**:
  - `id`: Profile identifier.
  - `name`: Profile title (e.g., "IKEA Consignment Note").
  - `version`: Number.
  - `fields`: Array of `FieldDefinition`.
  - `destinationTemplateBase64`: Base64 string of destination PDF template.
  - `destinationMappings`: Array of `DestinationFieldMapping`.
- **ExtractionResult**:
  - `documentIndex`: Number.
  - `extractedData`: Key-value map of field names to values.
  - `confidenceScores`: Key-value map of field names to percentage scores.
  - `overallConfidence`: Average confidence score.
  - `status`: Status enum (`APPROVED`, `FAILED`).
  - `pdfBlob`: Generated PDF blob.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Runtime batch extraction executes in **< 500ms per page** on standard client devices.
- **SC-002**: **100% Client-Side Privacy Compliance**: Zero document contents, extracted values, or customer mapping profiles are transmitted over the network (Constitution Principle 2).
- **SC-003**: Extraction achieves **≥ 95% automated confidence** on documents adhering to the calibrated layout without requiring manual intervention.
- **SC-004**: Mappings created on one workstation can be exported and imported into another browser session with **100% functional parity** via self-contained `.copyx` files.
