---
id: 6
title: 'Profiles stored in a database: local SQLite by default, central database by connection string'
status: accepted
date: '2026-11-08'
version: null
subsystems: [storage]
supersedes: []
superseded_by: []
amends: []
amended_by: [14]
---

# ADR-0006: Profiles stored in a database: local SQLite by default, central database by connection string

## Context

Profiles are stored today in the browser's localStorage and exchanged as `.docmapper` files. As an on-premise product, DocMapper must keep data on the customer's side; teams want to share the same profiles across computers without a Levix server.

## Decision

- Every profile and template is read from a database through the `ProfileRepository` port.
- By default the database is a **local SQLite** file in the application data directory.
- The customer may point DocMapper to a **central database with a connection string**; in version 1.0 the supported central database is **PostgreSQL**. SQL Server and MySQL come later as new adapters of the same port.
- `.docmapper` import and export remain, with the same JSON format as today.

## Alternatives Considered

- **One JSON file per profile on disk**: simple, but no sharing between computers.
- **A Levix-hosted sync service**: against the on-premise positioning.

## Consequences

- Teams share profiles by pointing to the same database; the customer owns backup and access control of a central database.
- Connection strings are secrets and are stored in the keychain (ADR-0008).
- Parity for module M3 is on the stored JSON of each profile.
