import type { MappingProfile, FieldDefinition, DestinationFieldMapping } from '../../types/mapping';
import { SHIPMENT_DOC_TEMPLATE_BASE64 } from '../pdf/assets';

const STORAGE_KEY = 'copyx_mapping_profiles';

export const BUILTIN_CMR_PROFILE_ID = 'builtin-cmr-standard';

/**
 * Built-in default CMR profile matching the original standard delivery note layout.
 */
export function createBuiltinCmrProfile(): MappingProfile {
  const fields: FieldDefinition[] = [
    {
      id: 'field-shipment',
      name: 'Shipment Number',
      color: '#6366f1', // Indigo
      labelBox: { x: 58.0, y: 3.0, width: 20.0, height: 3.0, page: 1 },
      valueBox: { x: 78.0, y: 3.0, width: 20.0, height: 3.5, page: 1 },
      validationPattern: '^[0-9A-Za-z\\-_/]+$',
      dataType: 'alphanumeric',
      isRequired: true,
      sampleExtractedValue: '015-TSO-1234',
    },
    {
      id: 'field-consignments',
      name: 'Consignment Number',
      color: '#10b981', // Emerald
      labelBox: { x: 5.0, y: 15.0, width: 20.0, height: 3.0, page: 1 },
      valueBox: { x: 25.0, y: 15.0, width: 30.0, height: 3.5, page: 1 },
      validationPattern: '^[0-9A-Za-z\\-_/]+$',
      dataType: 'alphanumeric',
      isRequired: false,
      sampleExtractedValue: 'CN-98765',
    },
    {
      id: 'field-transport-id',
      name: 'Transport ID / Trailer',
      color: '#f59e0b', // Amber
      labelBox: { x: 5.0, y: 25.0, width: 20.0, height: 3.0, page: 1 },
      valueBox: { x: 25.0, y: 25.0, width: 30.0, height: 3.5, page: 1 },
      validationPattern: '.+',
      dataType: 'text',
      isRequired: false,
      sampleExtractedValue: 'TR-456-XYZ',
    },
    {
      id: 'field-seal',
      name: 'Seal Number',
      color: '#ec4899', // Pink
      labelBox: { x: 5.0, y: 35.0, width: 20.0, height: 3.0, page: 1 },
      valueBox: { x: 25.0, y: 35.0, width: 30.0, height: 3.5, page: 1 },
      validationPattern: '^[0-9A-Za-z\\-_]+$',
      dataType: 'alphanumeric',
      isRequired: false,
      sampleExtractedValue: 'SL-7890',
    },
  ];

  const destinationMappings: DestinationFieldMapping[] = [
    {
      id: 'dest-shipment-barcode',
      fieldId: 'field-shipment',
      targetBox: { x: 55.0, y: 8.0, width: 40.0, height: 7.0, page: 1 },
      renderFormat: 'CODE128',
    },
    {
      id: 'dest-shipment-text',
      fieldId: 'field-shipment',
      targetBox: { x: 15.0, y: 8.0, width: 35.0, height: 4.0, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 12,
    },
    {
      id: 'dest-consignment-text',
      fieldId: 'field-consignments',
      targetBox: { x: 15.0, y: 15.0, width: 35.0, height: 4.0, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 10,
    },
    {
      id: 'dest-transport-text',
      fieldId: 'field-transport-id',
      targetBox: { x: 15.0, y: 22.0, width: 35.0, height: 4.0, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 10,
    },
    {
      id: 'dest-seal-text',
      fieldId: 'field-seal',
      targetBox: { x: 15.0, y: 29.0, width: 35.0, height: 4.0, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 10,
    },
  ];

  return {
    id: BUILTIN_CMR_PROFILE_ID,
    name: 'Standard CMR (Built-in)',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields,
    destinationTemplateBase64: SHIPMENT_DOC_TEMPLATE_BASE64,
    destinationTemplateName: 'Standard_CMR_Delivery_Note.pdf',
    destinationMappings,
  };
}

/**
 * Retrieves all stored profiles from localStorage, auto-seeding built-in CMR profile if missing.
 */
export function getAllProfiles(): MappingProfile[] {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  let profiles: MappingProfile[] = [];

  if (raw) {
    try {
      profiles = JSON.parse(raw);
    } catch (e) {
      console.warn('Corrupted mapping profiles in localStorage, resetting:', e);
      profiles = [];
    }
  }

  // Ensure built-in CMR profile exists
  const hasBuiltin = profiles.some(p => p.id === BUILTIN_CMR_PROFILE_ID);
  if (!hasBuiltin) {
    const builtin = createBuiltinCmrProfile();
    profiles.unshift(builtin);
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
 * Deletes a profile by ID. Built-in profile cannot be deleted (returns false).
 */
export function deleteProfile(id: string): boolean {
  if (id === BUILTIN_CMR_PROFILE_ID) {
    return false; // Prevent removing built-in default
  }

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
 * Exports a mapping profile as a downloadable `.copyx` self-contained JSON file.
 */
export function exportProfileAsCopyx(profile: MappingProfile): void {
  const serialized = JSON.stringify(profile, null, 2);
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const sanitizedName = profile.name.replace(/[^a-zA-Z0-9_\-]/g, '_');

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizedName}.copyx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Imports a profile from a `.copyx` JSON string with collision-safe naming.
 */
export function importProfileFromCopyx(jsonContent: string): MappingProfile {
  const parsed = JSON.parse(jsonContent);

  if (!parsed.name || !Array.isArray(parsed.fields) || !Array.isArray(parsed.destinationMappings)) {
    throw new Error('Invalid .copyx file format: Missing name, fields, or destinationMappings.');
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
