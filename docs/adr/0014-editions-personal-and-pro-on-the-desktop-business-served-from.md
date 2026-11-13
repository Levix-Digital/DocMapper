---
id: 14
title: 'Editions: Personal and Pro on the desktop, Business served from the customer''s server'
status: accepted
date: '2026-11-13'
version: null
subsystems: [licensing, storage, desktop]
supersedes: []
superseded_by: []
amends: [1, 6]
amended_by: []
---

# ADR-0014: Editions: Personal and Pro on the desktop, Business served from the customer's server

## Context

DocMapper is a desktop app (ADR-0001). Teams share profiles today by pointing every desktop to one central database with a connection string (ADR-0006, FEAT-012). That gives every desktop full access to the database, so the product cannot enforce access levels: who may run extractions, edit profiles or publish them to the team. The product owner decided on 2026-11-12 and 2026-11-13 to keep the desktop for personal use and small paid installations, and to serve the team edition from a server in the customer's perimeter, with one shared profile base and access levels. The interface is built so it can run in the desktop and in the browser (ADR-0013), and the Admin Hub already plans to enroll product servers and sign their users in (Admin Hub roadmap v0.4.0).

## Decision

- **Personal (free)**: desktop app, local SQLite, up to three document families, no sign-up and no Admin Hub. Unchanged.
- **Pro (paid)**: desktop app on up to five machines, a Levix-signed license file imported on each device, no server and no Admin Hub. Profiles stay in the local SQLite of each machine; Pro has no shared profile base. Profiles move between machines only through `.docmapper` export and import.
- **Business (paid)**: a DocMapper server surface hosted by the customer (VPC or on-premises) and used from the browser, with one shared profile base in PostgreSQL. It always runs with the Admin Hub: users and groups come from the Hub (directory or SSO) through its sign-in for product servers; licenses, seats and policies come from the Hub. Any paid use above five machines is Business.
- Access levels in Business are decided by the server per profile from the groups the Hub provides. The first set is operator (runs published profiles), editor (edits drafts), curator (publishes versions; `profile_publishing` policy of ADR-0007) and DocMapper administrator.
- Business profiles are versioned: each publication is an immutable revision, operators run the latest published revision, and each extraction result records the revision that produced it.
- The path from the desktop to Business is `.docmapper` export and import (FEAT-050), with import as a draft.
- Desktops do not connect to a central database. The PostgreSQL repository of FEAT-012 becomes the storage of the Business server. This amends ADR-0006.
- The server is a new surface of the same core, next to `desktop` and `mcp`; the core keeps no knowledge of the surface (ADR-0002). This amends the "no server component" of ADR-0001.

## Alternatives Considered

- **Every paid use on Business**: one paid product, but small offices would have to host a server and the Admin Hub, against the five-machine path that needs no server.
- **Business without the Admin Hub for up to five users**: no Hub for small teams, but the server would keep its own users, licenses and policies, duplicating the Hub (ADR-0007).
- **Shared profiles on the desktop through a central database**: no server to host, but no access levels, no versioning under control and full database access on every machine.

## Consequences

- The Business edition is a new epic: HTTP surface, users and profile scope, revisions, job queue for batches, file storage, container packaging, `server` client kind in the product manifest and Hub enrollment as a product server.
- Business cannot ship with access levels before the Admin Hub serves sign-in for product servers (Hub v0.4.0).
- Business can ship with the current Vue interface over HTTP before FEAT-042 replaces it on both surfaces.
- The privacy promise reads "in the customer's perimeter" for Business: documents reach the customer's server, never Levix.
- The MCP server needs a remote transport on the Business server; the stdio transport stays for the desktop.
- The release placement of the Business epic is decided in the roadmap, not here.
