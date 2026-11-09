# Quickstart: M1 Text utilities

```sh
# TypeScript: characterization tests with branch coverage (check mode)
npm run test:parity --prefix frontend
# rewrite the text fixtures after a reviewed change of the cases
PARITY_UPDATE=1 npm run test:parity --prefix frontend

# Rust: unit tests of the core and fixtures of the text module
cargo test -p docmapper-core
cargo test -p docmapper-parity --test text

# Differential fuzzing against the TypeScript oracle (needs Node.js and frontend dependencies)
cargo test -p docmapper-parity --test text -- --include-ignored

# One-sided ids
cargo run -q -p docmapper-parity --bin parity-check
```
