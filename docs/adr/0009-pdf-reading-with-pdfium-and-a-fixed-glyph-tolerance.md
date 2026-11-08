---
id: 9
title: PDF reading with pdfium and a fixed glyph tolerance
status: accepted
date: '2026-11-08'
version: null
subsystems: [pdf-reading]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0009: PDF reading with pdfium and a fixed glyph tolerance

## Context

Glyphs are read today with pdf.js in the browser. In Rust, PDF reading uses pdfium, and glyph coordinates may differ slightly from pdf.js.

## Decision

- Extraction reads PDFs with **pdfium** (`pdfium-render`) through the `PdfReader` port.
- LSIE is tested on glyphs recorded from pdf.js with exact equality; Rust glyph reading has its own test: identical text and coordinates within **0.01 percentage points** of the page size.
- The final criterion is identical extraction results on the whole corpus.
- The interface may keep pdf.js only for drawing the page canvas until the Rust interface epic.

## Alternatives Considered

- **lopdf or pdf-extract**: weaker text positioning for complex fonts.
- **Keep pdf.js in a Node process**: against the 100% Rust target.

## Consequences

- pdfium ships as a native library with the installer.
- Glyph differences above the tolerance block module M5.
