// Vitest binding of the fixture writer: one `it` per case, run record after all.

import { afterAll, it } from 'vitest'
import { resolveFunction, type ModuleTable } from '../shared/outcome'
import { assertCaseResult, ParityRecorder } from './fixture-writer'

export function parityModule(table: ModuleTable, module: string) {
    const recorder = new ParityRecorder(module)
    afterAll(() => {
        recorder.writeRunRecord()
    })
    return {
        case(id: string, fnName: string, input: unknown[]) {
            it(`${module}/${id}`, () => {
                assertCaseResult(recorder.record(id, fnName, resolveFunction(table, module, fnName), input))
            })
        },
    }
}
