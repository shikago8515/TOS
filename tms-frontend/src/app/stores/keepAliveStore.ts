import { defineStore } from 'pinia'

import { CACHE_PREFIX, loadJsonFromStorage, saveJsonToStorage } from './cacheStorage'

const KEEP_ALIVE_STORAGE_KEY = `${CACHE_PREFIX}keepAlive`

function loadKeepAliveNames(): string[] {
  const names = loadJsonFromStorage<string[]>(KEEP_ALIVE_STORAGE_KEY, [])
  return Array.isArray(names) ? [...new Set(names.filter(Boolean))] : []
}

export const useKeepAliveStore = defineStore('keepAlive', {
  state: () => ({
    keepAliveName: loadKeepAliveNames(),
  }),
  actions: {
    persist() {
      saveJsonToStorage(KEEP_ALIVE_STORAGE_KEY, this.keepAliveName)
    },
    addKeepAliveName(name: string) {
      if (!name || this.keepAliveName.includes(name)) {
        return
      }
      this.keepAliveName.push(name)
      this.persist()
    },
    removeKeepAliveName(name: string) {
      if (!name) {
        return
      }
      this.keepAliveName = this.keepAliveName.filter((item) => item !== name)
      this.persist()
    },
    setKeepAliveName(names: string[]) {
      this.keepAliveName = [...new Set(names.filter(Boolean))]
      this.persist()
    },
  },
})
