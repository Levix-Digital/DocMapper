---
id: 1
title: Tauri desktop app with a Rust core, toward a 100% Rust product
status: accepted
date: '2026-11-08'
version: null
subsystems: [desktop, core]
supersedes: []
superseded_by: []
amends: []
amended_by: [13, 14]
---

# ADR-0001: Tauri desktop app with a Rust core, toward a 100% Rust product

## Context

DocMapper runs today as a browser application: a Vue 3 interface, an AssemblyScript core compiled to WebAssembly, pdf.js for reading PDFs, pdf-lib for stamping and a Node/Express license backend. The 2025 constitution required the product to run fully in a standard browser with no backend. The product is now positioned as an on-premise solution installed on each user's computer, with a local database, access to the operating system keychain and offline licensing, which a browser sandbox cannot provide. The product owner also wants the final product to have no Node.js or other runtime dependency.

## Decision

- DocMapper becomes a desktop application built with Tauri. All business logic moves to Rust crates in a Cargo workspace in this repository; the Tauri shell exposes them to the interface as commands.
- The current Vue interface is kept during the migration and calls Tauri commands instead of the WebAssembly service.
- The final target is a **100% Rust product**: after the core migration, the interface is also rewritten in Rust and Vue, Vite and Node.js are removed (a separate epic, after version 1.0).
- The browser build is kept working until module M7 of the migration; after that it is removed.
- This decision replaces the "Simplicity First (browser only)" and "Modern Stack Standard" principles of the hand-written constitution of 2025-12-05.

## Alternatives Considered

- **Keep the browser application with a Rust/WebAssembly core**: no keychain, no local database, no offline signed license on the device; rejected.
- **Native Rust interface from the start (egui, Slint, iced)**: a rewrite of about twelve screens with no way to prove output parity during the core migration; postponed to the epic after 1.0.
- **Electron**: keeps a Node.js runtime, against the 100% Rust target.

## Consequences

- Installers, code signing and automatic updates become part of the product (module M10).
- During the migration the repository has two toolchains (Node.js for the interface and the parity oracle, Rust for the core); both run in CI.
- The interface stays replaceable because no business rule lives in it (ADR-0002), which keeps the later Rust interface a contained change.
