import { ref, computed } from 'vue';
import enRaw from './locales/en.json';
import {
  flattenDictionary,
  getOrTranslateDictionary,
  getCachedTranslations,
  clearLanguageCache,
  type TranslationProgressEvent,
} from '../services/i18n/translation-service';
import { SUPPORTED_LANGUAGES, getLanguageOption, type LanguageOption } from './languages';

const LANGUAGE_STORAGE_KEY = 'docmapper_lang';

// Flatten base English dictionary once at module load
export const flatEn: Record<string, string> = flattenDictionary(enRaw);

// Global Reactive State
const storedLang = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en' : 'en';

export const currentLanguage = ref<string>(storedLang);
export const currentTranslations = ref<Record<string, string>>({ ...flatEn });
export const isTranslating = ref<boolean>(false);
export const translationProgress = ref<number>(100);
export const translationStatus = ref<string>('');
export const translationProvider = ref<'gemini' | 'fallback' | 'cache'>('cache');

export const currentLanguageOption = computed<LanguageOption>(() => {
  return getLanguageOption(currentLanguage.value);
});

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
 * Changes the active language.
 * Checks local cache first; if not present, calls AI runtime translation.
 */
export async function changeLanguage(code: string): Promise<boolean> {
  const normCode = code.toLowerCase();
  const option = getLanguageOption(normCode);

  if (normCode === 'en') {
    currentLanguage.value = 'en';
    currentTranslations.value = { ...flatEn };
    isTranslating.value = false;
    translationProgress.value = 100;
    translationStatus.value = '';
    translationProvider.value = 'cache';
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
    return true;
  }

  isTranslating.value = true;
  translationProgress.value = 10;
  translationStatus.value = `Loading ${option.nativeName}...`;

  try {
    const translated = await getOrTranslateDictionary(
      flatEn,
      normCode,
      option.name,
      (ev: TranslationProgressEvent) => {
        translationProgress.value = ev.percent;
        translationProvider.value = ev.provider;
        if (ev.message) {
          translationStatus.value = ev.message;
        }
      }
    );

    currentTranslations.value = translated;
    currentLanguage.value = normCode;
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
  }
}

/**
 * Resets translation cache and re-translates current language.
 */
export async function reloadCurrentLanguage(): Promise<void> {
  if (currentLanguage.value === 'en') return;
  clearLanguageCache(currentLanguage.value);
  await changeLanguage(currentLanguage.value);
}

// Initialise if initial stored language is not English
if (typeof window !== 'undefined' && storedLang !== 'en') {
  // Try immediate cache load for 0ms initial render
  const cached = getCachedTranslations(storedLang);
  if (cached) {
    currentTranslations.value = { ...flatEn, ...cached };
    const opt = getLanguageOption(storedLang);
    document.documentElement.dir = opt.dir || 'ltr';
    document.documentElement.lang = storedLang;
  } else {
    // Background translate
    changeLanguage(storedLang);
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
    translationProvider,
    changeLanguage,
    reloadCurrentLanguage,
  };
}
