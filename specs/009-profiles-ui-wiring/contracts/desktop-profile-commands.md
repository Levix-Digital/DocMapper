# Contract: desktop profile commands

Commands of `docmapper-desktop` the interface calls with `invoke` (Tauri 2). Arguments and results are JSON; profiles are JSON objects whose key order is kept. Every command fails with `{ "kind": ..., "message": ... }` (see data-model.md).

| Command | Arguments | Result | Core call |
|---|---|---|---|
| `profiles_create_empty` | `{ name?: any }` | profile | `ProfileStore::create_empty_profile` |
| `profiles_list` | `{}` | profile[] | `all_profiles` |
| `profiles_get` | `{ id: any }` | profile \| null | `profile_by_id` |
| `profiles_save` | `{ profile: object }` | null | `save_profile` |
| `profiles_delete` | `{ id: any }` | boolean | `delete_profile` |
| `profiles_duplicate` | `{ id: any }` | profile \| null | `duplicate_profile` |
| `profiles_import` | `{ text: string }` | profile | `import_docmapper` |
| `profiles_export` | `{ profile: object }` | string (saved path) \| null (cancelled) | `export_docmapper`, then the native save dialog and a file write |

Rules:

- Commands run one at a time on the store (one mutex).
- `profiles_save` with a value that is not a JSON object fails with `type` (`profile is not an object`); the interface never sends one.
- `profiles_export` proposes `export_docmapper(profile).file_name` in the dialog, filters `.dmap` and writes `contents` as UTF-8; a write failure fails with kind `file` and the operating system's message.
- `profiles_create_empty` treats a `null` name like a missing one (the default name); the interface never sends `null`.
- The existing `core_version` command is unchanged.
- The window's capabilities stay `core:default`.
