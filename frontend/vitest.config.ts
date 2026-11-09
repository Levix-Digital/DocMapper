import { defineConfig } from 'vitest/config'

// Unit tests live next to the code (frontend/src) and in the parity tooling;
// characterization tests (*.parity.test.ts) write or check parity fixtures.
export default defineConfig({
    test: {
        dir: '..',
        // Branch coverage of the frozen reference copies (FR-002 of M1); on
        // in `npm run test:parity`.
        coverage: {
            provider: 'v8',
            allowExternal: true,
            include: ['**/parity/text/**/*.ts'],
            exclude: ['**/*.test.ts'],
            reporter: ['text'],
            thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
        },
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
