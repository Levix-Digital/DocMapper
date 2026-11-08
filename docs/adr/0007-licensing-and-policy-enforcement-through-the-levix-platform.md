---
id: 7
title: Licensing and policy enforcement through the levix-platform crates
status: proposed
date: '2026-11-08'
version: null
subsystems: [licensing]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0007: Licensing and policy enforcement through the levix-platform crates

## Context

DocMapper verifies a license key online (`cpx_live_` keys, domain check, Express and SQLite backend). The agreement with the Admin Hub project (accepted on 2026-11-07) moves licensing and governance to the Admin Hub and to the levix-platform crates: policies are authored and signed in the Admin Hub, and products only enforce them.

## Decision

- The online license check and the Express backend are removed.
- DocMapper verifies a **Levix-signed license offline** with the levix-platform license crate: up to five machines from a license file imported on each device; above five machines, paid use requires the Admin Hub, which delivers the license.
- DocMapper has **no governance logic of its own**: it calls the levix-platform policy engine (FEAT-013) through the `PolicyGate` port before each core command that a policy can restrict (vision fallback endpoint, use of a cloud key, export, profile publishing, batch).
- DocMapper keeps a **signed product manifest** in this repository declaring its policy categories, telemetry counters (counts only), accepted commands and seat model.
- Offline, the last valid policy and certificate apply for the validity the company sets (default 72 hours); after that only the corporate environment is suspended.

## Alternatives Considered

- **Keep the online check**: the product would call Levix servers, against the agreement and the on-premise positioning.
- **Product-specific governance in DocMapper**: duplicates the Admin Hub and the platform engine.

## Consequences

- Enforcement happens below every surface, so the interface cannot bypass it.
- Delivery follows the Admin Hub releases v0.2.0 to v0.5.0; the migration does not need it before module M9.
- Free edition limits are still open.
