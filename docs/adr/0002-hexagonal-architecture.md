---
id: 2
title: Hexagonal architecture
status: accepted
date: '2026-11-08'
version: null
subsystems: [core, desktop, storage, pdf-reading, vision-fallback, licensing]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0002: Hexagonal architecture

## Context

The Rust core must serve the Tauri interface now and a Rust interface later, and it depends on several external systems: PDF reading, a database with two implementations from the start (local SQLite and a central database), model providers for the vision fallback, the operating system keychain and the shared licensing crates. Parity tests must replace PDF reading and network calls with recorded data.

## Decision

- The project follows the **hexagonal** style (`architecture.style` in `.dev-cycle.json`).
- `crates/docmapper-core` holds the domain: profiles and mapping types, glyph normalization and the LSIE adapter, batch processing, validation patterns, file naming, stamping layout and the policy enforcement points. It defines the ports (traits) it needs: `PdfReader`, `ProfileRepository`, `VisionModel`, `SecretStore`, `LicenseVerifier`, `PolicyGate`, `PdfWriter`.
- Adapters live in their own crates and implement those ports (pdfium, SQLite, PostgreSQL, model connectors, keychain, levix-platform licensing).
- The Tauri shell (`crates/docmapper-desktop`) is the only surface for now; it wires adapters to the core and exposes commands.
- The core never imports a framework or driver: `forbidden_core_imports` lists tauri, rusqlite, sqlx, reqwest, pdfium_render, keyring and ort, checked by `check_design`.
- Batch processing inside the core is organized as an ordered pipeline (split, extract, gate, fallback, validate, stamp).

## Alternatives Considered

- **Layered**: workable, but it does not express the several interchangeable adapters per external system as clearly.
- **Modular monolith**: suited to several business modules with separate teams; DocMapper has one domain.
- **Pipeline as the top-level style**: fits batch processing but not mapping, profiles and the interface; used inside the core instead.

## Consequences

- Each external system can be replaced in tests by an in-memory or recorded implementation, which the parity harness needs.
- New databases, model providers or interfaces are new adapters, not core changes.
- One more crate boundary to maintain per external system.
