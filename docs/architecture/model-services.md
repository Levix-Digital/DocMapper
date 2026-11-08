---
title: Model Services
summary: Calls to the Gemini API for validation pattern suggestions and vision fallback extraction.
code: [frontend/src/services/llm/gemini-service.ts]
---

# Model Services

Calls to the Gemini API for validation pattern suggestions and vision fallback extraction.

## Responsibilities

Owns calls to the Gemini API: suggesting a validation pattern for a field and extracting fields from a page image when deterministic extraction fails. It also tests a pattern against a value.

## Structure

- `frontend/src/services/llm/gemini-service.ts`: model list and default model, key and model stored in localStorage, `testRegexPattern`, `generateValidationPattern`, `renderPageToJpegBase64` and `extractDocumentViaVision`.

## Behavior

- Requests go directly from the browser to `generativelanguage.googleapis.com` with the user's key.
- Vision extraction renders the page to JPEG and asks for the mapped fields as JSON.
- `testRegexPattern` compiles the pattern as a JavaScript regular expression and reports matches or the compile error.

## Interfaces

- Called by the Mapping Studio and by Batch Processing (anomaly gate).

## Decisions

- [ADR-0005](../adr/0005-deterministic-extraction-first-vision-fallback-through-a-gen.md): replaced by a generic model connector with a local default model.
- [ADR-0008](../adr/0008-secrets-in-the-operating-system-keychain.md): the key moves to the operating system keychain.
