# Implementation Plan: UI/UX Overhaul

**Branch**: `feature/002-ui-ux` | **Date**: 2025-12-05 | **Spec**: [Spec-002](../specification.md)
**Input**: Feature specification from `specs/002-ui-ux-overhaul/specification.md`

## Summary

Complete visual overhaul of the DocMapper MVP to match the "Levix Digital" brand (Robot Shell aesthetic). Includes implementing `lucide-vue-next` for icons, Dual Mode (Dark/Light) using Tailwind, and extracting React-like components (`Button`, `Card`) in Vue 3.

## Technical Context

**Language/Version**: Vue 3.5+, TypeScript 5.9
**Primary Dependencies**: 
- `tailwindcss` (Existing)
- `lucide-vue-next` (New - Confirmed in Research)
**Storage**: N/A (Client-side only)
**Testing**: Build verification (`vue-tsc`). No Unit Tests targeting UI visuals per current scope.
**Target Platform**: Modern Browsers (Chrome/Edge/Firefox).
**Constraints**: Zero-backend logic. All styling via Tailwind utility classes.

## Constitution Check

*GATE: Passed.*

- **Simplicity First**: No new build tools. `lucide-vue-next` is lightweight.
- **Privacy by Design**: No data leaves the client. Dark Mode state stored in local storage is non-sensitive.
- **Modern Stack Standard**: Adheres strictly to Vue 3 Composition API and Tailwind CSS.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-ux-overhaul/
├── plan.md              # This file
├── research.md          # Visual/Icon choices
├── data-model.md        # UI State definitions
└── tasks.md             # Detailed breakdown
```

### Source Code

```text
frontend/src/
├── components/
│   ├── layout/
│   │   └── MainLayout.vue  # [NEW] Sticky header, Theme toggle
│   └── ui/
│       ├── Button.vue      # [NEW] Primary (LED), Secondary, Ghost
│       ├── Card.vue        # [NEW] Container with hover effects
│       └── Validation.vue  # [NEW] (Optional) Error/Success messages
├── views/
│   └── Editor.vue          # [MODIFIED] Uses new components
├── style.css               # [MODIFIED] Global fonts & animations
└── App.vue                 # [MODIFIED] Wraps MainLayout
```

## Complexity Tracking

*No violations identified.*
