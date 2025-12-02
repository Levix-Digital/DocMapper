# Feature Specification: Copyx Premium Version

**Feature Branch**: `001-copyx-premium`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "Create a specification for the **Premium Version** of Copyx..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Core CMR Extraction & Editing (Priority: P1)

A logistics coordinator uploads a scanned CMR, verifies extracted data in a split-screen view, and corrects errors, which the system learns for next time.

**Why this priority**: This is the core value proposition: turning static PDFs into structured, editable data with privacy and efficiency.

**Independent Test**: Upload a sample CMR PDF, verify fields are extracted to the form, edit a field, and ensure the correction is saved locally.

**Acceptance Scenarios**:

1. **Given** a user uploads a PDF CMR, **When** extraction completes, **Then** a split-screen view appears with the PDF on the left and extracted fields on the right.
2. **Given** an extracted field is incorrect, **When** the user corrects it, **Then** the system updates the value and saves the mapping correction to the local "Extraction Profile" for that issuer.
3. **Given** a scanned document, **When** uploaded, **Then** the system uses local OCR (Tesseract.js) to extract text before parsing.

---

### User Story 2 - Multi-Template Generation (Priority: P1)

The user wants to generate a CMR, a Delivery Receipt, and a Goods Checklist from the same shipment data in one go.

**Why this priority**: Demonstrates the "Premium" value and the power of the modular architecture.

**Independent Test**: Select multiple output templates (CMR, Receipt, Checklist) for a single extracted dataset and generate all PDFs.

**Acceptance Scenarios**:

1. **Given** extracted shipment data, **When** the user selects "CMR" and "Delivery Receipt" templates, **Then** the system generates two distinct PDF files populated with the same data.
2. **Given** a generated document, **When** downloaded, **Then** it contains the correct layout and data for that specific template type.

---

### User Story 3 - Hybrid AI Extraction (Priority: P2)

A user opts-in to use Cloud AI for a complex, non-standard CMR that local regex failed to parse correctly.

**Why this priority**: High-value feature for "Premium" users dealing with messy documents, but strictly optional per Constitution.

**Independent Test**: Enable "Hybrid AI" mode, provide an API key (or consent), and process a complex document.

**Acceptance Scenarios**:

1. **Given** a complex document, **When** the user clicks "Try with AI", **Then** a warning modal appears explaining data will leave the device.
2. **Given** user consent, **When** processing finishes, **Then** fields are mapped with higher accuracy than local regex.

---

### User Story 4 - Team Profiles & Barcodes (Priority: P2)

The user sets up a company profile with a logo and default Incoterms, and enables QR code tracking on output documents.

**Why this priority**: Essential for professional/enterprise use cases.

**Independent Test**: Create a company profile, enable QR codes, and generate a document to see the logo and QR code applied.

**Acceptance Scenarios**:

1. **Given** a stored Company Profile, **When** a new document is generated, **Then** the company logo and default address are auto-filled.
2. **Given** the "Include Tracking QR" option is checked, **When** the PDF is generated, **Then** a valid QR code containing the tracking number is embedded.

---

### Edge Cases

- **Offline Mode**: What happens if the user tries to use "Hybrid AI" while offline? (System must disable the option and show a "Network Required" tooltip).
- **Corrupt PDF**: How does the system handle a non-readable or password-protected PDF? (Show clear error message, do not crash).
- **Storage Limit**: What happens if IndexedDB is full? (Prompt user to clear old history or export profiles).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement the `DocumentModule` interface for the CMR module, ensuring isolation of extraction, validation, and export logic.
- **FR-002**: System MUST provide a "Split-Screen" UI with a PDF viewer (left) and reactive form (right).
- **FR-003**: System MUST support "Multi-Template Output", allowing one dataset to populate multiple selected templates simultaneously.
- **FR-004**: System MUST save user corrections to an "Extraction Profile" in IndexedDB, keyed by the document issuer/sender.
- **FR-005**: System MUST allow users to create "Company Profiles" (Logo, Address, Defaults) and apply them to generated documents.
- **FR-006**: System MUST support "Hybrid AI" extraction, but ONLY after explicit user confirmation via a modal warning about data privacy.
- **FR-007**: System MUST generate barcodes (PDF417, QR, DataMatrix) on output documents if requested.
- **FR-008**: System MUST export data in UN/CEFACT XML and JSON formats.
- **FR-009**: All core processing (Parsing, Standard Extraction, Generation) MUST happen client-side.

### Key Entities

- **DocumentModule**: The interface defining a document type (Extractor, Schema, Validator, Exporter).
- **ExtractionProfile**: A set of learned mappings/corrections associated with a specific document source/issuer.
- **CompanyProfile**: Metadata (Logo, Address, Defaults) for the user's organization.
- **ShipmentData**: The normalized data structure extracted from a document.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can correct a field and have it auto-corrected on the next upload from the same issuer (100% recall for saved mappings).
- **SC-002**: Generating 3 different templates from one dataset takes under 5 seconds on a standard laptop.
- **SC-003**: "Hybrid AI" mode increases field extraction accuracy to >90% for non-standard layouts (compared to baseline regex).
- **SC-004**: System functions 100% offline for Standard Extraction and PDF Generation.

## Clarifications

### Session 2025-12-02
- Q: How does the system identify the "issuer" to apply the correct profile? → A: **Hybrid (Auto-detect with Manual Override)**: System attempts to auto-detect based on keywords, but allows user to manually select/override.
- Q: Which AI provider should be the default implementation for the Hybrid AI mode? → A: **OpenAI (GPT-4o)**: Standard implementation, widely available keys.
- Q: What should be the default barcode format for tracking numbers? → A: **Context-Dependent**: **QR Code** for tracking numbers. **Code 128** for general fields, with options for EAN-13/8 and Code 39.
- Q: Should Extraction Profiles be synced to the cloud? → A: **Encrypted Sync**: Profiles are encrypted client-side and synced to backend to allow cross-device usage while maintaining privacy.
- Q: How should the UI adapt for mobile devices? → A: **Tabbed View**: Toggle between "PDF View" and "Edit Form" tabs to accommodate smaller screens.
- Q: Can a single user manage multiple company profiles? → A: **Multi-Profile**: User can create and switch between multiple company profiles (e.g., for different carriers or business entities).
- Q: Does "Team Profile" imply multiple users can access the same profile? → A: **Shared Team Workspaces**: Users can invite others to join a Company Profile to share templates and history.
- Q: How should the AI cost be handled? → A: **Bring Your Own Key (BYOK)**: User provides their own OpenAI API key to enable Hybrid AI features.
- Q: How should concurrent edits be handled in shared workspaces? → A: **Last Write Wins**: The last save overwrites previous changes (optimistic concurrency).
- Q: How should users map fields to PDF locations? → A: **Drag-and-Drop Overlay**: User drags field pills onto a visual preview of the PDF for intuitive mapping.
- Q: What roles exist in shared workspaces? → A: **Simple Roles**: Admin (manage team/billing) vs. Member (edit/generate).
- Q: Can users edit shared templates/profiles while offline? → A: **Cached Read/Write**: Users can edit shared items offline; changes sync upon reconnection (Last Write Wins).
- Q: How should users be notified of team invites? → A: **Email Only**: Send an invitation link via email (requires backend email service).
- Q: Should there be a limit on bulk data exports? → A: **Paged Export**: Export in chunks (e.g., 100 records per batch) to prevent browser performance issues.
- Q: Should template history be preserved? → A: **Simple History**: Keep the last 5 versions of a template to allow reverting changes.
- Q: Which PDF library should be used for generation? → A: **pdf-lib**: Chosen for its superior ability to modify/fill existing PDF templates compared to jspdf.
