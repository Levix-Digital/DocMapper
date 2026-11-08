---
title: PDF Stamping
summary: Writes values, Code128 barcodes and QR codes onto destination PDFs and the shipment template.
code: [frontend/src/services/pdf/dynamic-stamper.ts, frontend/src/services/pdf/template-engine.ts]
---

# PDF Stamping

Writes values, Code128 barcodes and QR codes onto destination PDFs and the shipment template.

## Responsibilities

Owns writing extracted values onto destination PDFs: text with automatic font fitting and alignment, Code128 barcodes and QR codes, and the fixed shipment template. It does not decide which values are written (Batch Processing).

## Structure

- `frontend/src/services/pdf/dynamic-stamper.ts`: `stampDestinationPdf(options)` with `StampOptions` (template bytes, destination mappings, fields, extracted values).
- `frontend/src/services/pdf/template-engine.ts`: `generateShipmentDocsPdf(data)` for the shipment template form.
- Libraries: pdf-lib, JsBarcode, qrcode and the browser canvas.

## Behavior

- Each destination mapping places a field value at a position on the template; text is shrunk to fit its box with Helvetica metrics from pdf-lib.
- Barcodes and QR codes are rendered to images and embedded.
- With no template, a clean layout is generated.

## Interfaces

- Called by Batch Processing and the editor.

## Decisions

- [ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md): ported in module M7; parity is on drawn content, decoded barcodes and rendered pixels.
