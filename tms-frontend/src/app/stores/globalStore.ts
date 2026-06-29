import { defineStore } from 'pinia'

import { detectBrowserLanguage, normalizeKoiLanguage, type KoiLanguage } from '../../languages/language'
import { CACHE_PREFIX, loadJsonFromStorage, saveJsonToStorage } from './cacheStorage'

const GLOBAL_STORAGE_KEY = `${CACHE_PREFIX}global`
const LEGACY_LANGUAGE_STORAGE_KEY = 'tos-app-language'

export type ElementPlusDimension = 'large' | 'default' | 'small'

interface GlobalState {
  language: KoiLanguage
  isDark: boolean
  dimension: ElementPlusDimension
}

function readLegacyLanguage(): KoiLanguage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY) === 'en-US' ? 'en' : null
  } catch (_error) {
    return null
  }
}

function loadGlobalState(): GlobalState {
  const stored = loadJsonFromStorage<Partial<GlobalState>>(GLOBAL_STORAGE_KEY, {})
  return {
    language: normalizeKoiLanguage(stored.language ?? readLegacyLanguage() ?? detectBrowserLanguage()),
    isDark: stored.isDark === true,
    dimension: stored.dimension === 'large' || stored.dimension === 'small' ? stored.dimension : 'default',
  }
}

function persistLegacyLanguage(language: KoiLanguage): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, language === 'en' ? 'en-US' : 'zh-CN')
  } catch (_error) {
    // Keep the preference in Pinia memory if localStorage is unavailable.
  }
}

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => loadGlobalState(),
  actions: {
    persist() {
      saveJsonToStorage(GLOBAL_STORAGE_KEY, {
        language: this.language,
        isDark: this.isDark,
        dimension: this.dimension,
      })
      persistLegacyLanguage(this.language)
    },
    setGlobalState<Key extends keyof GlobalState>(key: Key, value: GlobalState[Key]) {
      if (key === 'language') {
        this.language = normalizeKoiLanguage(value)
      } else if (key === 'isDark') {
        this.isDark = value === true
      } else if (key === 'dimension') {
        this.dimension = value === 'large' || value === 'small' ? value : 'default'
      }
      this.persist()
    },
  },
})
