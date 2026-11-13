# DocMapper

DocMapper is a desktop application, with a server edition for teams, that moves data from one document to another: the user maps where each field sits on a sample PDF once, and DocMapper extracts those fields from every similar document and writes them into the destination document or data file. DocMapper is an on-premise solution: it runs on each user's computer, deterministically, in well under a second per document, and Levix never hosts or processes the customer's documents or data.

## Problem

Many departments spend hours copying data between documents by hand. A logistics office types consignment numbers, seals and trailer plates from CMRs into shipment documents; a finance department copies totals, dates and tax ids from supplier invoices into its own forms and spreadsheets; accounting firms and law firms re-key the same fields from client documents into reports and filings. The work is repetitive, slow and error-prone.

The tools people use today do not fit well:

- **Manual typing** is the norm. It costs time on every document and a single wrong digit can block a shipment or a payment.
- **Fixed-coordinate extraction** breaks as soon as a field grows (a description with ten lines instead of one pushes everything below it down), the page is printed to PDF on Letter instead of A4, or the margins change.
- **Cloud OCR and recognition services** handle variation but send sensitive documents to third parties, charge per page, and are not deterministic: the same document can give a different answer tomorrow.

## Target Users

DocMapper is a horizontal product: it serves any team that repeatedly moves data from documents with a recurring layout into other documents or systems.

- **Logistics and dispatch operators (primary group, first segment).** They process CMRs, packing lists and bills of lading every day and must produce shipment documents quickly and without errors. What gets in their way: high volume, layouts that stretch with content, documents printed through virtual printers.
- **Finance and accounting teams (second segment).** Accounts payable, controllers and accounting firms handle invoices, statements and receipts. They need exact values, an audit trail of where each value came from, and no document leaving the company.
- **Legal and other corporate departments.** Law firms and departments of large companies that fill forms and reports from recurring documents. They value privacy above all.
- **Other contexts not known yet.** The mapping is defined by the user, not by the product, so new use cases do not need new product features.

## Value Proposition

- **Map once, extract always**: the user draws the label and value boxes on one sample document; the same mapping works on every document with that layout, even when fields grow, the scale changes or the page is printed to PDF.
- **Private by design**: documents are processed on the user's computer and data stays in the customer's own database; nothing is uploaded unless the user enables the optional vision fallback.
- **Exact and repeatable**: the LSIE engine is deterministic, so the same document always gives the same result, and each value can be traced back to its position on the page.
- **Fast and free to run**: no per-page cost and well under a second per document, so whole batches are processed in seconds.
- **Works with any layout**: no built-in document types to wait for; any recurring PDF layout can be mapped by the user.

## Business Model

- **Annual subscription per seat**, delivered as a Levix-signed license verified offline on the device.
- **Three editions** ([ADR-0014](../adr/0014-editions-personal-and-pro-on-the-desktop-business-served-from.md)):
  - **Personal (free)**: the desktop app for individual use with every feature, no sign-up and no Admin Hub, limited to three mapped document families (profiles); the local vision fallback is included.
  - **Pro (paid)**: the desktop app on up to five machines, with a signed license file imported on each device and no server. Unlocks unlimited document families, background processing of whole folders, the vision fallback through a model API in the customer's perimeter, and ERP integration through API and MCP. Profiles stay on each machine; there is no shared profile base.
  - **Business (paid)**: served from the customer's own server and used from the browser, with one shared profile base, access levels per group, versioned profiles and processing on the server. Required for any paid use above five machines, and always with the Levix Admin Hub, which delivers users, licenses, policies and seats and adds governance (policy, audit, usage counters).
- **Costs that matter**: development, code signing and update distribution. Running costs per document are zero; the optional vision fallback uses the customer's own API key.

## Success Metrics

- **Field accuracy**: at least 99% of mapped fields extracted with the expected value across the reference corpus.
- **Speed**: under 1 second per document on a typical office computer, including reading the PDF.
- **Deterministic coverage**: at least 80% of documents processed without the vision fallback.
- **Parity during the migration**: 100% of the characterization fixtures pass in both the TypeScript reference and the Rust core before each module is switched.

## Scope

The complete product, as capabilities (the backlog's epics come from this list):

1. **Mapping Studio**: render a sample document, draw label and value boxes, name fields, choose data types and validation patterns, preview the result.
2. **Deterministic extraction (LSIE)**: scale-invariant, drift-tolerant extraction of mapped fields from new documents, with zero leakage into unmapped sections.
3. **Validation patterns**: format rules (regex masks and data types) per field, optionally suggested by the Gemini service and always editable by the user.
4. **Batch processing**: split multi-document files, extract every document, apply the anomaly gate, compute confidence and show the status of each result.
5. **Vision fallback (optional, governed)**: when deterministic extraction fails a structural check, ask a vision model for the missing fields, with the customer's own key or the endpoint the Admin Hub provides.
6. **Destination output**: stamp values, Code128 barcodes and QR codes onto destination PDFs and templates with automatic font fitting.
7. **Profiles and storage**: create, edit, import and export mapping profiles (`.docmapper` files). Every profile and template is read from the database: a local SQLite file on the desktop, or the shared PostgreSQL base of the Business server, where a team shares the same profiles with access levels and versions.
8. **Data export and MCP server**: export extracted data as CSV, JSON or XML with a configurable schema, and an MCP server so any MCP client can list profiles, run extractions and read results on the user's computer.
9. **ERP connectors**: direct connectors to ERP systems, added through the roadmap.
10. **Desktop application**: Tauri desktop app with the Vue interface, installers, code signing and automatic updates.
11. **Licensing and governance**: offline signed license, signed manifest, governance engine in the Rust core, Admin Hub integration for companies above five machines.
12. **Localization**: the interface in several languages.

## Non-Goals

- **Ready-made document profiles per segment**: the product does not ship built-in profiles for invoices, fiscal notes or other document types; users map their own layouts (the existing CMR profile stays as an example).

## Risks and Assumptions

- **Assumption: recurring layouts are common enough outside logistics.** Reduced by validating the second segment (finance and accounting) with real invoices right after the first desktop release.
- **Technical risk: extraction changes when the LSIE engine moves to the shared `lsie-rs` based crate.** Its model differs from today's TypeScript extractor; every difference on the corpus is reported and accepted by the product owner before the switch.
- **Technical risk: PDF reading in Rust (pdfium) gives slightly different glyph positions than pdf.js.** Reduced by a fixed tolerance (0.01 percentage points) and by requiring identical final extraction on the corpus.
- **Technical risk: stamped PDFs cannot be byte-identical after the migration.** Parity is checked on what is drawn (text, font, size, position, decoded barcodes) and on rendered pixels.
- **Market risk: desktop installation is a barrier compared with a web page.** Reduced by signed installers, automatic updates and the Admin Hub for company-wide rollout.
- **Dependency risk: licensing depends on the Admin Hub and the shared license crate.** The migration does not need them until the governance epic, which follows the Admin Hub release calendar (v0.2.0 to v0.5.0).

## Open Questions

None.
