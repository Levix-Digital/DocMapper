import { getLanguageOption } from '../../i18n/languages';

const CACHE_KEY_PREFIX = 'docmapper_i18n_cache_';

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
 * Checks whether a language pack is already downloaded and cached locally.
 */
export function isLanguageDownloaded(langCode: string): boolean {
  const norm = (langCode || 'en').toLowerCase();
  if (norm === 'en') return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${norm}`);
    return Boolean(raw && raw.length > 10);
  } catch {
    return false;
  }
}

/**
 * Retrieves cached translation dictionary from localStorage if available.
 */
export function getCachedTranslations(langCode: string): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  const norm = (langCode || 'en').toLowerCase();
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${norm}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[DocMapper i18n] Failed to read cache for ${norm}:`, err);
    return null;
  }
}

/**
 * Persists translated dictionary into localStorage.
 */
export function saveCachedTranslations(
  langCode: string,
  translations: Record<string, string>
): void {
  if (typeof window === 'undefined') return;
  const norm = (langCode || 'en').toLowerCase();
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${norm}`,
      JSON.stringify(translations)
    );
  } catch (err) {
    console.warn(`[DocMapper i18n] Failed to persist cache for ${norm}:`, err);
  }
}

/**
 * Clears the translation cache for a specific language or all languages.
 */
export function clearLanguageCache(langCode?: string): void {
  if (typeof window === 'undefined') return;
  if (langCode) {
    const norm = langCode.toLowerCase();
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${norm}`);
  } else {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }
}

/**
 * Translates a single text string with Google Translate, preserving curly bracket placeholders.
 */
async function translateSingleWithGoogle(
  text: string,
  googleLang: string
): Promise<string> {
  if (!text || text.trim() === '') return text;

  // Preserve placeholders like {count}, {name}, {page}
  const placeholders: string[] = [];
  const tokenized = text.replace(/\{[a-zA-Z0-9_-]+\}/g, match => {
    placeholders.push(match);
    return `~${placeholders.length - 1}~`;
  });

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(googleLang)}&dt=t&q=${encodeURIComponent(tokenized)}`;
    const res = await fetch(url);
    if (!res.ok) return text;

    const data = await res.json();
    let translated = (data[0] || []).map((part: any) => part[0]).join('');

    // Restore placeholders
    placeholders.forEach((plh, idx) => {
      translated = translated.replace(new RegExp(`~\\s*${idx}\\s*~`, 'gi'), plh);
    });

    return translated || text;
  } catch (err) {
    console.warn(`[DocMapper Google Translate] Error translating "${text}":`, err);
    return text;
  }
}

/**
 * Translates a batch of strings with Google Translate using a delimiter.
 * Falls back to parallel single translations if delimiter gets altered.
 */
async function translateBatchWithGoogle(
  items: { key: string; value: string }[],
  googleLang: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (items.length === 0) return result;

  const DELIMITER = '\n§§§\n';

  // Extract all placeholders across the batch
  const placeholders: string[] = [];
  const tokenizedItems = items.map(item => {
    return item.value.replace(/\{[a-zA-Z0-9_-]+\}/g, match => {
      placeholders.push(match);
      return `~${placeholders.length - 1}~`;
    });
  });

  const payload = tokenizedItems.join(DELIMITER);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(googleLang)}&dt=t&q=${encodeURIComponent(payload)}`;
    const res = await fetch(url);

    if (res.ok) {
      const data = await res.json();
      let fullText = (data[0] || []).map((part: any) => part[0]).join('');

      // Restore placeholders
      placeholders.forEach((plh, idx) => {
        fullText = fullText.replace(new RegExp(`~\\s*${idx}\\s*~`, 'gi'), plh);
      });

      // Split on delimiter
      const parts = fullText.split(/\s*§§§\s*/);

      if (parts.length === items.length) {
        items.forEach((item, idx) => {
          result[item.key] = parts[idx]?.trim() || item.value;
        });
        return result;
      }
    }
  } catch (err) {
    console.warn('[DocMapper i18n] Batch delimiter failed, falling back to parallel single items:', err);
  }

  // Fallback: translate individual items concurrently
  await Promise.all(
    items.map(async item => {
      const translated = await translateSingleWithGoogle(item.value, googleLang);
      result[item.key] = translated;
    })
  );

  return result;
}

export interface TranslationProgressEvent {
  percent: number;
  message?: string;
  provider: 'google' | 'cache';
}

/**
 * Main translation orchestrator using Google Translate.
 * 1. Checks localStorage cache first for 0ms load.
 * 2. If any missing keys exist, translates missing keys in parallel batches.
 * 3. Restores placeholders and persists into localStorage.
 */
export async function getOrTranslateDictionary(
  baseEnFlat: Record<string, string>,
  targetLangCode: string,
  onProgress?: (event: TranslationProgressEvent) => void
): Promise<Record<string, string>> {
  const normCode = (targetLangCode || 'en').toLowerCase();

  // English requires no translation
  if (normCode === 'en') {
    onProgress?.({ percent: 100, provider: 'cache', message: 'English (Base)' });
    return { ...baseEnFlat };
  }

  // Read existing cache
  const cached = getCachedTranslations(normCode) || {};
  const missingEntries: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(baseEnFlat)) {
    if (!cached[key]) {
      missingEntries.push({ key, value });
    }
  }

  // Fully cached!
  if (missingEntries.length === 0) {
    onProgress?.({ percent: 100, provider: 'cache', message: 'Loaded from cache' });
    return cached;
  }

  const option = getLanguageOption(normCode);
  const googleLang = option.googleCode || normCode;

  onProgress?.({ percent: 10, provider: 'google', message: `Downloading ${option.nativeName}...` });

  // Batch missing entries into chunks of 15 strings for fast parallel execution
  const CHUNK_SIZE = 15;
  const chunks: { key: string; value: string }[][] = [];
  for (let i = 0; i < missingEntries.length; i += CHUNK_SIZE) {
    chunks.push(missingEntries.slice(i, i + CHUNK_SIZE));
  }

  const newlyTranslated: Record<string, string> = {};
  let completedChunks = 0;

  const chunkPromises = chunks.map(async chunk => {
    const chunkResult = await translateBatchWithGoogle(chunk, googleLang);
    completedChunks++;
    const pct = Math.min(95, Math.round(15 + (completedChunks / chunks.length) * 80));
    onProgress?.({
      percent: pct,
      provider: 'google',
      message: `Translating (${completedChunks}/${chunks.length})...`,
    });
    return chunkResult;
  });

  const allChunkResults = await Promise.all(chunkPromises);
  for (const res of allChunkResults) {
    Object.assign(newlyTranslated, res);
  }

  // Merge newly translated into cached dictionary
  const merged: Record<string, string> = {
    ...baseEnFlat, // Fallback to EN if any key couldn't be reached
    ...cached,
    ...newlyTranslated,
  };

  saveCachedTranslations(normCode, merged);
  onProgress?.({ percent: 100, provider: 'google', message: 'Download complete' });

  return merged;
}
