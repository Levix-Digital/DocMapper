# Quickstart: M0 Foundation

Prerequisites: Rust (the toolchain in `rust-toolchain.toml` installs itself through rustup), Node.js 22, and on Linux the Tauri system packages (`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`).

```bash
npm ci --prefix frontend
npm run asbuild --prefix frontend           # AssemblyScript module used by the interface
npm run tauri --prefix frontend -- dev      # desktop app with the live interface
npm run dev --prefix frontend               # browser version, as before
npm run tauri --prefix frontend -- build    # release build of the desktop app
```

Tests:

```bash
cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
npm test --prefix frontend
npm run test:parity --prefix frontend       # characterization cases, check mode, writes TypeScript run records
cargo test -p docmapper-parity -- --include-ignored
cargo run -p docmapper-parity --bin parity-check
```

Update fixtures after changing a characterization case: `PARITY_UPDATE=1 npm run test:parity --prefix frontend`, then review the fixture diff.
