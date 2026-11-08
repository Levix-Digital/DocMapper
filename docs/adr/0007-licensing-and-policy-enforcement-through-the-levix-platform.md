---
id: 7
title: Licensing and policy enforcement through the levix-platform crates
status: accepted
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
- Every denial writes a local, metadata-only audit record (rule, command, time, device; never document content or paths) through the levix-platform audit crate (levix-platform FEAT-015), sent to the Admin Hub on the channel.
- DocMapper keeps a **signed product manifest** in this repository in the levix-platform manifest format (levix-platform FEAT-025), signed by Levix before the Admin Hub imports it. It declares:
  - client kinds: `desktop` and `mcp-server`;
  - data definition formats: the mapped document family profile format;
  - seat model: per user by default, per device supported;
  - policy categories: `vision_fallback` (allowed, endpoint), `cloud_models` (allowed, providers), `export` (allowed, formats), `profile_publishing` (allowed), `batch` (allowed, maximum size), `central_database` (allowed), `mcp_server` (enabled, allowed tools), `telemetry` (level);
  - counters, counts only, in heartbeats: documents mapped, exports, vision fallback calls, cloud model calls, batch runs, MCP calls; MCP call metadata (caller process, tool, volume, time, never payloads) at the level the policy sets;
  - accepted commands, including the kill-switch.
- The kill-switch from the Admin Hub channel blocks the corporate environment at once.
- Endpoints, model keys and the central database connection string delivered by the Admin Hub arrive encrypted to the device public key, are never shown to users and are stored in the operating system keychain; until Admin Hub v0.5.0, the keychain entry set on the device covers the corporate case.
- Offline, the last valid policy and certificate apply for the validity the company sets (default 72 hours); after that only the corporate environment is suspended.

## Alternatives Considered

- **Keep the online check**: the product would call Levix servers, against the agreement and the on-premise positioning.
- **Product-specific governance in DocMapper**: duplicates the Admin Hub and the platform engine.

## Consequences

- Enforcement happens below every surface, so the interface cannot bypass it.
- Delivery follows the Admin Hub releases v0.2.0 to v0.5.0: enrollment, policies and counters (FEAT-035) ship only after Admin Hub v0.3.0 is released; counters, corporate endpoints and MCP audit are governed by the Admin Hub from its v0.5.0. Confirmed with the Admin Hub on 2026-11-08 (thread 20261108-202834). The up-to-five-machines license path does not depend on any Admin Hub release.
- The free edition (three document families, no Admin Hub) is enforced by the same license check.
