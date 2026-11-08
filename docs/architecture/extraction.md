---
title: Spatial Extraction
summary: Reads glyphs with pdf.js and resolves mapped fields with the LSIE engine.
code: [frontend/src/services/pdf/spatial-extractor.ts]
---

# Spatial Extraction

Reads glyphs with pdf.js and resolves mapped fields with the LSIE engine.

## Responsibilities

Owns reading glyphs from a PDF page and resolving each mapped field's value with the LSIE engine: anchors, scale, elastic drift and contiguous flow. It does not own the profile format (Profiles) or what happens after a field is resolved (Batch Processing).

## Structure

- `frontend/src/services/pdf/spatial-extractor.ts` (about 550 lines): `loadPdf`, `isPageScanned`, `getPageGlyphs` (`ExtractedGlyph`), `extractTextInBox`, `extractContiguousFieldContent`, `extractTextFromGlyphs`, `extractFieldsWithCalibration` (`CalibratedExtractionResult`) and `extractAllFieldsFromPdf`.
- PDF reading uses pdf.js, with character maps loaded from a CDN.

## Behavior

- Glyphs are read from the page text content and normalized to page-relative coordinates.
- For each field, the label box is located as an anchor, the reference span and scale are computed, and the value is collected from the glyphs in the value channel, following the contiguous flow of the field's own lines so unmapped sections are not swallowed.
- `extractFieldsWithCalibration` returns the values, the required fields that are missing and whether a topological anomaly was detected, which the anomaly gate in Batch Processing uses.

## Interfaces

- Called by Batch Processing and the Mapping Studio preview.
- Calls pdf.js.

## Decisions

- [ADR-0004](../adr/0004-lsie-from-the-shared-levix-platform-crate.md): replaced by the shared levix-platform LSIE crate in module M4.
- [ADR-0009](../adr/0009-pdf-reading-with-pdfium-and-a-fixed-glyph-tolerance.md): pdf.js is replaced by pdfium in module M5.
