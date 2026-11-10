import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHADOW_SETTING_KEY,
  chooseProfileService,
  createBrowserService,
  createDesktopService,
  shadowSettingOn,
  toError,
  type Invoke,
} from './profile-service';
import { stubBrowserStorage } from './test-storage';
import type { MappingProfile } from '../../types/mapping';

const profile = { id: 'p1', name: 'A', fields: [], destinationMappings: [] } as unknown as MappingProfile;

function recordingInvoke(results: Record<string, unknown>) {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const invoke = (async (command: string, args?: Record<string, unknown>) => {
    calls.push([command, args]);
    const result = results[command];
    if (result instanceof Error) throw (result as Error & { payload: unknown }).payload;
    return result;
  }) as Invoke;
  return { invoke, calls };
}

function failing(payload: unknown) {
  return Object.assign(new Error('rejected'), { payload });
}

describe('desktop backend', () => {
  it('calls one command per operation with its arguments', async () => {
    const { invoke, calls } = recordingInvoke({
      profiles_create_empty: profile,
      profiles_list: [profile],
      profiles_get: null,
      profiles_save: null,
      profiles_delete: true,
      profiles_duplicate: profile,
      profiles_import: profile,
      profiles_export: '/tmp/A.dmap',
    });
    const service = createDesktopService(invoke);
    expect(service.storageKind).toBe('database');
    expect(await service.createEmptyProfile()).toBe(profile);
    expect(await service.createEmptyProfile('Named')).toBe(profile);
    expect(await service.getAllProfiles()).toEqual([profile]);
    expect(await service.getProfileById('x')).toBeUndefined();
    await service.saveProfile(profile);
    expect(await service.deleteProfile('p1')).toBe(true);
    expect(await service.duplicateProfile('p1')).toBe(profile);
    expect(await service.importProfile('{}')).toBe(profile);
    expect(await service.exportProfile(profile)).toBe(true);
    expect(calls).toEqual([
      ['profiles_create_empty', {}],
      ['profiles_create_empty', { name: 'Named' }],
      ['profiles_list', undefined],
      ['profiles_get', { id: 'x' }],
      ['profiles_save', { profile }],
      ['profiles_delete', { id: 'p1' }],
      ['profiles_duplicate', { id: 'p1' }],
      ['profiles_import', { text: '{}' }],
      ['profiles_export', { profile }],
    ]);
  });

  it('reports a cancelled export and a missing duplicate', async () => {
    const { invoke } = recordingInvoke({ profiles_export: null, profiles_duplicate: null });
    const service = createDesktopService(invoke);
    expect(await service.exportProfile(profile)).toBe(false);
    expect(await service.duplicateProfile('x')).toBeUndefined();
  });

  it('turns command errors into named errors', async () => {
    const { invoke } = recordingInvoke({
      profiles_import: failing({ kind: 'syntax', message: 'not a valid .dmap file: x' }),
    });
    const error = await createDesktopService(invoke).importProfile('{').catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SyntaxError');
    expect(error.message).toBe('not a valid .dmap file: x');
  });
});

describe('toError', () => {
  it.each([
    ['invalid_file', 'Error'],
    ['syntax', 'SyntaxError'],
    ['type', 'TypeError'],
    ['range', 'RangeError'],
    ['database', 'DatabaseError'],
    ['file', 'FileError'],
    ['unknown', 'Error'],
  ])('names kind %s %s', (kind, name) => {
    expect(toError({ kind, message: 'm' }).name).toBe(name);
  });

  it('keeps errors and wraps other values', () => {
    const error = new TypeError('t');
    expect(toError(error)).toBe(error);
    expect(toError('text').message).toBe('text');
    expect(toError({ kind: 1 }).message).toBe('[object Object]');
  });
});

describe('browser backend', () => {
  beforeEach(() => {
    stubBrowserStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the browser store', async () => {
    const service = createBrowserService();
    expect(service.storageKind).toBe('browser');
    const created = await service.createEmptyProfile('New');
    expect(created.name).toBe('New');
    await service.saveProfile(created);
    expect((await service.getAllProfiles()).map(p => p.name)).toEqual(['New']);
    expect((await service.getProfileById(created.id))?.name).toBe('New');
    const copy = await service.duplicateProfile(created.id);
    expect(copy?.name).toBe('New (Copy)');
    const imported = await service.importProfile(
      JSON.stringify({ name: 'new', fields: [], destinationMappings: [] }),
    );
    expect(imported.name).toBe('new (1)');
    expect(await service.deleteProfile(created.id)).toBe(true);
    expect((await service.getAllProfiles()).map(p => p.name)).toEqual(['New (Copy)', 'new (1)']);
  });

  it('exports through the browser download', async () => {
    const click = vi.fn();
    const anchor = { click, href: '', download: '' };
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    expect(await createBrowserService().exportProfile({ ...profile, name: 'A b' })).toBe(true);
    expect(anchor.download).toBe('A_b.dmap');
    expect(click).toHaveBeenCalled();
  });
});

describe('backend choice', () => {
  it('uses the browser store outside the desktop app', () => {
    expect(chooseProfileService({ desktop: false, shadow: true }).storageKind).toBe('browser');
  });

  it('uses the database in the desktop app, with or without the shadow', async () => {
    const { invoke, calls } = recordingInvoke({ profiles_list: [] });
    expect(chooseProfileService({ desktop: true, shadow: false, invoke }).storageKind).toBe('database');
    stubBrowserStorage();
    const shadowed = chooseProfileService({ desktop: true, shadow: true, invoke, log: vi.fn() });
    expect(shadowed.storageKind).toBe('database');
    await shadowed.getAllProfiles();
    expect(calls.map(c => c[0])).toContain('profiles_list');
    vi.unstubAllGlobals();
  });

  it('reads the shadow setting', () => {
    const storage = (value: string | null) => ({ getItem: (key: string) => (key === SHADOW_SETTING_KEY ? value : null) });
    expect(shadowSettingOn(storage('1'))).toBe(true);
    expect(shadowSettingOn(storage('0'))).toBe(false);
    expect(shadowSettingOn(undefined)).toBe(false);
    expect(
      shadowSettingOn({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(false);
  });
});
