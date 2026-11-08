---
id: 8
title: Secrets in the operating system keychain
status: accepted
date: '2026-11-08'
version: null
subsystems: [core, storage, vision-fallback]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0008: Secrets in the operating system keychain

## Context

API keys for model providers are kept today in the browser's localStorage, and central database connection strings (ADR-0006) are also secrets.

## Decision

- Secrets (model API keys, connection strings) are stored in the **operating system keychain** (Windows Credential Manager, macOS Keychain, Secret Service on Linux) through the `SecretStore` port, implemented with the `keyring` crate.
- Secrets never go to the database, logs or `.docmapper` files.
- In the corporate environment, endpoint and key may be delivered by the Admin Hub policy instead.

## Alternatives Considered

- **Encrypted file in the application directory**: needs its own key management.
- **localStorage as today**: plain text on disk.

## Consequences

- Users enter a key once per computer; the keychain protects it with the operating system account.
