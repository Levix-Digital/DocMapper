<!--
Sync Impact Report:
- Version change: null -> 1.0.0
- Added Principles: Simplicity First, Privacy by Design, Deterministic Logic, Modern Stack Standard
- Status: Initial Draft based on Reference App alignment
-->

# Project Constitution: DocMapper

**Version**: 1.0.0
**Ratification Date**: 2025-12-05
**Status**: Active

## Preamble

This constitution defines the non-negotiable architectural and design principles for DocMapper. It serves as the primary alignment mechanism for all contributors, ensuring that every feature and refactor adheres to the core philosophy of simplicity, privacy, and performance derived from our successful MVP analysis.

## Core Principles

### 1. Simplicity First (The "No-Container" Rule)
**Principle**: The application MUST run fully functional in a standard browser environment with minimal local tooling (Node.js only).
**Rationale**: We reject backend complexity (Docker, Databases, API services) unless the feature strictly demands it. If logic can exist on the client, it STAYS on the client.
**Constraint**: Development environment setup must not exceed `npm install && npm run dev`.

### 2. Privacy by Design (Client-Side Only)
**Principle**: All document processing, OCR, and data extraction MUST occur locally within the user's browser.
**Rationale**: DocMapper processes sensitive logistics documents (CMRs). Uploading these to a server introduces liability and latency. Zero-knowledge architecture is our default.

### 3. Deterministic over Probabilistic
**Principle**: Prefer explicit extraction logic (Regex, coordinates) over probabilistic models (AI, LLMs) for core workflows.
**Rationale**: Logistics documents follow standards. Regex is instant, free, and predictable. AI is a fallback, not a primary driver, to ensure reliability and speed.

### 4. Modern Stack Standard
**Principle**: The codebase adheres strictly to Vue 3 (Composition API), TypeScript, and Tailwind CSS.
**Rationale**: Consistency reduces mental overhead. We do not mix Options API with Composition API. We do not use custom CSS where Tailwind utilities suffice.

## Governance

### Amendment Process
1. Any architectural change conflicting with these principles requires a formalized RFC (Request for Comments).
2. The Constitution is versioned semantically.
3. All Pull Requests must verify compliance with these principles.

### Compliance
- **Code Reviews**: Reviewers must explicitly flag violations of "Client-Side Only" or "Simplicity First".
- **Refactoring**: Existing code that violates these principles (e.g., legacy backend services) is debt to be prioritized for removal.
