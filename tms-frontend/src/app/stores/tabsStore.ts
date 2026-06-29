import { defineStore } from 'pinia'

import { CACHE_PREFIX, HOME_URL, loadJsonFromStorage, saveJsonToStorage } from './cacheStorage'
import { useKeepAliveStore } from './keepAliveStore'

const TABS_STORAGE_KEY = `${CACHE_PREFIX}tabs`

export type RouteCacheFlag = '0' | '1'

export interface RouteTab {
  icon?: string
  title: string
  path: string
  name: string
  isKeepAlive: RouteCacheFlag
  isAffix: RouteCacheFlag
}

function isRouteTab(value: unknown): value is RouteTab {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<RouteTab>
  return Boolean(item.title && item.path && item.name)
}

function normalizeTab(tab: RouteTab): RouteTab {
  return {
    ...tab,
    isAffix: tab.path === HOME_URL ? '1' : tab.isAffix,
    isKeepAlive: tab.isKeepAlive ?? '1',
  }
}

function loadTabs(): RouteTab[] {
  const tabs = loadJsonFromStorage<RouteTab[]>(TABS_STORAGE_KEY, [])
  return Array.isArray(tabs) ? tabs.filter(isRouteTab).map(normalizeTab) : []
}

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabList: loadTabs(),
  }),
  actions: {
    persist() {
      saveJsonToStorage(TABS_STORAGE_KEY, this.tabList)
    },
    rebuildKeepAlive() {
      const keepAliveStore = useKeepAliveStore()
      keepAliveStore.setKeepAliveName(
        this.tabList
          .filter((tab) => tab.isKeepAlive === '1')
          .map((tab) => tab.name),
      )
    },
    ensureHomeTab(tab: RouteTab) {
      const homeTab = normalizeTab({ ...tab, path: HOME_URL, isAffix: '1' })
      const existingIndex = this.tabList.findIndex((item) => item.path === HOME_URL)

      if (existingIndex >= 0) {
        this.tabList[existingIndex] = {
          ...this.tabList[existingIndex],
          ...homeTab,
          isAffix: '1',
        }
        if (existingIndex > 0) {
          const [existingHome] = this.tabList.splice(existingIndex, 1)
          this.tabList.unshift(existingHome)
        }
      } else {
        this.tabList.unshift(homeTab)
      }

      const keepAliveStore = useKeepAliveStore()
      if (homeTab.isKeepAlive === '1') {
        keepAliveStore.addKeepAliveName(homeTab.name)
      }
      this.persist()
    },
    addTab(tab: RouteTab) {
      const nextTab = normalizeTab(tab)
      const keepAliveStore = useKeepAliveStore()

      if (nextTab.isKeepAlive === '1') {
        keepAliveStore.addKeepAliveName(nextTab.name)
      }

      const existingIndex = this.tabList.findIndex((item) => item.path === nextTab.path)
      if (existingIndex >= 0) {
        this.tabList[existingIndex] = {
          ...this.tabList[existingIndex],
          ...nextTab,
        }
        this.persist()
        return
      }

      if (nextTab.path === HOME_URL) {
        this.ensureHomeTab(nextTab)
        return
      }

      this.tabList.push(nextTab)
      this.persist()
    },
    removeTab(tabPath: string, selectedPath: string): string {
      if (tabPath === HOME_URL) {
        return selectedPath
      }

      const targetIndex = this.tabList.findIndex((tab) => tab.path === tabPath)
      const targetTab = this.tabList[targetIndex]
      if (targetIndex < 0 || !targetTab || targetTab.isAffix === '1') {
        return selectedPath
      }

      const keepAliveStore = useKeepAliveStore()
      if (targetTab.isKeepAlive === '1') {
        keepAliveStore.removeKeepAliveName(targetTab.name)
      }

      this.tabList.splice(targetIndex, 1)
      this.persist()

      if (selectedPath !== tabPath) {
        return selectedPath
      }

      return this.tabList[targetIndex]?.path ?? this.tabList[targetIndex - 1]?.path ?? HOME_URL
    },
    closeSideTabs(path: string, side: 'left' | 'right') {
      const targetIndex = this.tabList.findIndex((tab) => tab.path === path)
      if (targetIndex < 0) {
        return
      }

      this.tabList = this.tabList.filter((tab, index) => {
        if (tab.isAffix === '1') {
          return true
        }
        return side === 'left' ? index >= targetIndex : index <= targetIndex
      })
      this.rebuildKeepAlive()
      this.persist()
    },
    closeManyTabs(tabPath?: string) {
      this.tabList = this.tabList.filter((tab) => tab.isAffix === '1' || Boolean(tabPath && tab.path === tabPath))
      this.rebuildKeepAlive()
      this.persist()
    },
    replaceIsAffix(tabPath: string, isAffix: RouteCacheFlag) {
      if (tabPath === HOME_URL) {
        return
      }

      const targetTab = this.tabList.find((tab) => tab.path === tabPath)
      if (!targetTab) {
        return
      }

      targetTab.isAffix = isAffix
      this.persist()
    },
    setTabTitle(title: string, tabPath: string) {
      const targetTab = this.tabList.find((tab) => tab.path === tabPath)
      if (!targetTab) {
        return
      }
      targetTab.title = title
      this.persist()
    },
  },
})
