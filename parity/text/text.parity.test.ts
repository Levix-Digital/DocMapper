// Characterization cases of the parity module `text` (FEAT-005): every branch
// of the frozen copy and every edge case of specs/007-m1-text-utilities.
// Inputs that hold keys JavaScript object literals treat specially
// (`__proto__`, integer-like keys) are written as JSON text, so the case
// receives exactly what the oracle receives from Rust.

import { afterEach, describe as group, expect, it, vi } from 'vitest'
import { MODULES } from '../oracle/modules'
import { parityModule } from '../writer/vitest-parity'
import { withFixedNow } from './fixed-clock'
import { formatOutputFileName } from './filename-formatter'
import { testRegexPattern } from './validation-pattern'

const NOW = Date.UTC(2025, 10, 9, 13, 45, 0)
const LEAP_DAY = Date.UTC(2024, 1, 29, 23, 59, 59, 999)

type Options = {
    pattern?: string | null
    originalFileName: string
    extractedData: Record<string, string>
    docIndex: number
    totalDocs?: number
}

function options(pattern: string | null | undefined, extra: Partial<Options> = {}): Options {
    const base: Options = { originalFileName: 'CMR 2025-118.pdf', extractedData: {}, docIndex: 0, ...extra }
    return pattern === undefined ? base : { pattern, ...base }
}

group('text', () => {
    const parity = parityModule(MODULES, 'text')
    const name = (id: string, opts: Options, now = NOW) => parity.case(`name-${id}`, 'formatOutputFileName', [opts, now])

    // Default name
    name('no-pattern', options(undefined))
    name('null-pattern', options(null))
    name('empty-pattern', options(''))
    name('blank-pattern', options(' \t　 '))
    name('default-large-index', options(undefined, { docIndex: 1233 }))
    name('default-max-safe-index', options(undefined, { docIndex: 9007199254740990 }))
    name('default-no-extension', options(undefined, { originalFileName: 'scan' }))
    name('default-dotfile', options(undefined, { originalFileName: '.pdf' }))
    name('default-trailing-dot', options(undefined, { originalFileName: 'scan.' }))
    name('default-slash-after-dot', options(undefined, { originalFileName: 'dir.v2/scan' }))
    name('default-two-extensions', options(undefined, { originalFileName: ' report.tar.gz ' }))
    name('default-total-docs', options(undefined, { totalDocs: 12, docIndex: 11 }))
    // Tokens
    name('original-name', options('{originalName}'))
    name('original-name-any-case', options('{ORIGINALNAME}_{OriginalName}'))
    name('original-name-replacement-patterns', options('{originalName}', { originalFileName: "a$&b$$c$'d$`e$1$<n>.pdf" }))
    name('original-name-with-tokens', options('{originalName}', { originalFileName: '{seq}{index}{Ref}.pdf', extractedData: { Ref: 'R1' } }))
    name('seq-default', options('doc-{seq}', { docIndex: 6 }))
    name('seq-zero-width', options('doc-{seq:00000}', { docIndex: 6 }))
    name('seq-plain-width', options('doc-{SEQ:5}', { docIndex: 6 }))
    name('seq-width-one', options('doc-{seq:1}', { docIndex: 41 }))
    name('seq-width-zero', options('doc-{seq:0}', { docIndex: 41 }))
    name('seq-malformed', options('{seq:}{seq:x}{seq:12x}{seq :3}', { docIndex: 6 }))
    name('seq-width-too-large', options('{seq:99999999999}'))
    name('seq-name-over-limit-after-extension', options('{seq:536870888}'))
    name('seq-names-over-limit-together', options('{seq:300000000}{seq:300000000}'))
    name('seq-width-infinite', options(`{seq:${'9'.repeat(400)}}`))
    name('index', options('{index}-{INDEX}', { docIndex: 99 }))
    name('date', options('{date}_{Date}'))
    name('date-leap-day', options('{date}'), LEAP_DAY)
    name('date-epoch', options('{date}'), 0)
    name('field-exact', options('{Invoice No}', { extractedData: { 'Invoice No': ' INV-7 ' } }))
    name('field-trimmed-token', options('{  Invoice No\t}', { extractedData: { 'Invoice No': 'INV-7' } }))
    name('field-any-case', options('{invoice no}', { extractedData: { 'Invoice No': 'INV-7' } }))
    name('field-blank-exact-then-any-case', options('{ref}', { extractedData: { ref: '  ', REF: 'R9' } }))
    name('field-blank-any-case', options('x{REF}y', { extractedData: { ref: ' ' } }))
    name('field-missing', options('x{nothing}y'))
    name('field-empty-key', options('x{ }y', { extractedData: JSON.parse('{"": "v"}') }))
    name('field-integer-keys-order', options('{a}', { extractedData: JSON.parse('{"A": "upper", "1": "one", "a ": "x"}') }))
    name('field-unicode-case', options('{İD}-{ΟΔΟΣ}', { extractedData: { 'i̇d': 'dotted', 'οδος': 'road' } }))
    name('field-nested-braces', options('{a{b}c{}', { extractedData: { 'a{b': 'v' } }))
    name('field-unclosed', options('a{b'))
    name('field-value-with-token', options('{A}', { extractedData: { A: '{B}', B: 'b' } }))
    name('field-inherited-member', options('{toString}'))
    name('field-inherited-proto', options('{ __proto__ }'))
    name('field-own-inherited-name', options('{constructor}', { extractedData: JSON.parse('{"constructor": "own"}') }))
    name('field-own-proto', options('{__proto__}', { extractedData: JSON.parse('{"__proto__": "own"}') }))
    // Sanitizing and extension
    name('illegal-characters', options('a\\b/c:d*e?f"g<h>i|j'))
    name('whitespace-runs', options('a \t\n ﻿ b c'))
    name('non-ecmascript-whitespace', options('a\u0085b᠎c'))
    name('edges-stripped', options(' _._a_b._ . '))
    name('only-edges', options('._ _.'))
    name('sanitizes-to-nothing', options('{missing}', { originalFileName: 'scan.pdf', docIndex: 2 }))
    name('pdf-kept', options('Final.PDF'))
    name('pdf-added', options('final.pdf.bak'))
    name('pdf-unicode-lower', options('ẞ.PDF'))

    // Validation pattern
    const pattern = (id: string, regex: string, candidate: string) => parity.case(`pattern-${id}`, 'testRegexPattern', [regex, candidate])
    pattern('match', '^\\d{3}-\\d{2}$', '123-45')
    pattern('no-match', '^\\d{3}$', '1234')
    pattern('anywhere', '\\d', 'abc1')
    pattern('empty', '', '')
    pattern('astral-dot', '^.$', '😀')
    pattern('astral-two-units', '^..$', '😀')
    pattern('whitespace', '^\\s+$', ' ﻿ ')
    pattern('not-whitespace', '^\\s$', '\u0085')
    pattern('legacy-braces', 'a{', 'a{')
    pattern('legacy-bracket', ']', ']')
    pattern('legacy-octal', '\\01', '\u0001')
    pattern('legacy-unicode-brace', '^\\u{3}$', 'uuu')
    pattern('legacy-p', '\\p{L}', 'p{L}')
    pattern('lookbehind', '(?<=R)\\d+', 'R12')
    pattern('named-group', '(?<y>\\d{4})-\\k<y>', '2025-2025')
    pattern('invalid-group', '(', '(')
    pattern('invalid-quantifier', 'a**', 'a')
    pattern('invalid-range', '[b-a]', 'a')
    pattern('invalid-named-reference', '(?<a>x)\\k<b>', 'x')
    // Found by differential fuzzing
    pattern('quantified-boundary', '\\b*', '')
    pattern('quantified-boundary-braces', 'a|\\B{2,}', 'a')
    pattern('boundary-literal-brace', '\\b{,2}', '{,2}')
    pattern('repeated-group-name', '(?<a>x)|(?<a>y)', 'x')
    pattern('astral-alternation', '😀|(a)', '😀')
    pattern('astral-class', '^[😀]$', '😀')
    pattern('escaped-surrogates', '^\\uD83D\\uDE00$', '😀')
    pattern('backslash-c-literal', '^\\c\\u*$', '\\cuu')
    pattern('modifier-group', '(?i:a)', 'A')
    pattern('group-name-braced-escape', '(?<\\u{62}>x)\\k<b>', 'xx')
    pattern('group-reference-escape', '(?<a>x)\\k<\\u0061>', 'xx')
    pattern('group-name-astral', '(?<𝒜>x)', 'x')
    pattern('group-name-escaped-pair', '(?<\\ud835\\udc9c>x)', 'x')
    pattern('group-name-lone-surrogate', '(?<\\ud835>x)', 'x')
    pattern('repeated-group-name-escaped', '(?<a>x)|(?<\\u0061>y)', 'x')
    pattern('reference-without-groups', '^\\k<\\u{2}>$', 'k<uu>')
    pattern('backslash-c-class-digit', '^[\\c1]$', '\u0011')

    // Dictionary flattening
    const flat = (id: string, json: string, prefix?: string) =>
        parity.case(`flatten-${id}`, 'flattenDictionary', prefix === undefined ? [JSON.parse(json)] : [JSON.parse(json), prefix])
    flat('nested', '{"nav": {"brand": "DocMapper", "menu": {"open": "Open"}}, "title": "T"}')
    flat('empty', '{}')
    flat('prefix', '{"a": "x", "b": {"c": "y"}}', 'root')
    flat('empty-prefix', '{"a": "x"}', '')
    flat('leaves', '{"s": "", "z": 0, "n": null, "f": false, "t": true, "x": 1e21, "y": 0.1, "w": -1e-7, "big": 12345678901234567890}')
    flat('arrays', '{"a": [1, [null, 3], "x", {"k": 1}, true], "e": [], "o": {}}')
    flat('key-order', '{"b": "1", "10": "2", "2": "3", "02": "4", "4294967295": "5", "4294967294": "6"}')
    flat('proto-top', '{"__proto__": "dropped", "a": "kept"}')
    flat('proto-nested', '{"a": {"__proto__": "kept"}, "__proto__": {"b": "kept"}}')
    flat('overwrite', '{"a.b": "first", "c": "c", "a": {"b": "second"}}')
    flat('empty-keys', '{"": {"": "x", "y": "z"}}')
    flat('object-with-to-string-in-array', '{"a": {"b": [1, {"toString": "x"}]}}')

    // Punctuation
    const punct = (id: string, source: string, translated: string) => parity.case(`punctuation-${id}`, 'sanitizePunctuation', [source, translated])
    punct('removed', 'Name', 'Nome:')
    punct('kept', 'Name:', 'Nome:')
    punct('each-mark-once', 'Name', 'Nome,.:;')
    punct('reverse-order', 'Name', 'Nome;:.,')
    punct('trimmed-between', 'Name', ' Nome . ; ')
    punct('source-trimmed', 'Name; ', 'Nome;')
    punct('empty', 'Name', '')
    punct('blank', 'Name', '﻿ ')
    punct('only-mark', 'x', ';')
})

// Fallbacks no input can reach: `parseInt` of a width that does not start
// with 0 is never 0 or NaN, and `new RegExp` always throws a SyntaxError
// with a message. They are covered with stubs (no fixtures, since the Rust
// port has no way to reach them either) so branch coverage stays at 100%.
group('text fallbacks without a reachable input', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses width 3 when parseInt gives no number', () => {
        vi.stubGlobal('parseInt', () => Number.NaN)
        expect(formatOutputFileName({ pattern: '{seq:7}', originalFileName: 'a', extractedData: {}, docIndex: 0 })).toBe('001.pdf')
    })

    it('uses a fixed message when the thrown error has none', () => {
        vi.stubGlobal('RegExp', function () {
            throw null
        })
        expect(testRegexPattern('a', 'a')).toEqual({ matches: false, error: 'Invalid regular expression syntax' })
    })
})

group('fixed clock', () => {
    it('fixes only the date with no argument and restores Date', () => {
        const RealDate = Date
        withFixedNow(0, () => {
            expect(new Date().toISOString()).toBe('1970-01-01T00:00:00.000Z')
            expect(Date.now()).toBe(0)
            expect(new Date(86_400_000).toISOString()).toBe('1970-01-02T00:00:00.000Z')
        })
        expect(Date).toBe(RealDate)
        expect(() => withFixedNow(0, () => { throw new Error('inside') })).toThrow('inside')
        expect(Date).toBe(RealDate)
    })
})
