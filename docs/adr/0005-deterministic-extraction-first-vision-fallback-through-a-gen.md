---
id: 5
title: Deterministic extraction first, vision fallback through a generic model connector
status: proposed
date: '2026-11-08'
version: null
subsystems: [extraction, vision-fallback]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0005: Deterministic extraction first, vision fallback through a generic model connector

## Context

When deterministic extraction fails the structural check (missing anchor, collapsed mapping), DocMapper today calls Gemini 2.0 Flash vision through the Google API, and Gemini also suggests validation patterns. The product is on-premise and privacy-first; documents should not leave the computer unless the customer chooses so, and the product should not be tied to one provider.

## Decision

- LSIE is always the primary path; the vision fallback runs only when the anomaly gate fails and only when policy allows it.
- The fallback goes through a **generic model connector** (`VisionModel` port) that can point to any model through an API (endpoint, model name and key configured by the user or delivered by the Admin Hub policy).
- By default, the fallback runs a **local ONNX vision model** on the user's computer, downloaded and verified through the levix-platform catalog. The default model is still to be chosen.
- Validation pattern suggestions use the same connector.

## Alternatives Considered

- **Keep Gemini as the only provider**: vendor lock-in and documents sent to a third party by default.
- **No fallback**: lower field accuracy on damaged or unusual documents.

## Consequences

- Without configuration, no document leaves the computer.
- The local model adds a download and an inference runtime (`ort`) to the product.
- Open: which ONNX model is the default.
