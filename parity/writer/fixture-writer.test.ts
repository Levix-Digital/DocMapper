import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertCaseResult, fixturePath, modeFromEnvironment, ParityRecorder, runRecordPath } from './fixture-writer'

const double = (value: number) => ({ doubled: value * 2 })
const fail = () => {
    throw new TypeError('bad input')
}

describe('fixture writer', () => {
    let root: string
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'parity-writer-'))
    })
    afterEach(() => {
        rmSync(root, { recursive: true, force: true })
    })

    it('reads the mode from PARITY_UPDATE', () => {
        expect(modeFromEnvironment({ PARITY_UPDATE: '1' })).toBe('update')
        expect(modeFromEnvironment({})).toBe('check')
    })

    it('writes a fixture with fixed key order in update mode', () => {
        const result = new ParityRecorder('sample', root, 'update').record('double-two', 'double', double, [2])
        expect(result.status).toBe('written')
        expect(readFileSync(fixturePath(root, 'sample', 'double-two'), 'utf8')).toBe(
            '{\n  "id": "double-two",\n  "module": "sample",\n  "function": "double",\n  "input": [\n    2\n  ],\n  "output": {\n    "doubled": 4\n  }\n}\n',
        )
    })

    it('records a thrown error instead of an output', () => {
        new ParityRecorder('sample', root, 'update').record('fails', 'fail', fail, [])
        const fixture = JSON.parse(readFileSync(fixturePath(root, 'sample', 'fails'), 'utf8'))
        expect(fixture.error).toEqual({ name: 'TypeError', message: 'bad input' })
        expect('output' in fixture).toBe(false)
    })

    it('passes in check mode when the committed fixture matches', () => {
        new ParityRecorder('sample', root, 'update').record('double-two', 'double', double, [2])
        const result = new ParityRecorder('sample', root, 'check').record('double-two', 'double', double, [2])
        expect(result.status).toBe('unchanged')
        expect(() => assertCaseResult(result)).not.toThrow()
    })

    it('fails in check mode when the fixture is missing', () => {
        const result = new ParityRecorder('sample', root, 'check').record('double-two', 'double', double, [2])
        expect(result.status).toBe('missing')
        expect(() => assertCaseResult(result)).toThrow(/fixture missing/)
    })

    it('fails in check mode when the outcome differs, naming the file', () => {
        new ParityRecorder('sample', root, 'update').record('double-two', 'double', double, [2])
        const result = new ParityRecorder('sample', root, 'check').record('double-two', 'double', (v: number) => ({ doubled: v * 3 }), [2])
        expect(result.status).toBe('different')
        expect(() => assertCaseResult(result)).toThrow(/double-two\.json/)
    })

    it('never writes in check mode', () => {
        new ParityRecorder('sample', root, 'check').record('double-two', 'double', double, [2])
        expect(() => readFileSync(fixturePath(root, 'sample', 'double-two'))).toThrow()
    })

    it('rejects duplicate and invalid ids', () => {
        const recorder = new ParityRecorder('sample', root, 'update')
        recorder.record('one', 'double', double, [1])
        expect(() => recorder.record('one', 'double', double, [1])).toThrow(/duplicate/)
        expect(() => recorder.record('Bad Id', 'double', double, [1])).toThrow(/invalid case id/)
        expect(() => new ParityRecorder('Bad', root)).toThrow(/invalid module/)
    })

    it('rejects outputs JSON cannot carry exactly', () => {
        const recorder = new ParityRecorder('sample', root, 'update')
        expect(() => recorder.record('nan', 'f', () => ({ value: Number.NaN }), [])).toThrow(/\$\.output\.value/)
        expect(() => recorder.record('neg-zero', 'f', () => -0, [])).toThrow(/negative zero/)
        expect(() => recorder.record('undef', 'f', () => undefined, [])).toThrow(/undefined/)
        expect(() => recorder.record('date', 'f', () => new Date(0), [])).toThrow(/Date/)
    })

    it('writes the sorted ids of the run as the run record', () => {
        const recorder = new ParityRecorder('sample', root, 'update')
        recorder.record('b-case', 'double', double, [1])
        recorder.record('a-case', 'double', double, [2])
        recorder.writeRunRecord()
        expect(readFileSync(runRecordPath(root, 'sample'), 'utf8')).toBe('a-case\nb-case\n')
    })

    it('reports a changed committed fixture after a manual edit', () => {
        new ParityRecorder('sample', root, 'update').record('double-two', 'double', double, [2])
        writeFileSync(fixturePath(root, 'sample', 'double-two'), '{}\n')
        expect(new ParityRecorder('sample', root, 'check').record('double-two', 'double', double, [2]).status).toBe('different')
    })
})
