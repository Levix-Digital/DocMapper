# Feature Specification: Copyx MVP (Porting Reference App)

**Feature Branch**: `001-copyx-mvp`
**Created**: 2025-12-05
**Status**: Draft
**Input**: Porting reference app `ikea-sdgen-main` logic to Copyx Vue 3 stack.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate IKEA Receipt from CMR (Priority: P1)

As a logistics operator, I want to upload a CMR PDF and automatically generate an IKEA delivery receipt so that I don't have to manually type the data.

**Why this priority**: Core value proposition. Eliminates manual data entry.

**Independent Test**: Upload `CMRs.pdf` and verify the output PDF contains the correct Shipment, Seal, and Trailer numbers mapped to the correct fields.

**Acceptance Scenarios**:

1. **Given** a CMR PDF with a "Shipment: 12345" label, **When** I upload it, **Then** the generated PDF has "12345" in the "Shipment Number" field.
2. **Given** a CMR PDF with multiple pages, **When** I upload it, **Then** I see a list of generated receipts for each valid page.
3. **Given** a PDF with no recognizable CMR data, **When** I upload it, **Then** the system notifies me that no documents were generated.

---

### User Story 2 - Batch Download (Priority: P2)

As an operator, I want to download all generated receipts as a ZIP file so that I can save time when processing large batches.

**Why this priority**: Essential for efficiency with multi-page CMRs.

**Independent Test**: Process a multi-page CMR and click "Download All". Verify ZIP contains all PDFs.

**Acceptance Scenarios**:

1. **Given** multiple generated receipts, **When** I click "Download All as ZIP", **Then** a `.zip` file is downloaded containing all individual PDFs.
2. **Given** the ZIP file, **When** I extract it, **Then** it includes a CSV summary of the extracted data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept PDF files via drag-and-drop or file selection.
- **FR-002**: System MUST extract "Shipment Number", "Seal Number", "Trailer Number", "Consignments", and "Arrival Date/Time" using Regex patterns matching the reference app logic.
- **FR-003**: System MUST generate a new PDF based on the IKEA template (embedded asset).
- **FR-004**: System MUST generate a Code 128 barcode for the Shipment Number and embed it into the generated PDF.
- **FR-005**: System MUST run entirely in the browser (client-side) without backend dependencies.
- **FR-006**: System MUST list all generated files with a "Download" link for each.
- **FR-007**: System MUST provide a "Download All" button to export results as a ZIP file.

### Key Entities

- **CMR Data**: Object containing extracted fields (shipment, seal, etc.).
- **Template**: The base PDF form used for generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Generated PDF content matches the output of the reference `ikea-sdgen-main` app for the same input file (100% data field parity).
- **SC-002**: Processing time is under 2 seconds per page on a standard laptop.
- **SC-003**: System successfully processes the known test file `CMRs.pdf` without errors.
