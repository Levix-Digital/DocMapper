// Runs the Tauri CLI for the desktop crate from the frontend folder, on every
// platform: `npm run tauri -- dev`, `npm run tauri -- build`.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const appPath = fileURLToPath(new URL('../../crates/docmapper-desktop', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url))

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TAURI_APP_PATH: process.env.TAURI_APP_PATH ?? appPath },
})
if (result.error) {
    console.error(`cannot run the Tauri CLI: ${result.error.message}`)
    process.exit(1)
}
process.exit(result.status ?? 1)
