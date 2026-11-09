# Data Model: M1 Text utilities

All types live in `crates/docmapper-core/src/text/`. They are values: no I/O, no shared state.

## FileNameOptions

| Field | Type | Rule |
|---|---|---|
| `pattern` | `Option<String>` | Absent, or text with tokens; blank means the default name |
| `original_file_name` | `String` | Name of the source PDF |
| `extracted_data` | `PropertyMap<String>` | Field name or id to extracted value, in ECMAScript key order |
| `doc_index` | `u64` | 0-based position, at most 2^53 − 2 (the 1-based index stays a safe integer) |
| `total_docs` | `Option<u64>` | Carried for parity of the input; not used by the formatter (as in TypeScript) |

## CalendarDate

A UTC calendar date from 1970-01-01 to 9999-12-31, built from Unix milliseconds (`from_unix_millis`), written as `YYYY-MM-DD` (the date part of `Date.prototype.toISOString`).

## FileNameError

| Variant | When | JavaScript error it stands for |
|---|---|---|
| `InheritedMemberToken { token }` | A field token names an `Object.prototype` member absent from the extracted data | `TypeError: extractedData[trimmed].trim is not a function` |
| `StringTooLong` | The name, or any step building it (padding, a replacement, the extension), passes 536,870,888 UTF-16 units | `RangeError: Invalid string length` |
| `IndexOutOfRange { doc_index }` | The document index is above 2^53 − 2 (outside what callers pass) | none (refused before any JavaScript-visible step) |

The core does not hold JavaScript message texts; the parity tests map each variant to its JavaScript name and message.

## PatternCheck

| Field | Type | Rule |
|---|---|---|
| `matches` | `bool` | The pattern finds a match anywhere in the candidate; `false` when the pattern is invalid |
| `error` | `Option<String>` | Set only when the pattern is invalid; the text comes from the regex engine (FR-008) |

## PropertyMap<V>

An ordered map with ECMAScript property order: canonical array-index keys (0 to 2^32 − 2, no leading zeros) first in ascending numeric order, then the other keys in first-insertion order. Setting an existing key keeps its position. `assign_primitive` ignores the key `__proto__` when the value is not an object, as an assignment to a plain object does.

## FlatDictionary

`PropertyMap<String>`: dot-separated paths to text, the output of `flatten_dictionary` (which returns `Result<FlatDictionary, LeafWithoutText>`). Leaves convert as `String(value)`: text as is, numbers as `Number.prototype.toString`, booleans as `true`/`false`, arrays as `Array.prototype.join(',')` with `null` as empty text and objects as `[object Object]`; `null` leaves are skipped; objects recurse.

## LeafWithoutText

The error of `flatten_dictionary` when a leaf has no text: an array holding an object with an own `toString` key, where JavaScript throws `TypeError: Cannot convert object to primitive value`. Carries the leaf's `path`.
