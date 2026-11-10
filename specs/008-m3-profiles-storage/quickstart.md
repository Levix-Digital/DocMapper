# Quickstart: M3 Profiles

```sh
# TypeScript: characterization tests with branch coverage (check mode)
npm run test:parity --prefix frontend
# rewrite the profiles fixtures after a reviewed change of the cases
PARITY_UPDATE=1 npm run test:parity --prefix frontend

# Rust: core and SQLite adapter
cargo test -p docmapper-core -p docmapper-sqlite
cargo test -p docmapper-parity --test profiles

# Differential fuzzing against the TypeScript oracle (needs Node.js and frontend dependencies)
cargo test -p docmapper-parity --test profiles -- --include-ignored

# One-sided ids
cargo run -q -p docmapper-parity --bin parity-check
```
