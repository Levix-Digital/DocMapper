---
id: 11
title: Unused AssemblyScript CMR core removed instead of ported
status: accepted
date: '2026-11-09'
version: null
subsystems: [parity]
supersedes: []
superseded_by: []
amends: [3]
amended_by: []
---

# ADR-0011: Unused AssemblyScript CMR core removed instead of ported

## Context

ADR-0003 planned module M2 as a byte-identical Rust port of the CMR core: an AssemblyScript keyword parser (`frontend/src/modules/core-wasm`, about 110 lines) loaded in the browser through `frontend/src/services/WasmService.ts`. At commit a966ea1 no file of the interface imports `WasmService`, so `processDocument` is never called: CMR fields are extracted through mapping profiles (LSIE) and the optional model service. The parser also looks for fixed English labels (`Seal`, `Plomb`, `Shipment:`, `trailer`), which makes it a built-in profile, and the product vision rules out ready-made profiles.

## Decision

- The CMR core is not ported. The AssemblyScript sources, `WasmService.ts`, the `asbuild` script, the `assemblyscript`, `@assemblyscript/loader` and `vite-plugin-wasm` packages and the build steps that compiled the module (CI and the Tauri `beforeBuildCommand`) are removed.
- Module M2 is dropped from the module order of ADR-0003, together with its backlog items (FEAT-007, FEAT-008 and EPIC-003). The other modules keep their names (M3 types and profiles is next).
- The rest of ADR-0003 is unchanged.

## Alternatives Considered

- **Port with parity anyway**: proves the same output for code no user reaches, and step (d) of ADR-0003 (switch and shadow mode) has no caller to switch.
- **Keep the code until the browser build is removed (FEAT-027)**: keeps an unused build step and three packages in every build for no benefit.

## Consequences

- The interface build no longer needs the AssemblyScript compiler, and the WebAssembly loader leaves the bundle.
- A keyword parser for a specific document type, if ever wanted, is a mapping profile, not code.
- Verified by the interface build, its tests and the parity jobs passing without the module.
