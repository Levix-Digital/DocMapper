# Data Model: Interface wired to the Rust profile store

No new stored data: profiles keep the M3 model (`ProfileDocument` rows in the `profile` table of `docmapper.sqlite3`, schema version 1).

## Profile state (desktop shell)

| Field | Type | Meaning |
|---|---|---|
| `store` | `Result<Mutex<ProfileStore<SqliteProfileRepository, SystemClock, StdRandom>>, String>` | The store over the local database, or the reason the database could not be opened |

## CommandError (crosses to the interface)

| Field | Type | Values |
|---|---|---|
| `kind` | string | `invalid_file`, `syntax`, `type`, `range`, `database`, `file` |
| `message` | string | The core error's text |

Mapping: `StoreError::InvalidFile` → `invalid_file`; `Syntax` → `syntax`; `Type` → `type`; `Range` → `range`; `Repository` and an unopened database → `database`; a failed export write → `file`.

## ProfileService (interface)

| Operation | Returns |
|---|---|
| `createEmptyProfile(name?)` | `Promise<MappingProfile>` |
| `getAllProfiles()` | `Promise<MappingProfile[]>` |
| `getProfileById(id)` | `Promise<MappingProfile \| undefined>` |
| `saveProfile(profile)` | `Promise<void>` |
| `deleteProfile(id)` | `Promise<boolean>` |
| `duplicateProfile(id)` | `Promise<MappingProfile \| undefined>` |
| `importProfile(text)` | `Promise<MappingProfile>` |
| `exportProfile(profile)` | `Promise<boolean>` (false when the user cancelled) |
| `storageKind` | `'database' \| 'browser'` |

## Shadow difference (log only)

| Field | Meaning |
|---|---|
| `operation` | Service operation name |
| `part` | `returned` or `stored` |
| `path` | JSON path of the first difference (`$[1].fields[0].name`) |
| `database`, `browser` | The two values at that path |
