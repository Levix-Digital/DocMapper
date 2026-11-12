---
id: 13
title: Rust interface built with a web framework (Leptos) for the desktop and the browser
status: accepted
date: '2026-11-12'
version: null
subsystems: [interface, desktop]
supersedes: []
superseded_by: []
amends: [1]
amended_by: []
---

# ADR-0013: Rust interface built with a web framework (Leptos) for the desktop and the browser

## Context

ADR-0001 sets a 100% Rust product and leaves the framework of the Rust interface (FEAT-042, EPIC-015) to a later ADR; its alternatives name native frameworks (egui, Slint, iced). The product owner is considering a Business edition served from a server in the customer's perimeter, with one shared profile base and access levels, next to the desktop app for personal use. A native interface would run only inside the desktop shell, so a browser-served surface would need a second interface. The Admin Hub console is already written in Rust with Leptos, and the hexagonal core (ADR-0002) keeps every business rule out of the interface.

## Decision

- The Rust interface of FEAT-042 is built with **Leptos**, a Rust web framework compiled to WebAssembly.
- The same interface runs in the Tauri webview of the desktop app and, when a server surface exists, in the browser. It reaches the core only through an application service with one adapter per surface: Tauri commands on the desktop, HTTP on a server.
- Native Rust interface frameworks (egui, Slint, iced) are not used for the product interface.
- The rest of ADR-0001 is unchanged: Vue, Vite and Node.js leave the product with FEAT-042 and FEAT-043, and the Vue interface stays until then.

## Alternatives Considered

- **Native Rust interface (egui, Slint, iced)**: no web runtime in the interface, but it runs only on the desktop; a browser-served edition would need a second interface.
- **Keep Vue permanently**: already web, but keeps Node.js in the build, against the 100% Rust target of ADR-0001.
- **Another Rust web framework (Dioxus, Yew)**: viable; Leptos is chosen to share knowledge, components and accessibility practice with the Admin Hub console.

## Consequences

- The interface keeps no business rule and talks to an application service whose transport is chosen per surface; adding a server surface does not need a new interface.
- The interface is still compiled to WebAssembly and rendered in a webview on the desktop; the 100% Rust target is about the source and the build, with no Node.js.
- Accessibility (WCAG 2.1 AA) and localization of the interface are checked in the browser and in the desktop webview.
- Whether and when a server surface (Business edition) is built is a separate decision, recorded in its own ADR.
