// Frozen reference copy of frontend/src/services/mapping/profile-store.ts at
// 60a4b51 for the parity module `profiles` (M3). Unchanged except: the unused
// built-in CMR profile factory and its template import are removed (not ported,
// see specs/008-m3-profiles-storage/research.md R1), and the types come from the
// copy of mapping.ts next to it. Do not edit.

import type { MappingProfile } from './mapping';

const STORAGE_KEY = 'docmapper_mapping_profiles';

export const BUILTIN_CMR_PROFILE_ID = 'builtin-cmr-standard';

/**
 * Creates a brand new, 100% empty profile for fresh setup in Mapping Studio.
 */
export function createEmptyProfile(name: string = 'Untitled Profile'): MappingProfile {
  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [],
    destinationMappings: [],
    outputFileNamePattern: '{originalName}_{seq:001}',
  };
}

/**
 * Retrieves all stored profiles from localStorage without auto-seeding defaults.
 * Purges legacy built-in defaults if found so the workspace remains completely clean.
 */
export function getAllProfiles(): MappingProfile[] {
  if (typeof window === 'undefined') return [];

  let raw = localStorage.getItem(STORAGE_KEY);
  let profiles: MappingProfile[] = [];

  if (raw) {
    try {
      profiles = JSON.parse(raw);
    } catch (e) {
      console.warn('Corrupted mapping profiles in localStorage, resetting:', e);
      profiles = [];
    }
  }

  // Purge legacy auto-seeded builtin profile to guarantee 100% clean state
  if (profiles.some(p => p.id === BUILTIN_CMR_PROFILE_ID)) {
    profiles = profiles.filter(p => p.id !== BUILTIN_CMR_PROFILE_ID);
    saveAllProfiles(profiles);
  }

  return profiles;
}

/**
 * Saves the entire list of profiles into localStorage.
 */
function saveAllProfiles(profiles: MappingProfile[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }
}

/**
 * Finds a profile by ID.
 */
export function getProfileById(id: string): MappingProfile | undefined {
  const profiles = getAllProfiles();
  return profiles.find(p => p.id === id);
}

/**
 * Saves or updates a mapping profile in local storage.
 */
export function saveProfile(profile: MappingProfile): void {
  const profiles = getAllProfiles();
  const index = profiles.findIndex(p => p.id === profile.id);

  const updated: MappingProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    profiles[index] = updated;
  } else {
    profiles.push(updated);
  }

  saveAllProfiles(profiles);
}

/**
 * Deletes a profile by ID.
 */
export function deleteProfile(id: string): boolean {
  const profiles = getAllProfiles().filter(p => p.id !== id);
  saveAllProfiles(profiles);
  return true;
}

/**
 * Duplicates an existing profile with an incremented copy name.
 */
export function duplicateProfile(id: string): MappingProfile | undefined {
  const source = getProfileById(id);
  if (!source) return undefined;

  const profiles = getAllProfiles();
  let baseName = `${source.name} (Copy)`;
  let counter = 1;
  while (profiles.some(p => p.name === baseName)) {
    counter++;
    baseName = `${source.name} (Copy ${counter})`;
  }

  const clone: MappingProfile = {
    ...JSON.parse(JSON.stringify(source)),
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: baseName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProfile(clone);
  return clone;
}

/**
 * Exports a mapping profile as a downloadable `.dmap` self-contained JSON file.
 */
export function exportProfileAsDocMapper(profile: MappingProfile): void {
  const serialized = JSON.stringify(profile, null, 2);
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const sanitizedName = profile.name.replace(/[^a-zA-Z0-9_\-]/g, '_');

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizedName}.dmap`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// Aliases
export const exportProfileAsDMap = exportProfileAsDocMapper;

/**
 * Imports a profile from a `.dmap`, legacy `.docmapper` JSON string with collision-safe naming.
 */
export function importProfileFromDocMapper(jsonContent: string): MappingProfile {
  const parsed = JSON.parse(jsonContent);

  if (!parsed.name || !Array.isArray(parsed.fields) || !Array.isArray(parsed.destinationMappings)) {
    throw new Error('Invalid .dmap file format: Missing name, fields, or destinationMappings.');
  }

  const profiles = getAllProfiles();
  let uniqueName = parsed.name;
  let counter = 1;

  while (profiles.some(p => p.name.toLowerCase() === uniqueName.toLowerCase())) {
    uniqueName = `${parsed.name} (${counter})`;
    counter++;
  }

  const importedProfile: MappingProfile = {
    ...parsed,
    id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: uniqueName,
    updatedAt: new Date().toISOString(),
  };

  saveProfile(importedProfile);
  return importedProfile;
}

// Backwards compatibility alias
export const importProfileFromDMap = importProfileFromDocMapper;
