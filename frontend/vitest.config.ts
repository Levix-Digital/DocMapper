import { defineConfig } from 'vitest/config'

// Unit tests live next to the code (frontend/src) and in the parity tooling;
// characterization tests (*.parity.test.ts) write or check parity fixtures.
export default defineConfig({
    test: {
        dir: '..',
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    include: ['frontend/src/**/*.test.ts', 'parity/**/*.test.ts'],
                    exclude: ['**/node_modules/**', 'parity/**/*.parity.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'parity',
                    include: ['parity/**/*.parity.test.ts'],
                    exclude: ['**/node_modules/**'],
                },
            },
        ],
    },
})
