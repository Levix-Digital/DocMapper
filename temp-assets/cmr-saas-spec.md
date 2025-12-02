# Copyx SaaS --- Full Specification

**Version:** 1.0\
**Author:** Levix Digital\
**Architecture:** Modular, Extensible for Future Logistics Documents
(BOL, PAPS, PARS, Customs Sheets, etc.)

------------------------------------------------------------------------

# 1. PRODUCT OVERVIEW

## 1.1 Purpose

This SaaS is a **document automation platform** specializing in
structured extraction, mapping, template filling, and exporting of **CMR
and eCMR transport documents**.\
It is built **modularly**, enabling future expansion to other document
types such as:

-   Bill of Lading (BOL)\
-   PARS / PAPS sheets\
-   Customs documents\
-   Delivery receipts\
-   Internal carrier worksheets

The system allows users to upload source documents (e.g., CMR PDFs),
extract structured fields, map them into custom templates, generate new
documents, and export digital formats including **eCMR JSON/XML**.

------------------------------------------------------------------------

# 2. CORE PRINCIPLES

1.  **Privacy-first (client-side processing)**\
    All parsing, extraction, and data handling occur in the browser. No
    personal or shipment data is stored on servers.

2.  **Modular architecture**\
    Document types are independent "modules" with their own extractors,
    field definitions, validators, and mapping schemas.

3.  **User-driven flexibility**\
    Users define their own templates and mappings, avoiding hardcoded
    document layouts.

4.  **Scalability**\
    While initially CMR-focused, the architecture supports adding new
    document modules without breaking existing flows.

------------------------------------------------------------------------

# 3. KEY FEATURES

## 3.1 Feature 1 --- Field Extraction + Editable Field Review

-   Extract CMR fields using PDF parsing (pdf.js + optional AI mode).\
-   Present extracted values in a structured table.\
-   User can manually correct any field.\
-   Validation:
    -   Required fields\
    -   Date formats\
    -   Weight numeric checks\
    -   Seal number format

------------------------------------------------------------------------

## 3.2 Feature 2 --- CMR Field Library

A standard catalog of fields including:\
- Mandatory CMR fields (Article 6)\
- Optional CMR fields\
- Customs-related fields (PARS/PAPS, HS codes)\
- Carrier fields (driver, truck plate)

Used when mapping templates.

------------------------------------------------------------------------

## 3.3 Feature 3 --- Saved Extraction Profiles (Local)

-   Stored in IndexedDB (via Dexie.js).\
-   Auto-saves corrected fields.\
-   Reusable across sessions.

------------------------------------------------------------------------

## 3.4 Feature 4 --- Template Preview

-   Live preview with sample data.\
-   PDF rendering using pdf-lib.\
-   Highlights mapped fields.

------------------------------------------------------------------------

## 3.5 Feature 5 --- eCMR Export

Create exports in:\
- UN/CEFACT CMR XML schema\
- JSON equivalent

Validates fields before export.

------------------------------------------------------------------------

## 3.6 Feature 6 --- Multi-template Output

A single CMR may generate:\
- Customs sheet\
- Delivery receipt\
- Internal carrier sheet\
- Goods checklist

Each treated as a separate "output template."

------------------------------------------------------------------------

## 3.7 Feature 7 --- Team/Company Profiles

Store reusable metadata:\
- Company name, address\
- Logo\
- Standard instructions\
- Incoterms defaults

Profiles can auto-fill fields in templates.

------------------------------------------------------------------------

## 3.8 Feature 8 --- Barcode/QR Generator

Supports:\
- PDF417\
- QR\
- DataMatrix\
- GS1 formats

Can embed tracking codes, PARS numbers, etc.

------------------------------------------------------------------------

## 3.9 Feature 9 --- AI-Assisted Extraction (Hybrid Approach)

-   **Standard Mode:** Local regex/position-based extraction.
-   **Hybrid AI Mode:**
    -   **Local:** Tesseract.js for OCR on scanned documents.
    -   **Cloud (Optional):** Integration with LLM APIs (e.g., OpenAI/Gemini) for advanced field mapping (requires user consent/API key).
-   Auto-suggest corrections based on historical data.

------------------------------------------------------------------------

## 3.10 Feature 10 --- REST API (Optional Premium Add-on)

Example endpoints:

    POST /extract
    POST /map
    POST /generate
    POST /ecmr/export

API keys per workspace.

------------------------------------------------------------------------

# 4. SYSTEM ARCHITECTURE

## 4.1 Frontend

**Framework:** Vue 3 (Composition API) + TypeScript
**Architecture:** Progressive Web App (PWA) with Offline Support

### Modules & UI Patterns:

-   **Split-Screen Interface:** PDF Viewer (Left) + Editable Form (Right) for efficient verification.
-   Document Upload Module\
-   Extraction Engine (pdf.js + Tesseract.js)\
-   Field Editor (Zod Validation)\
-   Template Builder\
-   Mapping Engine\
-   PDF Generator\
-   eCMR Exporter\
-   Profile Manager

All heavy operations run locally.

------------------------------------------------------------------------

## 4.2 Backend

**Infrastructure:** NodeJS + TypeScript

### Backend stores ONLY:

-   User accounts\
-   Template metadata\
-   Mapping configurations\
-   User preferences\
    NOTHING else (no shipment data, no PDFs).

------------------------------------------------------------------------

# 5. MODULAR DOCUMENT ENGINE (Important Part)

## 5.1 Core Idea

Each document type is a **module** implementing the following interface:

    DocumentModule {
      id: string
      name: string
      extractor: (file) => ExtractedData
      fieldSchema: FieldDefinition[]
      validator: (ExtractedData) => ValidationResult
      mappingSchema: MappingDefinition[]
      exporters: { pdf: fn, json: fn, xml: fn }
    }

CMR is one module.

You can later add: - BOLModule\
- PARSModule\
- PAPSModule\
- CustomsSheetModule

They plug into the same system with no rewrite.

------------------------------------------------------------------------

# 6. USER FLOWS

## 6.1 Primary Flow (CMR → Template)

1.  Upload CMR\
2.  Extract fields\
3.  Edit/validate fields\
4.  Choose template\
5.  Map fields\
6.  Preview\
7.  Generate PDF\
8.  Optional: Export eCMR JSON/XML

------------------------------------------------------------------------

## 6.2 Multi-output Flow

1.  Upload CMR\
2.  Choose multiple templates\
3.  Generate all documents in one batch\
4.  Download zip

------------------------------------------------------------------------

# 7. PRICING MODEL

## Tier 1 --- Free

-   1 template\
-   Basic extraction\
-   No AI mode

## Tier 2 --- Pro (\$9--19/month)

-   Unlimited templates\
-   Saved mappings\
-   Barcode/QR generator\
-   Team/company profiles\
-   Multi-template output\
-   eCMR export

## Tier 3 --- Enterprise (\$59+)

-   API access\
-   Template sharing across team\
-   Priority support

------------------------------------------------------------------------

# 8. COMPETITOR ADVANTAGES

-   Privacy-first (no uploads)\
-   Faster than cloud document processors\
-   Tailored to CMR with ability to expand\
-   Modular design future-proofs the platform\
-   Indie-friendly maintenance cost

------------------------------------------------------------------------

# 9. FUTURE EXTENSIONS (Explicitly Stated)

The architecture explicitly supports adding new document modules.\
To add BOL or customs documents, implement:

-   New extractor\
-   Field schema\
-   Validation rules\
-   Optional exporters

No rework needed on the core engine.

This ensures long-term scalability and product value.
