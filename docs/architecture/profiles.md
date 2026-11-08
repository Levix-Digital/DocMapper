---
title: Profiles
summary: 'Mapping profiles: the built-in CMR profile, storage, duplication and .docmapper import and export.'
code: [frontend/src/services/mapping/profile-store.ts, frontend/src/types/mapping.ts]
---

# Profiles

Mapping profiles: the built-in CMR profile, storage, duplication and .docmapper import and export.

## Responsibilities

Owns mapping profiles: their types, the built-in CMR profile, create, save, delete and duplicate, and `.docmapper` import and export. It does not own extraction.

## Structure

- `frontend/src/types/mapping.ts`: `MappingProfile`, `FieldDefinition` (label box, value box, validation pattern, required flag), destination mappings and `ExtractionResult`.
- `frontend/src/services/mapping/profile-store.ts`: `createBuiltinCmrProfile` (`builtin-cmr-standard`), `createEmptyProfile`, `getAllProfiles`, `getProfileById`, `saveProfile`, `deleteProfile`, `duplicateProfile`, `exportProfileAsDocMapper`, `importProfileFromDocMapper`.

## Behavior

- All profiles are kept as one JSON array in the browser's localStorage; corrupted data is reset with a warning.
- Export writes a `.docmapper` JSON file; import validates it and gives it a new identity.
- Box coordinates are normalized to the page (`x`, `y`, `w`, `h` in 0 to 1) with a page number.

## Interfaces

- Called by the Mapping Studio and profile management screens.

## Decisions

- [ADR-0006](../adr/0006-profiles-stored-in-a-database-local-sqlite-by-default-centra.md): storage moves to a database (local SQLite or a central database).
