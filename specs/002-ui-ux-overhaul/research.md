# Research: UI/UX Overhaul

**Feature**: 002-ui-ux-overhaul
**Date**: 2025-12-05

## 1. Iconography Library

**Decision**: Use `lucide-vue-next`.

**Rationale**:
- **Aesthetic**: Lucide offers a clean, technical "stroke-based" look that aligns perfectly with the "Robot Shell" design language (defined in Spec 002).
- **Performance**: It is lightweight and tree-shakeable.
- **Maintenance**: Standard library, actively maintained, easier than managing raw SVG paths manually.
- **Compliance**: Fits the "Simplicity First" constitution principle better than heavy UI kits like Vuetify or generic sets like FontAwesome.

**Alternatives Considered**:
- **Heroicons**: Good integration with Tailwind, but slightly more generic/web-standard look, less "technical/robotic".
- **Raw SVGs**: Zero dependency, but high maintenance burden and inconsistent scaling.

## 2. Dark Mode Strategy

**Decision**: Dual Mode via Tailwind `dark:` variant (Class strategy).

**Rationale**:
- **Mechanism**: Use a CSS class (`.dark`) on the HTML root. This allows for a manual toggle in the header, which gives user control.
- **Implementation**: Tailwind's `darkMode: 'class'` is the standard modern approach.
- **Constitution**: Adheres to "Modern Stack Standard" (Vue/Tailwind).

**Alternatives Considered**:
- **Media Query Only**: Less user control.
- **CSS Variables Only**: More complex to manage than utility classes for a rapid overhaul.

## 3. Component Architecture

**Decision**: Extract atomic components (`Button`, `Card`, `Input`) immediately.

**Rationale**:
- **Reusability**: The "Robot Shell" aesthetic relies on consistent complex borders (LED effects). Duplicating these utilities in `Editor.vue` would violate DRY and make the "Simplicity First" principle harder to maintain long-term.
