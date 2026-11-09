# Contract: core text API

Public functions of `docmapper_core::text`, with the TypeScript function each one twins.

| Rust | TypeScript (`parity/text/`) | Result |
|---|---|---|
| `format_output_file_name(&FileNameOptions, CalendarDate) -> Result<String, FileNameError>` | `formatOutputFileName(options)` with the clock at the given date | File name ending in `.pdf` (any case) |
| `check_validation_pattern(pattern: &str, candidate: &str) -> PatternCheck` | `testRegexPattern(pattern, candidate)` | `{matches, error?}` |
| `flatten_dictionary(&serde_json::Map<String, Value>, prefix: &str) -> Result<FlatDictionary, LeafWithoutText>` | `flattenDictionary(nested, prefix = '')` | Paths to text; `Err` where JavaScript throws `TypeError: Cannot convert object to primitive value` |
| `sanitize_punctuation(source: &str, translated: &str) -> String` | `sanitizePunctuation(source, translated)` | Translated text without unwanted trailing `;:.,` |

## Parity module `text`

Oracle and fixture function names, and the input array of each:

| Function | Input |
|---|---|
| `formatOutputFileName` | `[options, nowMs]`, `options` as the TypeScript `FormatFileNameOptions` (`pattern` may be absent or `null`) |
| `testRegexPattern` | `[pattern, candidate]` |
| `flattenDictionary` | `[nested]` or `[nested, prefix]` |
| `sanitizePunctuation` | `[source, translated]` |

For `testRegexPattern`, the comparison replaces the value of `error`, when present, by a fixed marker on both sides before the exact comparison (FR-008).
