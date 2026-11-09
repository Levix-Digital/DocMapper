import { describe, expect, it } from 'vitest'
import { handleRequest } from './handler'
import { MODULES } from './modules'

const ask = (request: unknown) => handleRequest(JSON.stringify(request), MODULES)

describe('oracle request handling', () => {
    it('returns the output of the function', () => {
        expect(ask({ seq: 1, module: 'harness', function: 'measure', input: ['ab'] })).toEqual({
            seq: 1,
            output: { length: 2, upper: 'AB' },
        })
    })

    it('returns the error the function throws', () => {
        expect(ask({ seq: 2, module: 'harness', function: 'measure', input: [''] })).toEqual({
            seq: 2,
            error: { name: 'RangeError', message: 'text is empty' },
        })
    })

    it('fails for unknown modules and functions', () => {
        expect(ask({ seq: 3, module: 'nope', function: 'x', input: [] })).toEqual({ seq: 3, failure: "unknown module 'nope'" })
        expect(ask({ seq: 4, module: 'harness', function: 'toString', input: [] })).toEqual({
            seq: 4,
            failure: "unknown function 'toString' in module 'harness'",
        })
    })

    it('fails for malformed requests', () => {
        expect(handleRequest('not json', MODULES)).toMatchObject({ seq: null })
        expect(ask([1])).toEqual({ seq: null, failure: 'request is not an object' })
        expect(ask({ module: 'harness' })).toEqual({ seq: null, failure: 'seq is not an integer' })
        expect(ask({ seq: 5, module: 'harness', function: 'measure', input: 'ab' })).toEqual({ seq: 5, failure: 'input is not an array' })
    })

    it('fails when the output cannot be written as JSON exactly', () => {
        const table = { sample: { overflow: (value: number) => value * Number.MAX_VALUE } }
        const response = handleRequest(JSON.stringify({ seq: 6, module: 'sample', function: 'overflow', input: [10] }), table)
        expect(response).toEqual({ seq: 6, failure: 'value at $.output cannot be written as JSON exactly: non-finite number Infinity' })
    })
})
