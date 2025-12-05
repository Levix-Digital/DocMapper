# Data Model: UI/UX Overhaul

**Feature**: 002-ui-ux-overhaul
**Date**: 2025-12-05

## 1. Entities

### ProcessingResult (Existing Refinement)
Extends the current `ProcessingResult` to support better UI feedback.

| Field | Type | Description |
|-------|------|-------------|
| `fileName` | `string` | Name of the processed file. |
| `blob` | `Blob` | The generated receipt PDF. |
| `data` | `CMRData` | Extracted data payload. |
| `status` | `enum` | **New**: `SUCCESS`, `ERROR`, `PENDING`. |
| `errorMsg` | `string?` | Optional error detail. |

### UIState (New)
Manages the application's global visual state.

| Field | Type | Description |
|-------|------|-------------|
| `isDarkMode` | `boolean` | Controlled via `MainLayout` toggle. Persisted in `localStorage`. |
| `isDragging` | `boolean` | Tracks drag-over events for "Spectrum" feedback. |

## 2. API Contracts & Events

*No Backend API changes required.*

### Client-Side Events
- **`@drop`**: Triggers file processing.
- **`@toggle-theme`**: Emitted by `MainLayout` / Header.

## 3. Validation Rules

- **CMR Data**:
  - `shipment`: Must be non-empty string.
  - `seal`: Must be alphanumeric unique ID.
  - *Validation Failure*: Triggers `status = ERROR`, displays Red LED border.

- **File Upload**:
  - `type`: Must be `application/pdf`.
  - *Validation Failure*: Immediate error toast/message.
