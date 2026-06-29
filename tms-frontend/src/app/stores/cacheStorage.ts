export const CACHE_PREFIX = 'tos:'
export const HOME_URL = '/'

export function loadJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (_error) {
    return fallback
  }
}

export function saveJsonToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (_error) {
    // Ignore quota and privacy-mode storage failures; the UI still works in memory.
  }
}
