// Turns one oracle request line into one response object (contracts/oracle-protocol.md).

import { evaluate, resolveFunction, type ModuleTable } from '../shared/outcome'

export type Response =
    | { seq: number; output: unknown }
    | { seq: number; error: { name: string; message: string } }
    | { seq: number | null; failure: string }

function describeFailure(thrown: unknown): string {
    return thrown instanceof Error ? thrown.message : String(thrown)
}

export function handleRequest(line: string, table: ModuleTable): Response {
    let request: unknown
    try {
        request = JSON.parse(line)
    } catch (thrown) {
        return { seq: null, failure: `request is not JSON: ${describeFailure(thrown)}` }
    }
    if (typeof request !== 'object' || request === null || Array.isArray(request)) {
        return { seq: null, failure: 'request is not an object' }
    }
    const { seq, module, function: fnName, input } = request as Record<string, unknown>
    if (typeof seq !== 'number' || !Number.isSafeInteger(seq)) return { seq: null, failure: 'seq is not an integer' }
    if (typeof module !== 'string') return { seq, failure: 'module is not a string' }
    if (typeof fnName !== 'string') return { seq, failure: 'function is not a string' }
    if (!Array.isArray(input)) return { seq, failure: 'input is not an array' }
    try {
        return { seq, ...evaluate(resolveFunction(table, module, fnName), input) }
    } catch (thrown) {
        return { seq, failure: describeFailure(thrown) }
    }
}
