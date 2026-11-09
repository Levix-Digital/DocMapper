// Injected clock for the parity module `text` (FR-004): runs a function while
// `new Date()` with no argument returns a fixed moment, without changing the
// frozen reference copy. The global Date is restored afterwards.

import { formatOutputFileName, type FormatFileNameOptions } from './filename-formatter'

export function withFixedNow<T>(nowMs: number, run: () => T): T {
    const RealDate = globalThis.Date
    class FixedDate extends RealDate {
        constructor(...args: unknown[]) {
            if (args.length === 0) super(nowMs)
            else super(...(args as [string | number | Date]))
        }
        static now() {
            return nowMs
        }
    }
    globalThis.Date = FixedDate as DateConstructor
    try {
        return run()
    } finally {
        globalThis.Date = RealDate
    }
}

/** `formatOutputFileName(options)` with the clock at `nowMs`. */
export function formatOutputFileNameAt(options: FormatFileNameOptions, nowMs: number): string {
    return withFixedNow(nowMs, () => formatOutputFileName(options))
}
