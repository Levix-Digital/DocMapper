// Characterization cases of the parity module `profiles` (FEAT-009): every
// branch of the frozen profile store that the Rust store reproduces and every
// edge case of specs/008-m3-profiles-storage. Each case starts from stored
// profiles, a ticking clock and scripted random values. Inputs whose key order
// or duplicate keys matter are written as JSON text.

import { describe as group, expect, it, vi } from 'vitest'
import { MODULES } from '../oracle/modules'
import { parityModule } from '../writer/vitest-parity'
import { RandomExhausted, runScenario, type Scenario } from './harness'
import * as store from './profile-store'

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0)
const BUILTIN = 'builtin-cmr-standard'

function profile(id: string, name: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        name,
        version: 1,
        createdAt: '2026-01-02T03:04:05.006Z',
        updatedAt: '2026-01-02T03:04:05.006Z',
        fields: [],
        destinationMappings: [],
        outputFileNamePattern: '{originalName}_{seq:001}',
        ...extra,
    }
}

const FULL = profile('profile-1762689600000-abcde', 'CMR Rotterdam', {
    fields: [
        {
            id: 'field-1',
            name: 'Seal Number',
            color: '#ec4899',
            anchorText: 'Plombe / Seal',
            labelBox: { x: 6.65, y: 30.7, width: 12.5, height: 0.8, page: 1 },
            valueBox: { x: 16.0, y: 36.3, width: 6.8, height: 0.6, page: 1 },
            validationPattern: '^[A-Z]{3}\\d+$',
            dataType: 'alphanumeric',
            isRequired: true,
            sampleExtractedValue: 'KSM1012290',
        },
    ],
    destinationTemplateBase64: 'JVBERi0xLjcK',
    destinationTemplateName: 'Delivery note.pdf',
    destinationMappings: [
        {
            id: 'dest-1',
            sourceType: 'field',
            fieldId: 'field-1',
            prefix: 'Seal: ',
            targetBox: { x: 29, y: 21.3, width: 25, height: 2.7, page: 1 },
            renderFormat: 'CODE128',
            fontSize: 10,
            horizontalAlign: 'center',
            verticalAlign: 'middle',
        },
        { id: 'dest-2', sourceType: 'custom', fieldId: null, customText: 'Checked', targetBox: { x: 1e-7, y: 0.1, width: 100, height: 1e21, page: 2 }, renderFormat: 'QR_CODE' },
    ],
    outputFileNamePattern: '{Seal Number}_{date}',
})

const A = profile('profile-a', 'Invoice')
const B = profile('profile-b', 'Bill of lading')
const C = profile('profile-c', 'Packing list')

type Options = { clock?: { start: number; step: number }; random?: number[] }

function scenario(stored: unknown[], args: unknown[], options: Options = {}): Scenario {
    return { stored, clock: options.clock ?? { start: NOW, step: 1 }, random: options.random ?? [0.123456789], args }
}

const dmap = (text: string) => [text]

group('profiles', () => {
    const parity = parityModule(MODULES, 'profiles')
    const run = (id: string, fn: string, s: Scenario) => parity.case(id, fn, [s])

    // createEmptyProfile
    run('create-named', 'createEmptyProfile', scenario([], ['Customs declaration']))
    run('create-default-name', 'createEmptyProfile', scenario([], []))
    run('create-empty-name', 'createEmptyProfile', scenario([], ['']))
    run('create-number-name', 'createEmptyProfile', scenario([], [42]))
    run('create-epoch-clock', 'createEmptyProfile', scenario([], ['x'], { clock: { start: 0, step: 0 } }))
    run('create-far-clock', 'createEmptyProfile', scenario([], ['x'], { clock: { start: 253402300799000, step: 7 } }))
    run('create-random-half', 'createEmptyProfile', scenario([], ['x'], { random: [0.5] }))
    run('create-random-zero', 'createEmptyProfile', scenario([], ['x'], { random: [0] }))
    run('create-random-tiny', 'createEmptyProfile', scenario([], ['x'], { random: [5e-324] }))
    run('create-random-small', 'createEmptyProfile', scenario([], ['x'], { random: [0.000001] }))
    run('create-random-largest', 'createEmptyProfile', scenario([], ['x'], { random: [0.9999999999999999] }))
    run('create-random-quarter', 'createEmptyProfile', scenario([], ['x'], { random: [0.25] }))
    run('create-does-not-store', 'createEmptyProfile', scenario([A], ['x']))

    // getAllProfiles
    run('list-empty', 'getAllProfiles', scenario([], []))
    run('list-order', 'getAllProfiles', scenario([C, A, B], []))
    run('list-full-profile', 'getAllProfiles', scenario([FULL], []))
    run('list-purges-builtin', 'getAllProfiles', scenario([A, profile(BUILTIN, 'Standard CMR (Built-in)'), B], []))
    run('list-purges-only-builtin', 'getAllProfiles', scenario([profile(BUILTIN, 'Standard CMR (Built-in)')], []))
    run('list-unknown-keys', 'getAllProfiles', scenario(JSON.parse('[{"zeta": 1, "id": "p", "name": "n", "__proto__": {"x": 1}, "2": "two"}]'), []))

    // getProfileById
    run('find-existing', 'getProfileById', scenario([A, B], ['profile-b']))
    run('find-missing', 'getProfileById', scenario([A, B], ['profile-z']))
    run('find-number-id', 'getProfileById', scenario([profile('7', 'Seven')], [7]))
    run('find-builtin-purged', 'getProfileById', scenario([profile(BUILTIN, 'Standard CMR (Built-in)')], [BUILTIN]))

    // saveProfile
    run('save-new-appends', 'saveProfile', scenario([A, B], [C]))
    run('save-existing-in-place', 'saveProfile', scenario([A, B, C], [profile('profile-b', 'Renamed bill')]))
    run('save-into-empty', 'saveProfile', scenario([], [FULL]))
    run('save-new-key-order', 'saveProfile', scenario([A], [JSON.parse('{"name": "N", "id": "profile-a", "zeta": [1, {"b": 2.5}], "fields": []}')]))
    run('save-without-updated-at', 'saveProfile', scenario([], [{ id: 'p-new', name: 'No times' }]))
    run('save-builtin-id', 'saveProfile', scenario([A], [profile(BUILTIN, 'Kept')]))
    run('save-twice-same-clock', 'saveProfile', scenario([A], [profile('profile-a', 'Again')], { clock: { start: NOW, step: 0 } }))

    // deleteProfile
    run('delete-existing', 'deleteProfile', scenario([A, B, C], ['profile-b']))
    run('delete-missing', 'deleteProfile', scenario([A, B], ['profile-z']))
    run('delete-last', 'deleteProfile', scenario([A], ['profile-a']))
    run('delete-purges-builtin', 'deleteProfile', scenario([profile(BUILTIN, 'Old'), A], ['profile-z']))

    // duplicateProfile
    run('duplicate-basic', 'duplicateProfile', scenario([A, B], ['profile-a']))
    run('duplicate-full', 'duplicateProfile', scenario([FULL], ['profile-1762689600000-abcde'], { random: [0.75] }))
    run('duplicate-missing', 'duplicateProfile', scenario([A], ['profile-z']))
    run('duplicate-copy-exists', 'duplicateProfile', scenario([A, profile('profile-x', 'Invoice (Copy)')], ['profile-a']))
    run('duplicate-copies-exist', 'duplicateProfile', scenario([A, profile('x1', 'Invoice (Copy)'), profile('x2', 'Invoice (Copy 2)'), profile('x4', 'Invoice (Copy 4)')], ['profile-a']))
    run('duplicate-case-sensitive', 'duplicateProfile', scenario([A, profile('x1', 'invoice (copy)')], ['profile-a']))
    run('duplicate-of-copy', 'duplicateProfile', scenario([profile('x1', 'Invoice (Copy)')], ['x1']))
    run('duplicate-number-name', 'duplicateProfile', scenario([profile('n', 5)], ['n']))
    run('duplicate-array-name', 'duplicateProfile', scenario([profile('n', ['a', null, 1.5])], ['n']))
    run('duplicate-object-name', 'duplicateProfile', scenario([profile('n', { label: 'x' })], ['n']))
    run('duplicate-object-name-to-string-key', 'duplicateProfile', scenario([profile('n', { toString: 'x' })], ['n']))
    run('duplicate-key-order', 'duplicateProfile', scenario(JSON.parse('[{"name": "Odd", "fields": [], "id": "o", "extra": {"k": [1, 2]}}]'), ['o']))
    run('duplicate-step-zero-clock', 'duplicateProfile', scenario([A], ['profile-a'], { clock: { start: NOW, step: 0 } }))

    // exportProfileAsDocMapper
    run('export-basic', 'exportProfileAsDocMapper', scenario([], [A]))
    run('export-full', 'exportProfileAsDocMapper', scenario([A], [FULL]))
    run('export-sanitized-name', 'exportProfileAsDocMapper', scenario([], [profile('p', 'Nota fiscal / São Paulo: 2026*')]))
    run('export-astral-name', 'exportProfileAsDocMapper', scenario([], [profile('p', 'Box 📦 ok')]))
    run('export-empty-name', 'exportProfileAsDocMapper', scenario([], [profile('p', '')]))
    run('export-escapes', 'exportProfileAsDocMapper', scenario([], [profile('p', 'q"\\\n\t\u0001\u001f\u007f /</', { note: '\b\f\r' })]))
    run('export-numbers', 'exportProfileAsDocMapper', scenario([], [JSON.parse('{"id": "p", "name": "n", "n": [16.0, 0.1, 1e21, 1e-7, 123456789012345678901, -2.5e-300, 5e-324, 1.7976931348623157e308]}')]))
    run('export-nesting', 'exportProfileAsDocMapper', scenario([], [JSON.parse('{"id": "p", "name": "n", "a": [], "o": {}, "m": [[], [{}], {"x": [true, false, null]}]}')]))
    run('export-number-name', 'exportProfileAsDocMapper', scenario([], [profile('p', 12)]))
    run('export-missing-name', 'exportProfileAsDocMapper', scenario([], [{ id: 'p' }]))
    run('export-null-name', 'exportProfileAsDocMapper', scenario([], [{ id: 'p', name: null }]))

    // importProfileFromDocMapper
    const valid = JSON.stringify({ name: 'Imported', fields: [], destinationMappings: [] })
    run('import-basic', 'importProfileFromDocMapper', scenario([A], dmap(valid)))
    run('import-full-roundtrip', 'importProfileFromDocMapper', scenario([], dmap(JSON.stringify(FULL, null, 2))))
    run('import-name-taken', 'importProfileFromDocMapper', scenario([profile('x', 'Imported')], dmap(valid)))
    run('import-name-taken-twice', 'importProfileFromDocMapper', scenario([profile('x', 'IMPORTED'), profile('y', 'imported (1)')], dmap(valid)))
    run('import-name-numbered-free', 'importProfileFromDocMapper', scenario([profile('x', 'Imported'), profile('y', 'Imported (2)')], dmap(valid)))
    run('import-unicode-case', 'importProfileFromDocMapper', scenario([profile('x', 'i̇stanbul ΟΔΟΣ')], dmap(JSON.stringify({ name: 'İSTANBUL ΟΔΟΣ', fields: [], destinationMappings: [] }))))
    run('import-final-sigma', 'importProfileFromDocMapper', scenario([profile('x', 'οδος')], dmap(JSON.stringify({ name: 'ΟΔΟΣ', fields: [], destinationMappings: [] }))))
    run('import-key-order', 'importProfileFromDocMapper', scenario([], dmap('{"zeta": 1, "fields": [], "updatedAt": "old", "name": "K", "destinationMappings": [], "id": "keep-position"}')))
    run('import-duplicate-keys', 'importProfileFromDocMapper', scenario([], dmap('{"name": "first", "fields": [], "destinationMappings": [], "name": "last", "fields": [1]}')))
    run('import-proto-and-integer-keys', 'importProfileFromDocMapper', scenario([], dmap('{"__proto__": {"a": 1}, "10": "ten", "2": "two", "name": "P", "fields": [], "destinationMappings": []}')))
    run('import-keeps-other-keys', 'importProfileFromDocMapper', scenario([], dmap('{"name": "V", "fields": [{"any": true}], "destinationMappings": ["x"], "version": "nine", "createdAt": 5}')))
    run('import-purges-builtin', 'importProfileFromDocMapper', scenario([profile(BUILTIN, 'Imported')], dmap(valid)))
    run('import-number-name-empty-store', 'importProfileFromDocMapper', scenario([], dmap('{"name": 7, "fields": [], "destinationMappings": []}')))
    run('import-number-name-with-store', 'importProfileFromDocMapper', scenario([A], dmap('{"name": 7, "fields": [], "destinationMappings": []}')))
    run('import-object-name-with-store', 'importProfileFromDocMapper', scenario([A], dmap('{"name": {"toString": "x"}, "fields": [], "destinationMappings": []}')))
    run('import-stored-number-name', 'importProfileFromDocMapper', scenario([profile('n', 5)], dmap(valid)))
    run('import-missing-name', 'importProfileFromDocMapper', scenario([], dmap('{"fields": [], "destinationMappings": []}')))
    run('import-empty-name', 'importProfileFromDocMapper', scenario([], dmap('{"name": "", "fields": [], "destinationMappings": []}')))
    run('import-zero-name', 'importProfileFromDocMapper', scenario([], dmap('{"name": 0, "fields": [], "destinationMappings": []}')))
    run('import-false-name', 'importProfileFromDocMapper', scenario([], dmap('{"name": false, "fields": [], "destinationMappings": []}')))
    run('import-null-name', 'importProfileFromDocMapper', scenario([], dmap('{"name": null, "fields": [], "destinationMappings": []}')))
    run('import-fields-not-array', 'importProfileFromDocMapper', scenario([], dmap('{"name": "x", "fields": {}, "destinationMappings": []}')))
    run('import-mappings-missing', 'importProfileFromDocMapper', scenario([], dmap('{"name": "x", "fields": []}')))
    run('import-top-level-null', 'importProfileFromDocMapper', scenario([], dmap('null')))
    run('import-top-level-number', 'importProfileFromDocMapper', scenario([], dmap('42')))
    run('import-top-level-string', 'importProfileFromDocMapper', scenario([], dmap('"name"')))
    run('import-top-level-array', 'importProfileFromDocMapper', scenario([], dmap('[{"name": "x", "fields": [], "destinationMappings": []}]')))
    run('import-top-level-true', 'importProfileFromDocMapper', scenario([], dmap('true')))
    run('import-malformed', 'importProfileFromDocMapper', scenario([], dmap('{"name": ')))
    run('import-empty-text', 'importProfileFromDocMapper', scenario([], dmap('')))
    run('import-trailing-text', 'importProfileFromDocMapper', scenario([], dmap(`${valid} x`)))
    run('import-surrounding-white-space', 'importProfileFromDocMapper', scenario([], dmap(` \n\t${valid}\r\n`)))
})

group('profiles browser-only branches (not ported, research R1)', () => {
    const empty = scenario([], [])

    it('lists nothing without a window', () => {
        const g = globalThis as { window?: unknown }
        expect(g.window).toBeUndefined()
        expect(store.getAllProfiles()).toEqual([])
        store.deleteProfile('x')
        expect(g.window).toBeUndefined()
    })

    it('resets corrupted storage with a warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const result = runScenario(empty, () => {
            localStorage.setItem('docmapper_mapping_profiles', '{not json')
            const profiles = store.getAllProfiles()
            localStorage.setItem('docmapper_mapping_profiles', '[]')
            return profiles
        })
        expect(result.returned).toEqual([])
        expect(warn).toHaveBeenCalledOnce()
        warn.mockRestore()
    })

    it('treats missing storage as no profiles', () => {
        const result = runScenario(empty, () => {
            const g = globalThis as unknown as { localStorage: { getItem: () => null; setItem: () => void } }
            g.localStorage = { getItem: () => null, setItem: () => undefined }
            return store.getAllProfiles()
        })
        expect(result.returned).toEqual([])
    })

    it('fails a scenario that runs out of random values', () => {
        expect(() => runScenario(scenario([], [], { random: [] }), store.createEmptyProfile)).toThrow(RandomExhausted)
    })

    it('restores the globals it replaced', () => {
        const g = globalThis as unknown as { window?: unknown; URL: unknown }
        const url = g.URL
        const exported = runScenario(scenario([], [A]), store.exportProfileAsDocMapper)
        expect(exported.returned).toBeNull()
        expect(g.window).toBeUndefined()
        expect(g.URL).toBe(url)
        expect(new Date(5).getTime()).toBe(5)
    })

    it('keeps the legacy aliases', () => {
        expect(store.exportProfileAsDMap).toBe(store.exportProfileAsDocMapper)
        expect(store.importProfileFromDMap).toBe(store.importProfileFromDocMapper)
    })
})
