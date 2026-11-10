import type { MappingProfile } from '../../types/mapping';
import type { ProfileService } from './profile-service';

/** Prefix of every shadow log entry. */
export const SHADOW_LOG_PREFIX = '[profiles shadow]';

/** A difference between the database store and the browser store. */
export interface ShadowDifference {
  operation: string;
  part: 'returned' | 'stored';
  path: string;
  database: unknown;
  browser: unknown;
}

/** Keys the two stores generate independently: compared by presence only. */
const GENERATED_KEYS = new Set(['id', 'createdAt', 'updatedAt']);
const GENERATED = '<generated>';

/** A profile (or list of profiles) with its generated values replaced. */
export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    result[key] = GENERATED_KEYS.has(key) ? GENERATED : inner;
  }
  return result;
}

/** The JSON path of the first difference (key order included), or null when equal. */
export function firstDifference(a: unknown, b: unknown, path = '$'): string | null {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length`;
    for (let i = 0; i < a.length; i++) {
      const inner = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (inner !== null) return inner;
    }
    return null;
  }
  const isObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    const longest = Math.max(ka.length, kb.length);
    for (let i = 0; i < longest; i++) {
      if (ka[i] !== kb[i]) return `${path}{keys}[${i}]`;
    }
    for (const key of ka) {
      const inner = firstDifference(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
      if (inner !== null) return inner;
    }
    return null;
  }
  return Object.is(a, b) || (a === 0 && b === 0) ? null : path;
}

/** The value at a path written by `firstDifference` (for the log). */
function valueAt(value: unknown, path: string): unknown {
  const steps = path.slice(1).match(/\.[^.[{]+|\[\d+\]|\{keys\}\[\d+\]|\.length/g) ?? [];
  let current: unknown = value;
  for (const step of steps) {
    if (current === null || current === undefined) return undefined;
    if (step.startsWith('{keys}')) {
      return Object.keys(current as object)[Number(step.slice(7, -1))];
    }
    if (step === '.length') return (current as unknown[]).length;
    const key = step.startsWith('[') ? Number(step.slice(1, -1)) : step.slice(1);
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/**
 * The database store, with every operation also run on the browser store and
 * the two results compared (ADR-0003 step d). The database result is what the
 * screens get; browser store failures are only logged. Ids of the two stores
 * are matched through the profiles each operation returns and by position in
 * the stored lists. Export is not compared (its text is proven byte for byte
 * by the M3 parity fixtures, and the browser export downloads a file).
 */
export function createShadowService(
  database: ProfileService,
  browser: ProfileService,
  log: (...data: unknown[]) => void = console.warn,
): ProfileService {
  /** Database id → browser id. */
  const ids = new Map<string, string>();
  const browserId = (id: string) => ids.get(id) ?? id;

  const remember = (db: MappingProfile | undefined, br: MappingProfile | undefined) => {
    if (db && br && typeof db.id === 'string' && typeof br.id === 'string') ids.set(db.id, br.id);
  };

  const report = (difference: ShadowDifference) => log(SHADOW_LOG_PREFIX, difference);

  const compare = (operation: string, part: 'returned' | 'stored', db: unknown, br: unknown) => {
    const left = normalize(db);
    const right = normalize(br);
    const path = firstDifference(left, right);
    if (path !== null) {
      report({ operation, part, path, database: valueAt(left, path), browser: valueAt(right, path) });
    }
  };

  async function shadow<T>(
    operation: string,
    result: T,
    runBrowser: () => Promise<T>,
    pair?: (db: T, br: T) => void,
  ): Promise<void> {
    try {
      const browserResult = await runBrowser();
      pair?.(result, browserResult);
      compare(operation, 'returned', result, browserResult);
      const [dbList, brList] = await Promise.all([database.getAllProfiles(), browser.getAllProfiles()]);
      dbList.forEach((p, i) => {
        if (brList[i]) ids.set(p.id, brList[i].id);
      });
      compare(operation, 'stored', dbList, brList);
    } catch (error) {
      log(SHADOW_LOG_PREFIX, { operation, browserError: String(error) });
    }
  }

  const asProfile = (value: unknown) => value as MappingProfile | undefined;

  return {
    storageKind: database.storageKind,
    async createEmptyProfile(name) {
      const result = await database.createEmptyProfile(name);
      await shadow('createEmptyProfile', result, () => browser.createEmptyProfile(name), remember);
      return result;
    },
    async getAllProfiles() {
      const result = await database.getAllProfiles();
      await shadow('getAllProfiles', result, () => browser.getAllProfiles());
      return result;
    },
    async getProfileById(id) {
      const result = await database.getProfileById(id);
      await shadow('getProfileById', result, () => browser.getProfileById(browserId(id)));
      return result;
    },
    async saveProfile(profile) {
      await database.saveProfile(profile);
      const mirrored = { ...profile, id: browserId(profile.id) };
      await shadow('saveProfile', undefined, () => browser.saveProfile(mirrored));
    },
    async deleteProfile(id) {
      const result = await database.deleteProfile(id);
      await shadow('deleteProfile', result, () => browser.deleteProfile(browserId(id)));
      return result;
    },
    async duplicateProfile(id) {
      const result = await database.duplicateProfile(id);
      await shadow('duplicateProfile', result, () => browser.duplicateProfile(browserId(id)), (db, br) =>
        remember(asProfile(db), asProfile(br)),
      );
      return result;
    },
    async importProfile(text) {
      const result = await database.importProfile(text);
      await shadow('importProfile', result, () => browser.importProfile(text), remember);
      return result;
    },
    exportProfile: profile => database.exportProfile(profile),
  };
}
