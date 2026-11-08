---
title: Licensing
summary: Online license key and domain check against the Express and SQLite backend.
code: [frontend/src/services/license-service.ts, backend/src]
---

# Licensing

Online license key and domain check against the Express and SQLite backend.

## Responsibilities

Owns the online license check that decides whether the application starts.

## Structure

- `frontend/src/services/license-service.ts`: `LicenseService`, reading `VITE_LICENSE_KEY` and `VITE_LICENSE_SERVER`.
- `backend/src`: Express server with a SQLite database of keys and authorized domains (`routes/license.ts`, `db.ts`, `seed.ts`).

## Behavior

- On startup the interface posts the key and the current domain to `/api/verify`, retrying up to three times; any failure blocks the application.

## Interfaces

- Called once at startup, before the core module loads.

## Decisions

- [ADR-0007](../adr/0007-licensing-and-policy-enforcement-through-the-levix-platform.md): replaced by an offline signed license and policy enforcement through the levix-platform crates.
