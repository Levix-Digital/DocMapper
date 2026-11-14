---
name: environment
description: Machines, cloud and CI: versions, blocked hosts, setup quirks. Read when a command, install or network call fails or behaves differently between machines.
updated: 2026-11-14
---

- 2026-11-09: Cloud containers have the pinned Rust toolchain and Node 22 but no webkit2gtk; building or linting the desktop crate needs apt-get update and libwebkit2gtk-4.1-dev with the other Tauri Linux packages.
- 2026-11-09: The dev-cycle launcher's engine download can be refused in cloud sessions; build the engine with cargo build --release --locked -p dev-cycle in the protocol clone and set DEV_CYCLE_BIN.
- 2026-11-06: In cloud sessions, dcp-integrations needs this repository and each recipient's repository attached with push access; otherwise git asks for a username or the proxy answers 403.
- 2026-11-10: Checking the desktop app in a cloud container: Xvfb on :99 with WEBKIT_DISABLE_DMABUF_RENDERER=1 and xdotool for input; in the GTK file chooser, type paths one character at a time.
- 2026-11-10: The interface needs the local licensing backend: seed it with npx ts-node src/seed.ts and run npx ts-node src/index.ts in backend/, and give the frontend a .env.local built from .env.example with the seeded test key. .env.local is not in .gitignore: never commit it.
- 2026-11-10: In the Tauri window on Linux (WebKitGTK), window.alert and window.confirm show nothing and confirm returns true; use in-window notices instead.
