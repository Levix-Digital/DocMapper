// Scenario runner of the parity module `profiles` (FR-004 of M3): runs one
// operation of the frozen profile store over an in-memory browser storage
// holding the given profiles, a ticking clock and a scripted random source,
// without changing the frozen copy. Globals are restored afterwards.

import * as store from './profile-store'

const STORAGE_KEY = 'docmapper_mapping_profiles'

/** The state an operation starts from and its arguments. */
export type Scenario = {
    /** Stored profiles before the call, in stored order. */
    stored: unknown[]
    /** Every read of the clock gives `start + n * step`, n = 0, 1, 2... */
    clock: { start: number; step: number }
    /** Values `Math.random()` gives, in order; running out is a case defect. */
    random: number[]
    /** Arguments of the operation. */
    args: unknown[]
}

/** What an operation returned (`null` for nothing) and the stored profiles after it. */
export type ScenarioResult = { returned: unknown; stored: unknown }

/** An export: the download's file name and the text of its Blob. */
export type ExportedFile = { fileName: string; contents: string }

export class RandomExhausted extends Error {
    constructor() {
        super('the scenario has no more random values')
        this.name = 'RandomExhausted'
    }
}

type Globals = { window?: unknown; localStorage?: unknown; document?: unknown; Blob?: unknown; URL?: unknown }

function memoryStorage(initial: Map<string, string>) {
    return {
        getItem: (key: string) => initial.get(key) as string,
        setItem: (key: string, value: string) => {
            initial.set(key, String(value))
        },
    }
}

/** Runs `operation` inside the scenario; the export captures the download instead of a page. */
export function runScenario(scenario: Scenario, operation: (...args: never[]) => unknown, exported: { file?: ExportedFile } = {}): ScenarioResult {
    const g = globalThis as unknown as Globals & { Date: DateConstructor; Math: Math }
    const saved: Globals = { window: g.window, localStorage: g.localStorage, document: g.document, Blob: g.Blob, URL: g.URL }
    const RealDate = g.Date
    const realRandom = g.Math.random
    const cells = new Map<string, string>([[STORAGE_KEY, JSON.stringify(scenario.stored)]])
    let reads = 0
    const tick = () => scenario.clock.start + reads++ * scenario.clock.step
    class TickingDate extends RealDate {
        // The store only builds `new Date()` with no argument.
        constructor() {
            super(tick())
        }
        static now() {
            return tick()
        }
    }
    const randoms = [...scenario.random]
    const pending: { blob?: { text: string } } = {}
    g.window = g
    g.localStorage = memoryStorage(cells)
    g.Blob = class {
        text: string
        constructor(parts: string[]) {
            this.text = parts.join('')
        }
    }
    g.URL = {
        createObjectURL: (blob: { text: string }) => {
            pending.blob = blob
            return 'blob:parity'
        },
        revokeObjectURL: () => undefined,
    }
    g.document = {
        createElement: () => {
            const anchor = {
                href: '',
                download: '',
                click: () => {
                    exported.file = { fileName: anchor.download, contents: (pending.blob as { text: string }).text }
                },
            }
            return anchor
        },
        body: { appendChild: () => undefined, removeChild: () => undefined },
    }
    g.Date = TickingDate as DateConstructor
    g.Math.random = () => {
        const next = randoms.shift()
        if (next === undefined) throw new RandomExhausted()
        return next
    }
    try {
        const returned = operation(...(scenario.args as never[]))
        return { returned: returned === undefined ? null : returned, stored: JSON.parse(cells.get(STORAGE_KEY) as string) }
    } finally {
        g.Date = RealDate
        g.Math.random = realRandom
        for (const key of Object.keys(saved) as (keyof Globals)[]) {
            if (saved[key] === undefined) delete g[key]
            else g[key] = saved[key]
        }
    }
}

const on = (operation: (...args: never[]) => unknown) => (scenario: Scenario) => runScenario(scenario, operation)

/** The operations as the oracle and the characterization tests call them. */
export const createEmptyProfile = on(store.createEmptyProfile)
export const getAllProfiles = on(store.getAllProfiles)
export const getProfileById = on(store.getProfileById)
export const saveProfile = on(store.saveProfile)
export const deleteProfile = on(store.deleteProfile)
export const duplicateProfile = on(store.duplicateProfile)
export const importProfileFromDocMapper = on(store.importProfileFromDocMapper)

/** The export returns the downloaded file instead of nothing. */
export function exportProfileAsDocMapper(scenario: Scenario): ScenarioResult {
    const exported: { file?: ExportedFile } = {}
    const result = runScenario(scenario, store.exportProfileAsDocMapper, exported)
    return { returned: exported.file as ExportedFile, stored: result.stored }
}
