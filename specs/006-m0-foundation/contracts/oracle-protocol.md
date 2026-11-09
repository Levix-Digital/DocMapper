# Oracle protocol

The oracle is started as `npx tsx parity/oracle/main.ts` from the repository root (the Rust client runs it with the frontend's `node_modules/.bin/tsx`). It reads requests from stdin and writes responses to stdout, one JSON object per line, in request order. It writes nothing else to stdout; diagnostics go to stderr. It exits when stdin closes.

| Message | Shape |
|---|---|
| Request | `{"seq": 1, "module": "harness", "function": "describe", "input": [3.5, "a"]}` |
| Returned | `{"seq": 1, "output": {...}}` |
| Threw | `{"seq": 1, "error": {"name": "RangeError", "message": "..."}}` |
| Invalid request | `{"seq": 1, "failure": "unknown module 'x'"}` |

The function is called as `fn(...input)`. The output is serialized with `JSON.stringify`; a value JSON cannot represent (`undefined`, `NaN`, `Infinity`, a function) is a `failure`, so a module that returns one must map it explicitly in its oracle table. The Rust client treats a `failure`, a malformed line, a wrong `seq` or the process exiting as an error, never as a match.
