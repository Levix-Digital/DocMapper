import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import type { MappingProfile } from '../../types/mapping';
import * as browserStore from './profile-store';
import { createShadowService } from './profile-shadow';

/**
 * The interface's single entry to profile operations (FEAT-050). The desktop
 * app keeps profiles in the local database through the Rust profile store
 * (desktop commands); the browser build keeps them in the browser storage.
 */
export interface ProfileService {
  /** Where profiles are kept. */
  readonly storageKind: 'database' | 'browser';
  createEmptyProfile(name?: string): Promise<MappingProfile>;
  getAllProfiles(): Promise<MappingProfile[]>;
  getProfileById(id: string): Promise<MappingProfile | undefined>;
  saveProfile(profile: MappingProfile): Promise<void>;
  deleteProfile(id: string): Promise<boolean>;
  duplicateProfile(id: string): Promise<MappingProfile | undefined>;
  importProfile(text: string): Promise<MappingProfile>;
  /** Saves the profile as a `.dmap` file; false when the user cancelled. */
  exportProfile(profile: MappingProfile): Promise<boolean>;
}

/** Calls a desktop command (`invoke` of Tauri; replaced in tests). */
export type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** An error of a desktop command, as the shell sends it. */
interface CommandError {
  kind: string;
  message: string;
}

/** JavaScript error names of the desktop command error kinds. */
const ERROR_NAMES: Record<string, string> = {
  invalid_file: 'Error',
  syntax: 'SyntaxError',
  type: 'TypeError',
  range: 'RangeError',
  database: 'DatabaseError',
  file: 'FileError',
};

function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CommandError).kind === 'string' &&
    typeof (value as CommandError).message === 'string'
  );
}

/** Turns a rejected command into an `Error` named after its kind. */
export function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (isCommandError(reason)) {
    const error = new Error(reason.message);
    error.name = ERROR_NAMES[reason.kind] ?? 'Error';
    return error;
  }
  return new Error(String(reason));
}

/** The desktop backend: the Rust profile store over the local database. */
export function createDesktopService(invoke: Invoke = tauriInvoke): ProfileService {
  const call = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    try {
      return await invoke<T>(command, args);
    } catch (reason) {
      throw toError(reason);
    }
  };
  return {
    storageKind: 'database',
    createEmptyProfile: name =>
      call<MappingProfile>('profiles_create_empty', name === undefined ? {} : { name }),
    getAllProfiles: () => call<MappingProfile[]>('profiles_list'),
    getProfileById: async id =>
      (await call<MappingProfile | null>('profiles_get', { id })) ?? undefined,
    saveProfile: profile => call<void>('profiles_save', { profile }),
    deleteProfile: id => call<boolean>('profiles_delete', { id }),
    duplicateProfile: async id =>
      (await call<MappingProfile | null>('profiles_duplicate', { id })) ?? undefined,
    importProfile: text => call<MappingProfile>('profiles_import', { text }),
    exportProfile: async profile =>
      (await call<string | null>('profiles_export', { profile })) !== null,
  };
}

/** The browser backend: the browser store (`profile-store.ts`), kept until the browser build is removed. */
export function createBrowserService(): ProfileService {
  return {
    storageKind: 'browser',
    createEmptyProfile: async name => browserStore.createEmptyProfile(name),
    getAllProfiles: async () => browserStore.getAllProfiles(),
    getProfileById: async id => browserStore.getProfileById(id),
    saveProfile: async profile => browserStore.saveProfile(profile),
    deleteProfile: async id => browserStore.deleteProfile(id),
    duplicateProfile: async id => browserStore.duplicateProfile(id),
    importProfile: async text => browserStore.importProfileFromDocMapper(text),
    exportProfile: async profile => {
      browserStore.exportProfileAsDocMapper(profile);
      return true;
    },
  };
}

/** Developer setting (window storage) that turns the shadow comparison on. */
export const SHADOW_SETTING_KEY = 'docmapper_profile_shadow';

/** Reads the shadow setting; false when the storage cannot be read. */
export function shadowSettingOn(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(SHADOW_SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Chooses the backend once: the desktop commands in the desktop app (with the
 * shadow comparison when the developer setting is on), the browser store in
 * the browser build.
 */
export function chooseProfileService(options: {
  desktop: boolean;
  shadow: boolean;
  invoke?: Invoke;
  log?: (...data: unknown[]) => void;
}): ProfileService {
  if (!options.desktop) return createBrowserService();
  const desktop = createDesktopService(options.invoke);
  return options.shadow ? createShadowService(desktop, createBrowserService(), options.log) : desktop;
}

export const profileService: ProfileService = chooseProfileService({
  desktop: isTauri(),
  shadow: shadowSettingOn(typeof localStorage === 'undefined' ? undefined : localStorage),
});
