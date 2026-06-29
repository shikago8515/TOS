import { createI18n } from 'vue-i18n'

import { detectBrowserLanguage, normalizeKoiLanguage, type KoiLanguage } from './language'
import en from './modules/en'
import zh from './modules/zh'

export const i18n = createI18n({
  legacy: false,
  allowComposition: true,
  locale: detectBrowserLanguage(),
  fallbackLocale: 'en',
  messages: {
    zh,
    en,
  },
})

export function setI18nLanguage(language: KoiLanguage): void {
  i18n.global.locale.value = normalizeKoiLanguage(language)
}

