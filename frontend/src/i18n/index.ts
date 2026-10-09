import { ref, computed } from 'vue';
import enRaw from './locales/en.json';
import {
  flattenDictionary,
  getOrTranslateDictionary,
  getCachedTranslations,
  clearLanguageCache,
  isLanguageDownloaded,
  type TranslationProgressEvent,
} from '../services/i18n/translation-service';
import { SUPPORTED_LANGUAGES, getLanguageOption, type LanguageOption } from './languages';

const LANGUAGE_STORAGE_KEY = 'docmapper_lang';

// Flatten base English dictionary once at module load
export const flatEn: Record<string, string> = flattenDictionary(enRaw);

// Global Reactive State
const initialStoredLang = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en' : 'en';

export const currentLanguage = ref<string>(initialStoredLang);
export const currentTranslations = ref<Record<string, string>>({ ...flatEn });
export const isTranslating = ref<boolean>(false);
export const translationProgress = ref<number>(100);
export const translationStatus = ref<string>('');
export const downloadingLanguageCode = ref<string | null>(null);

// Reactive tracker for local cache changes
export const cacheVersion = ref<number>(0);

export const currentLanguageOption = computed<LanguageOption>(() => {
  return getLanguageOption(currentLanguage.value);
});

/**
 * Checks if a language pack is downloaded and stored locally.
 */
export function isDownloaded(langCode: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  cacheVersion.value; // dependency tracking
  const norm = (langCode || 'en').toLowerCase();
  if (norm === 'en') return true;
  return isLanguageDownloaded(norm);
}

/**
 * Reactive translation function `t(key, params)`
 * Supports dot notation: `t('nav.brand')`, `t('origin.pageNav', { current: 1, total: 5 })`
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let template = currentTranslations.value[key] || flatEn[key] || key;

  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return template;
}

/**
 * Downloads a language pack into local cache without necessarily switching the active language.
 */
export async function downloadLanguagePack(code: string): Promise<boolean> {
  const normCode = code.toLowerCase();
  if (normCode === 'en' || isDownloaded(normCode)) return true;

  const option = getLanguageOption(normCode);
  downloadingLanguageCode.value = normCode;
  translationProgress.value = 10;
  translationStatus.value = `Downloading ${option.nativeName}...`;

  try {
    await getOrTranslateDictionary(
      flatEn,
      normCode,
      (ev: TranslationProgressEvent) => {
        translationProgress.value = ev.percent;
        if (ev.message) {
          translationStatus.value = ev.message;
        }
      }
    );
    cacheVersion.value++;
    return true;
  } catch (err: any) {
    console.error(`[DocMapper i18n] Failed to download language ${normCode}:`, err);
    return false;
  } finally {
    downloadingLanguageCode.value = null;
    translationProgress.value = 100;
    translationStatus.value = '';
  }
}

/**
 * Changes the active application language.
 * Loads instantly (0ms) if cached, or downloads and applies if not downloaded.
 */
export async function changeLanguage(code: string): Promise<boolean> {
  const normCode = code.toLowerCase();
  const option = getLanguageOption(normCode);

  if (normCode === 'en') {
    currentLanguage.value = 'en';
    currentTranslations.value = { ...flatEn };
    isTranslating.value = false;
    downloadingLanguageCode.value = null;
    translationProgress.value = 100;
    translationStatus.value = '';
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
    return true;
  }

  // If already cached, switch instantly (0ms)
  const cached = getCachedTranslations(normCode);
  if (cached) {
    currentTranslations.value = { ...flatEn, ...cached };
    currentLanguage.value = normCode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normCode);
      document.documentElement.dir = option.dir || 'ltr';
      document.documentElement.lang = normCode;
    }
    return true;
  }

  // Not cached: download and apply
  isTranslating.value = true;
  downloadingLanguageCode.value = normCode;
  translationProgress.value = 10;
  translationStatus.value = `Downloading ${option.nativeName}...`;

  try {
    const translated = await getOrTranslateDictionary(
      flatEn,
      normCode,
      (ev: TranslationProgressEvent) => {
        translationProgress.value = ev.percent;
        if (ev.message) {
          translationStatus.value = ev.message;
        }
      }
    );

    currentTranslations.value = translated;
    currentLanguage.value = normCode;
    cacheVersion.value++;

    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normCode);
      document.documentElement.dir = option.dir || 'ltr';
      document.documentElement.lang = normCode;
    }
    return true;
  } catch (err: any) {
    console.error(`[DocMapper i18n] Error translating to ${normCode}:`, err);
    translationStatus.value = `Translation error: ${err?.message || err}`;
    return false;
  } finally {
    isTranslating.value = false;
    downloadingLanguageCode.value = null;
    translationProgress.value = 100;
  }
}

/**
 * Resets translation cache and re-downloads current language.
 */
export async function reloadCurrentLanguage(): Promise<void> {
  if (currentLanguage.value === 'en') return;
  clearLanguageCache(currentLanguage.value);
  cacheVersion.value++;
  await changeLanguage(currentLanguage.value);
}

/**
 * Deletes a cached language pack.
 */
export function removeLanguagePack(code: string): void {
  const norm = code.toLowerCase();
  if (norm === 'en') return;
  clearLanguageCache(norm);
  cacheVersion.value++;
  if (currentLanguage.value === norm) {
    changeLanguage('en');
  }
}

// Initialise if initial stored language is not English
if (typeof window !== 'undefined' && initialStoredLang !== 'en') {
  const cached = getCachedTranslations(initialStoredLang);
  if (cached) {
    currentTranslations.value = { ...flatEn, ...cached };
    const opt = getLanguageOption(initialStoredLang);
    document.documentElement.dir = opt.dir || 'ltr';
    document.documentElement.lang = initialStoredLang;
  } else {
    changeLanguage(initialStoredLang);
  }
}

/**
 * Composable for easy use inside Vue components
 */
export function useI18n() {
  return {
    t,
    currentLanguage,
    currentLanguageOption,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isTranslating,
    translationProgress,
    translationStatus,
    downloadingLanguageCode,
    isDownloaded,
    downloadLanguagePack,
    changeLanguage,
    reloadCurrentLanguage,
    removeLanguagePack,
  };
}
