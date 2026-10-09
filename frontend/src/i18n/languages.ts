export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
  googleCode?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', googleCode: 'en' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷', googleCode: 'pt' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)', flag: '🇵🇹', googleCode: 'pt-pt' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', googleCode: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', googleCode: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', googleCode: 'de' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', googleCode: 'it' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', googleCode: 'zh-CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', googleCode: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', googleCode: 'ko' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', googleCode: 'ru' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl', googleCode: 'ar' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', googleCode: 'hi' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', googleCode: 'nl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', googleCode: 'pl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', googleCode: 'tr' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', googleCode: 'sv' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', googleCode: 'da' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', googleCode: 'fi' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', googleCode: 'no' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', googleCode: 'cs' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', googleCode: 'el' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', dir: 'rtl', googleCode: 'iw' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', googleCode: 'id' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', googleCode: 'th' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', googleCode: 'vi' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', googleCode: 'uk' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', googleCode: 'ro' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', googleCode: 'hu' },
];

export function getLanguageOption(code: string): LanguageOption {
  const norm = (code || 'en').toLowerCase();
  if (norm === 'pt') {
    return SUPPORTED_LANGUAGES.find(l => l.code === 'pt-BR')!;
  }
  return (
    SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === norm) || {
      code,
      name: code.toUpperCase(),
      nativeName: code.toUpperCase(),
      flag: '🌐',
      googleCode: code.toLowerCase(),
    }
  );
}
