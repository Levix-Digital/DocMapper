---
title: Interface
summary: 'Vue 3 screens: editor, Mapping Studio, field list, destination placement, profile management.'
code: [frontend/src/views, frontend/src/components, frontend/src/App.vue]
---

# Interface

Vue 3 screens: editor, Mapping Studio, field list, destination placement, profile management.

## Responsibilities

Owns the screens and user interaction. Business rules are expected to live in the services, not in the components.

## Structure

- `frontend/src/views`: `Editor.vue` and `MappingStudio.vue`.
- `frontend/src/components/mapping`: `InteractivePdfCanvas.vue` (drawing label and value boxes), `DestinationPlacementCanvas.vue`, `FieldListDrawer.vue`, `ProfileManagementModal.vue`.
- `frontend/src/components/layout`, `common` and `ui`: layout, language picker and basic controls.
- Vue 3 with the Composition API, TypeScript, Tailwind CSS and Vite.
- Profiles are reached only through `ProfileService` ([Profiles](profiles.md)), asynchronous in every screen.
- Runs in the desktop window of the [Desktop Shell](desktop-shell.md) and, until the browser version is removed, in the browser, from the same build.

## Behavior

- The Mapping Studio renders a sample PDF with pdf.js, lets the user draw boxes, name fields and request pattern suggestions, then preview extraction.
- The editor runs batches and offers the results for download.
- Errors and confirmations are shown inside the window (the profile window's notice bar, the Mapping Studio's notice); the desktop window does not show the browser's `alert` and `confirm` dialogs. Deleting a profile takes a second click on its delete button within a few seconds.

## Interfaces

- Calls Profiles, Batch Processing, Spatial Extraction, Model Services and Localization.

## Decisions

- [ADR-0001](../adr/0001-tauri-desktop-app-with-a-rust-core-toward-a-100-rust-product.md): kept inside a Tauri shell during the migration and rewritten in Rust afterwards.
