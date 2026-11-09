// Frozen reference copy for the parity module `text` (ADR-0003): the functions
// below are copied unchanged from frontend/src/services/i18n/translation-service.ts at commit f38b9e9.
// Do not edit: the application code is the reference until the module switches.

/**
 * Flattens a nested object into dot-notation key-value pairs.
 * Example: { nav: { brand: "DocMapper" } } -> { "nav.brand": "DocMapper" }
 */
export function flattenDictionary(
  nested: Record<string, any>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key of Object.keys(nested)) {
    const value = nested[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenDictionary(value, path));
    } else if (typeof value === 'string') {
      result[path] = value;
    } else if (value !== undefined && value !== null) {
      result[path] = String(value);
    }
  }

  return result;
}

/**
 * Sanitizes translated text so that trailing punctuation (;, :, ., ,) strictly matches the source string.
 * Prevents translation engines from appending unintended trailing semicolons or periods to standalone UI labels.
 */
export function sanitizePunctuation(source: string, translated: string): string {
  if (!translated) return translated;
  let clean = translated.trim();
  const trimmedSource = source.trim();

  // If source string doesn't end with punctuation mark, remove it from translated output
  const punctuationMarks = [';', ':', '.', ','];
  for (const p of punctuationMarks) {
    if (!trimmedSource.endsWith(p) && clean.endsWith(p)) {
      clean = clean.slice(0, -1).trim();
    }
  }

  return clean;
}

