# Technical Research & Analysis: WASM Migration

**Date**: 2025-12-06
**Status**: Verified

## 1. Toolchain Integration Check

### Dependencies
Current `package.json` is standard Vue/Vite.
**Action**: We need to add the following `devDependencies`:
- `assemblyscript` (The compiler)
- `vite-plugin-wasm` (To allow `import x from 'file.wasm'`)
- `vite-plugin-top-level-await` (Required by `vite-plugin-wasm` for async loading)

### Vite Configuration
Current `vite.config.ts` only has the Vue plugin.
**Action**:
- Import `wasm` and `topLevelAwait` plugins.
- Add them to the `plugins` array.
- This is a safe, non-breaking change.

## 2. TypeScript Environment Conflict

**Problem**: AssemblyScript uses `.ts` files but with different standard libraries (e.g., `i32` type exists in AS but not in standard TS).
**Risk**: The main `tsconfig.json` includes `src/**/*.ts`. This will try to compile the AssemblyScript files as regular TypeScript, causing thousands of errors like "Cannot find name 'i32'".

**Solution**:
1.  **Exclude**: Update `tsconfig.json` to exclude `src/modules/core-wasm/assembly`.
2.  **Separate Config**: Create `src/modules/core-wasm/assembly/tsconfig.json` specifically for the AS environment (standard AS practice).

## 3. Worker Integration

**Architecture**: The plan calls for a `WasmService`.
**Observation**: Since `vscode-pdfjs-dist` is already handling binary data for PDF parsing, we must ensure we don't block the main thread.
**Decision**: The `WasmService` should instantiate the WASM module. Since the extraction is fast (<100ms) and WASM is synchronous, we might **not** strictly need a Web Worker for the MVP if the PDF text is already extracted.
*Correction from Spec*: The Spec mentions `WasmService (Bridge) using Web Workers`. We will stick to the spec and use a Worker to be safe, especially for large PDFs.

## 4. Legacy Code Usage
**Verified**: `frontend/src/views/Editor.vue` is the only consumer of `extractCMRData`.
**Safe Deletion**: Deleting `extractor.ts` is safe once `Editor.vue` is updated.
