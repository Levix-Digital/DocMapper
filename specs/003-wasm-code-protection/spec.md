# Feature Specification: WASM Code Protection & Modularization

**Feature Branch**: `003-WASM-code-protection`
**Created**: 2025-12-06
**Status**: Draft
**Input**: Migration of client-side logic to WebAssembly via AssemblyScript

## User Scenarios & Testing

### User Story 1 - Secure Client-Side Extraction (Priority: P1)

As a product owner, I want the core extraction logic (Regex) to be compiled into WebAssembly, so that it is difficult for competitors to copy our proprietary algorithms while keeping data 100% local.

As a developer, I want a modular "Strategy Pattern" architecture in the WASM module, so that I can easily add new document types (like BOLs) later without modifying the core frontend code.

**Why this priority**: Future-proofing the application for Multi-Document support.

**Independent Test**: Can be tested by reviewing the codebase structure to ensure `DocumentParser` interface and `Factory` logic are present.

**Acceptance Scenarios**:

1. **Given** the WASM module, **When** a request is sent with `docType: "CMR"`, **Then** the Factory should instantiate the `CMRParser` strategy.
2. **Given** an unknown document type, **When** requested, **Then** the module should return a structured error.

## Edge Cases

- **EC-001**: **WASM Load Failure**: If `logic.wasm` fails to load (network/security), the app MUST show a critical error ("Security Module Missing") and prevent usage. Fallback to JS is NOT allowed.
- **EC-002**: **Legacy Code**: The old `extractor.ts` logic MUST be deleted from the codebase entirely.

## Requirements

### Functional Requirements

- **FR-001**: System MUST extract CMR data locally in the browser (Zero Data Transfer).
- **FR-002**: Core extraction logic (Regex & Parsing) MUST be written in AssemblyScript and compiled to `.wasm`.
- **FR-003**: The WASM module MUST expose a single entry point `processDocument(docType, content)` that acts as a Factory.
- **FR-004**: The Frontend MUST communicate with WASM via a dedicated `WasmService` (Bridge) using Web Workers to prevent UI freezing.

### Technical Constraints

- **TC-001**: Output binary size should remain small (Target < 50KB for the logic module).
- **TC-002**: Browser compatibility must support standard WebAssembly (modern browsers).

## Quantity Entities

- **DocumentParser**: Interface defining `parse(content: string): string`.
- **CMRParser**: Concrete strategy implementing `DocumentParser` for CMRs.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Extraction accuracy remains 100% identical to the previous JavaScript implementation.
- **SC-002**: "Sources" tab in Chrome DevTools shows only `.wasm` binary for the extraction logic.
- **SC-003**: New document types can be added by creating 1 new file (`parser.ts`) and adding 3 lines of code to the Factory.
