# Implementation Plan: WASM Code Protection

**Branch**: `003-WASM-code-protection` | **Date**: 2025-12-06 | **Spec**: [Spec](file:///c:/Users/guilh/source/repos/Copyx/specs/003-wasm-code-protection/spec.md)
**Input**: Feature specification from `/specs/003-wasm-code-protection/spec.md`

## Summary

Migrate the client-side document extraction logic (RegEx) from TypeScript to **WebAssembly (via AssemblyScript)**. This protects the proprietary algorithm from casual theft (obfuscation by compilation) while maintaining "Zero Data Transfer" privacy. The architecture introduces a **Strategy Pattern** to support future modular document types.

## Technical Context

**Language/Version**: AssemblyScript (TypeScript-like strict subset) -> WASM
**Primary Dependencies**: `assemblyscript`, `@assemblyscript/loader`, `vite-plugin-wasm`
**Target Platform**: Browser / Web Worker
**Performance Goals**: < 100ms extraction time (comparable to or faster than JS).
**Constraints**: Zero data sent to server. All logic runs locally.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Zero Data Transfer**: Logic runs 100% on client. Data never leaves memory.
- [x] **Modular**: Uses Strategy Pattern to allow easy addition of new parsers.

## Project Structure

### Documentation

```text
specs/003-wasm-code-protection/
├── plan.md              # This file
├── spec.md              # Feature Specification
```

### Source Code

```text
frontend/
├── src/
│   ├── modules/
│   │   ├── core-wasm/          # [NEW] The WASM Module
│   │   │   ├── assembly/       # AssemblyScript Source
│   │   │   │   ├── index.ts    # Factory / Router
│   │   │   │   └── parsers/    # Strategy Implementations
│   │   │   │       └── cmr.ts
│   │   │   └── build/          # Compiled artifacts
│   ├── services/
│   │   └── wasm-bridge.ts      # [NEW] Service to communicate with WASM
│   ├── views/
│   │   └── Editor.vue          # [MODIFIED] Uses WasmService
```

## Implementation Design (Strategy Pattern)

To support future document types (BOL, Invoices), we use a strict Strategy Pattern:

1.  **Interface**: `DocumentParser { parse(content: string): string }`
2.  **Factory**: `index.ts` switches on `docType` string to instantiate the correct parser.
3.  **Strategies**: `CMRParser` implements the specific Regex logic.

## Migration Phases

### Phase 1: Toolchain & POC
- Install AssemblyScript and Vite plugins.
- Verify `npm run asbuild` generates valid `.wasm` binaries.
- Ensure Vite serves the `.wasm` file correctly in dev mode.

### Phase 2: Core Logic Port
- Rewrite `extractor.ts` logic into `core-wasm/assembly/parsers/cmr.ts`.
- **Constraint**: Strict types (`i32`, `f64` mapping) and assemblyscript's Regex engine compatibility.

### Phase 3: The Bridge
- Implement `WasmService` to load the module.
- Handle memory copying (JS String -> WASM Memory -> JS String).
- Replace direct calls in `Editor.vue` with `await WasmService.process("CMR", text)`.

### Phase 4: Cleanup
- **CRITICAL**: Delete `frontend/src/modules/cmr/extractor.ts`.
- Verify no TypeScript source logic remains exposed.

### Phase 5: Production Hardening
- Update `vite.config.ts` to use `terser` for aggressive minification.
- Disable source maps in production builds to hide original source code.

