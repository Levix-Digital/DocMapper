import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
    // The desktop shell loads the dev server from this fixed port (tauri.conf.json devUrl).
    clearScreen: false,
    server: {
        port: 5173,
        strictPort: true,
    },
    plugins: [
        vue(),
        topLevelAwait()
    ],
    build: {
        sourcemap: false,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
    }
})
