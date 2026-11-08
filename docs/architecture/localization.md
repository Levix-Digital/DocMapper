---
title: Localization
summary: Interface dictionaries, machine translation through Google Translate and a local cache.
code: [frontend/src/i18n, frontend/src/services/i18n/translation-service.ts]
---

# Localization

Interface dictionaries, machine translation through Google Translate and a local cache.

## Responsibilities

Owns the interface texts in several languages: the base dictionaries, machine translation of missing languages and their cache.

## Structure

- `frontend/src/i18n`: dictionaries and the language list.
- `frontend/src/services/i18n/translation-service.ts`: `flattenDictionary`, `sanitizePunctuation`, cache helpers and `getOrTranslateDictionary`.

## Behavior

- A language not bundled is translated from English through the public Google Translate endpoint, with placeholders protected and punctuation restored, then cached in localStorage.

## Interfaces

- Called by the language picker and the interface.

## Decisions

- [ADR-0003](../adr/0003-module-by-module-migration-with-the-typescript-code-as-parit.md): the pure helpers are ported in module M1, the network part in M8.
