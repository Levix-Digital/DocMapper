import { getStoredApiKey, getStoredModel } from '../llm/gemini-service';

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
 * Retrieves cached translation dictionary from localStorage if available.
 */
export function getCachedTranslations(langCode: string): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${langCode.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[DocMapper i18n] Failed to read cache for ${langCode}:`, err);
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
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${langCode.toLowerCase()}`,
      JSON.stringify(translations)
    );
  } catch (err) {
    console.warn(`[DocMapper i18n] Failed to persist cache for ${langCode}:`, err);
  }
}

/**
 * Clears the translation cache for a specific language or all languages.
 */
export function clearLanguageCache(langCode?: string): void {
  if (typeof window === 'undefined') return;
  if (langCode) {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${langCode.toLowerCase()}`);
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }
}

/**
 * Translates a batch of key-value pairs using Google Gemini.
 */
async function translateBatchWithGemini(
  batch: Record<string, string>,
  targetLangCode: string,
  targetLangName: string,
  apiKey: string
): Promise<Record<string, string>> {
  const modelsToTry = [getStoredModel(), 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
  const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));

  const prompt = `You are an expert localization engineer and translator for a modern enterprise document processing and PDF mapping web application.
Translate the following English UI strings into ${targetLangName} (language code: "${targetLangCode}").

Rules:
1. Translate accurately and professionally for a technical software interface.
2. DO NOT translate or modify any curly bracket placeholders like {name}, {current}, {total}, {page}, {count}. Keep them verbatim.
3. Keep product names like "DocMapper" and technical file extensions like ".docmapper", ".dmap", ".pdf" intact.
4. Return strictly a valid, raw JSON object matching the exact keys provided in the input, with translated strings as values.

Input JSON:
${JSON.stringify(batch, null, 2)}`;

  let lastError = '';

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        lastError = errorJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      return parsed as Record<string, string>;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  throw new Error(`Gemini translation failed: ${lastError}`);
}

/**
 * Fallback translation using free public endpoint with placeholder preservation.
 */
async function translateSingleWithFallback(
  text: string,
  targetLangCode: string
): Promise<string> {
  // If text contains placeholders, extract them to restore after translation
  const placeholders: string[] = [];
  const tokenized = text.replace(/\{[a-zA-Z0-9_-]+\}/g, match => {
    placeholders.push(match);
    return `___PLH_${placeholders.length - 1}___`;
  });

  try {
    // Attempt MyMemory API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tokenized)}&langpair=en|${encodeURIComponent(targetLangCode)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      let translated = data?.responseData?.translatedText;
      if (translated && typeof translated === 'string') {
        // Restore placeholders
        placeholders.forEach((plh, idx) => {
          translated = translated.replace(new RegExp(`___PLH_${idx}___`, 'gi'), plh);
        });
        return translated;
      }
    }
  } catch {
    // Ignore and fallback
  }

  return text;
}

/**
 * Translates a dictionary using parallel fallback execution when Gemini is unavailable.
 */
async function translateBatchWithFallback(
  batch: Record<string, string>,
  targetLangCode: string,
  onBatchProgress?: (completed: number, total: number) => void
): Promise<Record<string, string>> {
  const entries = Object.entries(batch);
  const total = entries.length;
  const results: Record<string, string> = {};
  let completed = 0;

  // Run in chunks of 5 concurrently to respect rate limits
  const concurrency = 5;
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ([key, value]) => {
        try {
          const translated = await translateSingleWithFallback(value, targetLangCode);
          results[key] = translated || value;
        } catch {
          results[key] = value;
        } finally {
          completed++;
          if (onBatchProgress) onBatchProgress(completed, total);
        }
      })
    );
  }

  return results;
}

/**
 * Splits an object of key-value pairs into smaller chunks of given size.
 */
function chunkObject(
  obj: Record<string, string>,
  chunkSize: number
): Record<string, string>[] {
  const entries = Object.entries(obj);
  const chunks: Record<string, string>[] = [];

  for (let i = 0; i < entries.length; i += chunkSize) {
    const slice = entries.slice(i, i + chunkSize);
    const chunk: Record<string, string> = {};
    for (const [k, v] of slice) {
      chunk[k] = v;
    }
    chunks.push(chunk);
  }

  return chunks;
}

export interface TranslationProgressEvent {
  percent: number;
  message?: string;
  provider: 'gemini' | 'fallback' | 'cache';
}

/**
 * Main translation orchestrator.
 * 1. Checks localStorage cache.
 * 2. If all keys present, returns immediately (0ms).
 * 3. If missing keys exist, translates missing keys in parallel:
 *    - Uses Google Gemini if API key is configured.
 *    - Automatically falls back to free public translation if API key is absent or fails.
 * 4. Merges into cached dictionary and persists to localStorage.
 */
export async function getOrTranslateDictionary(
  baseEnFlat: Record<string, string>,
  targetLangCode: string,
  targetLangName: string,
  onProgress?: (event: TranslationProgressEvent) => void
): Promise<Record<string, string>> {
  const normCode = targetLangCode.toLowerCase();

  // English needs 0 translation
  if (normCode === 'en') {
    onProgress?.({ percent: 100, provider: 'cache' });
    return { ...baseEnFlat };
  }

  // Check cache
  const cached = getCachedTranslations(normCode) || {};
  const missingKeys: Record<string, string> = {};

  for (const [key, value] of Object.entries(baseEnFlat)) {
    if (!cached[key]) {
      missingKeys[key] = value;
    }
  }

  const missingCount = Object.keys(missingKeys).length;

  // Fully cached!
  if (missingCount === 0) {
    onProgress?.({ percent: 100, provider: 'cache', message: 'Loaded from cache' });
    return cached;
  }

  onProgress?.({ percent: 10, provider: 'gemini', message: 'Translating...' });

  const apiKey = getStoredApiKey();
  const newlyTranslated: Record<string, string> = {};

  if (apiKey) {
    try {
      // Split missing keys into chunks of 40 keys for fast parallel execution
      const chunks = chunkObject(missingKeys, 40);
      let completedChunks = 0;

      const chunkPromises = chunks.map(async chunk => {
        const res = await translateBatchWithGemini(chunk, normCode, targetLangName, apiKey);
        completedChunks++;
        const pct = Math.min(95, Math.round(15 + (completedChunks / chunks.length) * 80));
        onProgress?.({
          percent: pct,
          provider: 'gemini',
          message: `Translated batch ${completedChunks}/${chunks.length}`,
        });
        return res;
      });

      const batchResults = await Promise.all(chunkPromises);
      for (const batch of batchResults) {
        Object.assign(newlyTranslated, batch);
      }
    } catch (err: any) {
      console.warn('[DocMapper i18n] Gemini translation failed, attempting fallback...', err);
      // Fallback
      onProgress?.({ percent: 30, provider: 'fallback', message: 'Using fallback translation...' });
      const fallbackResult = await translateBatchWithFallback(
        missingKeys,
        normCode,
        (comp, tot) => {
          const pct = Math.min(95, Math.round(30 + (comp / tot) * 65));
          onProgress?.({ percent: pct, provider: 'fallback' });
        }
      );
      Object.assign(newlyTranslated, fallbackResult);
    }
  } else {
    // No Gemini key - use free fallback directly
    onProgress?.({ percent: 15, provider: 'fallback', message: 'Translating with free service...' });
    const fallbackResult = await translateBatchWithFallback(
      missingKeys,
      normCode,
      (comp, tot) => {
        const pct = Math.min(95, Math.round(15 + (comp / tot) * 80));
        onProgress?.({ percent: pct, provider: 'fallback' });
      }
    );
    Object.assign(newlyTranslated, fallbackResult);
  }

  // Merge newly translated into cached dictionary
  const merged: Record<string, string> = {
    ...baseEnFlat, // Fallback to EN if any key couldn't be translated
    ...cached,
    ...newlyTranslated,
  };

  saveCachedTranslations(normCode, merged);
  onProgress?.({ percent: 100, provider: apiKey ? 'gemini' : 'fallback', message: 'Complete' });

  return merged;
}
