# Data Model: M3 Profiles

## ProfileDocument (core, `profiles::document`)

A stored profile: a JSON object (`serde_json::Map`, insertion order kept). Accessors: `id() -> Option<&str>` (the `id` key when it is text), `name() -> Option<&Value>`. Built only from JSON objects; the store never changes a key it does not own (`id`, `name`, `createdAt`, `updatedAt`, set with object spread rules: replace in place or append).

## MappingProfile (core, `profiles::model`), typed read model

| Type | Fields |
|---|---|
| `BoundingBox` | `x`, `y`, `width`, `height` (f64, percentage of the page, 0 to 100), `page` (1-based) |
| `FieldDataType` | `text`, `alphanumeric`, `date`, `number`, `multiline` |
| `FieldDefinition` | `id`, `name`, `color`, `label_box?`, `anchor_text?`, `value_box?`, `validation_pattern`, `data_type`, `is_required`, `sample_extracted_value?` |
| `RenderFormat` | `TEXT`, `CODE128`, `QR_CODE` |
| `DestinationFieldMapping` | `id`, `source_type?` (`field`, `custom`), `field_id?` (nullable), `custom_text?`, `prefix?`, `suffix?`, `target_box`, `render_format`, `font_size?`, `horizontal_align?` (`left`, `center`, `right`), `vertical_align?` (`top`, `middle`, `bottom`) |
| `MappingProfile` | `id`, `name`, `version`, `created_at`, `updated_at` (ISO text), `fields`, `destination_template_base64?`, `destination_template_name?`, `destination_mappings`, `output_file_name_pattern?` |

JSON names are the camelCase names of `mapping.ts`. `MappingProfile::from_document(&ProfileDocument)` fails with the JSON path of the first key that does not fit; unknown keys are ignored. `ExtractionResult` and `GeminiPatternResponse` stay with their modules (M6, M8).

## Ports (core, `profiles::ports`)

- `Clock::now_millis(&self) -> f64`
- `RandomSource::next_f64(&mut self) -> f64` (in `[0, 1)`)
- `ProfileRepository`: `list`, `save`, `delete` (see contract)

## SQLite schema (adapter, migration 1)

```sql
CREATE TABLE profile (
    id       TEXT    PRIMARY KEY NOT NULL,
    position INTEGER NOT NULL UNIQUE,
    document TEXT    NOT NULL
) STRICT;
```

`PRAGMA user_version = 1`. Order is `position` ascending. Later migrations only add.

## Profile fixture (parity module `profiles`)

`input`: `[{ "stored": [<profile>...], "clock": { "start": <ms>, "step": <ms> }, "random": [<f64>...], "args": [...] }]`; `output`: `{ "returned": <value or null>, "stored": [<profile>...] }`, or `error` `{name, message}`.
