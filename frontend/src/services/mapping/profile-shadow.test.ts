import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserService, type ProfileService } from './profile-service';
import { SHADOW_LOG_PREFIX, createShadowService, firstDifference, normalize } from './profile-shadow';
import { stubBrowserStorage } from './test-storage';
import type { MappingProfile } from '../../types/mapping';

const FILE = JSON.stringify({ name: 'Invoice', fields: [{ id: 'f', x: 12.5 }], destinationMappings: [] });

describe('normalize', () => {
  it('replaces generated values and keeps the rest and the key order', () => {
    expect(normalize([{ name: 'A', id: 'x', createdAt: 't', updatedAt: 'u', n: 1 }])).toEqual([
      { name: 'A', id: '<generated>', createdAt: '<generated>', updatedAt: '<generated>', n: 1 },
    ]);
    expect(Object.keys(normalize({ b: 1, id: 2, a: 3 }) as object)).toEqual(['b', 'id', 'a']);
    expect(normalize(null)).toBeNull();
    expect(normalize(true)).toBe(true);
  });
});

describe('firstDifference', () => {
  it('finds no difference in equal values', () => {
    expect(firstDifference({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBeNull();
    expect(firstDifference(0, -0)).toBeNull();
    expect(firstDifference(NaN, NaN)).toBeNull();
  });

  it('gives the path of the first difference', () => {
    expect(firstDifference([1, 2], [1])).toBe('$.length');
    expect(firstDifference([{ a: 1 }], [{ a: 2 }])).toBe('$[0].a');
    expect(firstDifference({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe('${keys}[0]');
    expect(firstDifference({ a: 1 }, { a: 1, b: 2 })).toBe('${keys}[1]');
    expect(firstDifference({ a: 1 }, [1])).toBe('$');
    expect(firstDifference('x', 'y')).toBe('$');
  });
});

/** A database store stand-in: the browser store on its own storage. */
function separateStore(): ProfileService {
  const own = new Map<string, string>();
  const run = <T>(f: () => T): T => {
    const shared = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => own.get(k) ?? null,
      setItem: (k: string, v: string) => void own.set(k, String(v)),
    });
    try {
      return f();
    } finally {
      vi.stubGlobal('localStorage', shared);
    }
  };
  const browser = createBrowserService();
  return {
    storageKind: 'database',
    createEmptyProfile: async name => run(() => browser.createEmptyProfile(name)),
    getAllProfiles: async () => run(() => browser.getAllProfiles()),
    getProfileById: async id => run(() => browser.getProfileById(id)),
    saveProfile: async p => run(() => browser.saveProfile(p)),
    deleteProfile: async id => run(() => browser.deleteProfile(id)),
    duplicateProfile: async id => run(() => browser.duplicateProfile(id)),
    importProfile: async text => run(() => browser.importProfile(text)),
    exportProfile: vi.fn(async () => null),
  };
}

describe('shadow service', () => {
  let log: ReturnType<typeof vi.fn<(...data: unknown[]) => void>>;
  let browserItems: Map<string, string>;

  beforeEach(() => {
    browserItems = stubBrowserStorage();
    log = vi.fn<(...data: unknown[]) => void>();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs nothing when both stores agree on every operation', async () => {
    const database = separateStore();
    const service = createShadowService(database, createBrowserService(), log);
    expect(service.storageKind).toBe('database');

    const created = await service.createEmptyProfile('New');
    created.fields = [{ id: 'f' } as MappingProfile['fields'][number]];
    await service.saveProfile(created);
    const imported = await service.importProfile(FILE);
    const copy = await service.duplicateProfile(imported.id);
    expect(copy?.name).toBe('Invoice (Copy)');
    expect((await service.getProfileById(imported.id))?.name).toBe('Invoice');
    expect(await service.deleteProfile(created.id)).toBe(true);
    const listed = await service.getAllProfiles();
    expect(listed.map(p => p.name)).toEqual(['Invoice', 'Invoice (Copy)']);

    expect(log).not.toHaveBeenCalled();
  });

  it('returns the database result and logs a planted difference with its path', async () => {
    const database = separateStore();
    const service = createShadowService(database, createBrowserService(), log);
    await service.importProfile(FILE);

    const stored = JSON.parse(browserItems.get('docmapper_mapping_profiles') ?? '[]');
    stored[0].fields[0].x = 99;
    browserItems.set('docmapper_mapping_profiles', JSON.stringify(stored));

    const listed = await service.getAllProfiles();
    expect(listed[0].fields[0]).toEqual({ id: 'f', x: 12.5 });
    expect(log).toHaveBeenCalledWith(SHADOW_LOG_PREFIX, {
      operation: 'getAllProfiles',
      part: 'returned',
      path: '$[0].fields[0].x',
      database: 12.5,
      browser: 99,
    });
  });

  it('never changes a browser profile it did not pair with a database profile', async () => {
    browserItems.set(
      'docmapper_mapping_profiles',
      JSON.stringify([{ id: 'legacy', name: 'Legacy', fields: [], destinationMappings: [] }]),
    );
    const database = separateStore();
    await database.importProfile(FILE);
    const [stored] = await database.getAllProfiles();
    const service = createShadowService(database, createBrowserService(), log);
    await service.getAllProfiles();
    await service.deleteProfile(stored.id);
    const browserProfiles = JSON.parse(browserItems.get('docmapper_mapping_profiles') ?? '[]');
    expect(browserProfiles.map((p: MappingProfile) => p.id)).toEqual(['legacy']);
    expect(log).toHaveBeenCalled();
  });

  it('labels database failures of the stored comparison', async () => {
    const database = separateStore();
    const service = createShadowService(database, createBrowserService(), log);
    database.getAllProfiles = async () => {
      throw new Error('db down');
    };
    await service.importProfile(FILE);
    expect(log).toHaveBeenCalledWith(SHADOW_LOG_PREFIX, {
      operation: 'importProfile',
      databaseError: 'Error: db down',
    });
  });

  it('logs browser store failures without throwing them', async () => {
    const browser = createBrowserService();
    browser.importProfile = async () => {
      throw new Error('browser failed');
    };
    const service = createShadowService(separateStore(), browser, log);
    const imported = await service.importProfile(FILE);
    expect(imported.name).toBe('Invoice');
    expect(log).toHaveBeenCalledWith(SHADOW_LOG_PREFIX, {
      operation: 'importProfile',
      browserError: 'Error: browser failed',
    });
  });

  it('exports through the database store only', async () => {
    const database = separateStore();
    const service = createShadowService(database, createBrowserService(), log);
    expect(await service.exportProfile({ name: 'A' } as MappingProfile)).toBeNull();
    expect(database.exportProfile).toHaveBeenCalled();
  });

  it('logs to the console by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const browser = createBrowserService();
    browser.getAllProfiles = async () => {
      throw new Error('x');
    };
    await createShadowService(separateStore(), browser).getAllProfiles();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
