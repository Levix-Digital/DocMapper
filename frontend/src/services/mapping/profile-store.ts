import type { MappingProfile, FieldDefinition, DestinationFieldMapping } from '../../types/mapping';
import { SHIPMENT_DOC_TEMPLATE_BASE64 } from '../pdf/assets';

const STORAGE_KEY = 'docmapper_mapping_profiles';

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
      anchorText: 'Shipment:',
      labelBox: { x: 6.76, y: 36.43, width: 3.78, height: 0.6, page: 1 },
      valueBox: { x: 16.0, y: 36.30, width: 6.8, height: 0.6, page: 1 },
      validationPattern: '',
      dataType: 'alphanumeric',
      isRequired: true,
      sampleExtractedValue: '015-TSO-S10000430442',
    },
    {
      id: 'field-consignments',
      name: 'Consignment Number',
      color: '#10b981', // Emerald
      anchorText: 'Consignments:',
      labelBox: { x: 6.76, y: 37.55, width: 5.6, height: 0.6, page: 1 },
      valueBox: { x: 16.0, y: 37.50, width: 6.8, height: 0.6, page: 1 },
      validationPattern: '',
      dataType: 'alphanumeric',
      isRequired: false,
      sampleExtractedValue: '23422-SUP-ECIS8459',
    },
    {
      id: 'field-transport-id',
      name: 'Transport ID / Trailer',
      color: '#f59e0b', // Amber
      anchorText: 'Trailer',
      labelBox: { x: 4.49, y: 88.0, width: 3.5, height: 1.0, page: 1 },
      valueBox: { x: 9.0, y: 85.5, width: 15.0, height: 2.2, page: 1 },
      validationPattern: '',
      dataType: 'text',
      isRequired: false,
      sampleExtractedValue: 'EMHU200739',
    },
    {
      id: 'field-seal',
      name: 'Seal Number',
      color: '#ec4899', // Pink
      anchorText: 'Plombe / Seal / Plomb',
      labelBox: { x: 6.65, y: 30.7, width: 12.5, height: 0.8, page: 1 },
      valueBox: { x: 20.0, y: 30.5, width: 10.0, height: 0.6, page: 1 },
      validationPattern: '',
      dataType: 'alphanumeric',
      isRequired: false,
      sampleExtractedValue: 'KSM1012290',
    },
  ];

  const destinationMappings: DestinationFieldMapping[] = [
    {
      id: 'dest-shipment-barcode',
      fieldId: 'field-shipment',
      targetBox: { x: 16.0, y: 13.3, width: 68.8, height: 20.2, page: 3 },
      renderFormat: 'CODE128',
    },
    {
      id: 'dest-shipment-text',
      fieldId: 'field-shipment',
      targetBox: { x: 29.0, y: 14.0, width: 25.0, height: 2.7, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 11,
    },
    {
      id: 'dest-consignment-text',
      fieldId: 'field-consignments',
      targetBox: { x: 29.0, y: 16.4, width: 55.0, height: 2.7, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 10,
    },
    {
      id: 'dest-transport-text',
      fieldId: 'field-transport-id',
      targetBox: { x: 29.0, y: 18.9, width: 25.0, height: 2.7, page: 1 },
      renderFormat: 'TEXT',
      fontSize: 10,
    },
    {
      id: 'dest-seal-text',
      fieldId: 'field-seal',
      targetBox: { x: 29.0, y: 21.3, width: 25.0, height: 2.7, page: 1 },
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

  // Ensure built-in CMR profile exists and is updated to calibrated version if it had legacy fake coordinates
  const builtinIndex = profiles.findIndex(p => p.id === BUILTIN_CMR_PROFILE_ID);
  if (builtinIndex === -1) {
    const builtin = createBuiltinCmrProfile();
    profiles.unshift(builtin);
    saveAllProfiles(profiles);
  } else {
    // If the built-in profile in localStorage has old mock or uncalibrated coordinates, update it
    const existing = profiles[builtinIndex];
    const shipmentField = existing.fields.find(f => f.id === 'field-shipment');
    if (shipmentField && (!shipmentField.valueBox || shipmentField.valueBox.y < 10 || shipmentField.valueBox.width > 10 || !shipmentField.anchorText)) {
      profiles[builtinIndex] = createBuiltinCmrProfile();
      saveAllProfiles(profiles);
    }
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
