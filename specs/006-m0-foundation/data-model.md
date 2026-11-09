# Data Model: M0 Foundation

## Fixture (`parity/fixtures/<module>/<case>.json`)

| Field | Type | Rules |
|---|---|---|
| `id` | string | Equals the file name without `.json`; lowercase letters, digits and `-`; unique within the module |
| `module` | string | Equals the folder name; listed in the registry |
| `function` | string | Name of the function in the module's oracle table |
| `input` | any JSON | The argument list, as an array |
| `output` | any JSON | Present when the function returned; absent when it threw |
| `error` | object `{name, message}` | Present when the function threw; absent when it returned |

Exactly one of `output` and `error`. Files are written with two-space indentation and a final newline, keys in the order above.

## Module registry (`parity/modules.json`)

`{"modules": {"<module>": "characterized" | "ported"}}`. A module is `characterized` when its TypeScript cases and fixtures exist, `ported` when Rust must pass them too.

## Run record (`target/parity/<ts|rust>/<module>.ids`)

One case id per line, sorted, written by one side's test run; not committed.

## Oracle request and response

Request: `{"seq": n, "module": "...", "function": "...", "input": [...]}`. Response: `{"seq": n, "output": ...}` or `{"seq": n, "error": {"name", "message"}}`, or `{"seq": n, "failure": "..."}` when the request itself is invalid (unknown module or function). See `contracts/oracle-protocol.md`.
