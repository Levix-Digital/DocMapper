// Writes and checks parity fixtures from characterization tests.
// Update mode (PARITY_UPDATE=1) writes parity/fixtures/<module>/<case>.json;
// check mode fails when the TypeScript outcome differs from the committed file.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertRepresentable, evaluate, type ModuleFunction, type Outcome } from '../shared/outcome'

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type Mode = 'update' | 'check'

export type Fixture = { id: string; module: string; function: string; input: unknown[] } & Outcome

export type CaseResult =
    | { status: 'written' | 'unchanged'; path: string }
    | { status: 'missing' | 'different'; path: string; expected?: string; actual: string }

export function modeFromEnvironment(env: Record<string, string | undefined> = process.env): Mode {
    return env.PARITY_UPDATE === '1' ? 'update' : 'check'
}

export function fixturePath(root: string, module: string, id: string): string {
    return join(root, 'parity', 'fixtures', module, `${id}.json`)
}

export function runRecordPath(root: string, module: string): string {
    return join(root, 'target', 'parity', 'ts', `${module}.ids`)
}

/** Serializes a fixture with a fixed key order, two-space indentation and a final newline. */
export function serializeFixture(fixture: Fixture): string {
    const ordered: Record<string, unknown> = {
        id: fixture.id,
        module: fixture.module,
        function: fixture.function,
        input: fixture.input,
    }
    if ('error' in fixture) ordered.error = { name: fixture.error.name, message: fixture.error.message }
    else ordered.output = fixture.output
    return `${JSON.stringify(ordered, null, 2)}\n`
}

/** Records the cases of one module and writes or checks their fixtures. */
export class ParityRecorder {
    private readonly ids = new Set<string>()

    constructor(
        readonly module: string,
        readonly root: string = REPOSITORY_ROOT,
        readonly mode: Mode = modeFromEnvironment(),
    ) {
        if (!ID_PATTERN.test(module)) throw new Error(`invalid module name '${module}'`)
    }

    /** Runs one case: evaluates `fn(...input)` and writes or checks its fixture. */
    record(id: string, fnName: string, fn: ModuleFunction, input: unknown[]): CaseResult {
        if (!ID_PATTERN.test(id)) throw new Error(`invalid case id '${id}' in module '${this.module}'`)
        if (this.ids.has(id)) throw new Error(`duplicate case id '${id}' in module '${this.module}'`)
        this.ids.add(id)
        assertRepresentable(input, '$.input')
        const fixture = { id, module: this.module, function: fnName, input, ...evaluate(fn, input) } as Fixture
        const actual = serializeFixture(fixture)
        const path = fixturePath(this.root, this.module, id)
        const expected = existsSync(path) ? readFileSync(path, 'utf8') : undefined
        if (this.mode === 'update') {
            if (expected === actual) return { status: 'unchanged', path }
            mkdirSync(dirname(path), { recursive: true })
            writeFileSync(path, actual)
            return { status: 'written', path }
        }
        if (expected === undefined) return { status: 'missing', path, actual }
        if (expected !== actual) return { status: 'different', path, expected, actual }
        return { status: 'unchanged', path }
    }

    /** Writes the run record: the sorted ids of every case recorded in this run. */
    writeRunRecord(): string {
        const path = runRecordPath(this.root, this.module)
        mkdirSync(dirname(path), { recursive: true })
        const ids = [...this.ids].sort()
        writeFileSync(path, ids.length ? `${ids.join('\n')}\n` : '')
        return path
    }
}

/** Throws with a readable message when a case result is a failure in check mode. */
export function assertCaseResult(result: CaseResult): void {
    if (result.status === 'missing') {
        throw new Error(`fixture missing: ${result.path}; run with PARITY_UPDATE=1 to write it`)
    }
    if (result.status === 'different') {
        throw new Error(
            `TypeScript outcome differs from ${result.path}\n--- committed\n${result.expected}--- actual\n${result.actual}`,
        )
    }
}
