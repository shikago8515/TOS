export type KoiLanguage = 'zh' | 'en'
export type AppLanguageCode = 'zh-CN' | 'en-US'

export function normalizeKoiLanguage(value: unknown): KoiLanguage {
  if (value === 'en' || value === 'en-US') {
    return 'en'
  }
  return 'zh'
}

export function appLanguageToKoiLanguage(language: AppLanguageCode): KoiLanguage {
  return language === 'en-US' ? 'en' : 'zh'
}

export function koiLanguageToAppLanguage(language: KoiLanguage): AppLanguageCode {
  return language === 'en' ? 'en-US' : 'zh-CN'
}

export function detectBrowserLanguage(): KoiLanguage {
  if (typeof navigator === 'undefined') {
    return 'zh'
  }

  const language = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
  if (language.startsWith('zh')) {
    return 'zh'
  }
  if (language.startsWith('en')) {
    return 'en'
  }
  return 'en'
}

