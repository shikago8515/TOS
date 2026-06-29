<template>
  <div class="layout-tabs-bar layout-tabs layout-tabs--google" @contextmenu.prevent>
    <KoiScrollNav
      ref="scrollNavRef"
      height="42px"
      :active-selector="activeSelector"
      :prev-aria-label="i18nT('tabs.scrollLeft')"
      :next-aria-label="i18nT('tabs.scrollRight')"
    >
      <button
        v-for="(tab, index) in tabsStore.tabList"
        :key="tab.path"
        class="layout-tabs-bar__item"
        :class="{ 'is-active': tab.path === route.fullPath, 'is-affix': tab.isAffix === '1' }"
        type="button"
        role="tab"
        :aria-selected="tab.path === route.fullPath"
        :title="getTabDisplayTitle(tab)"
        :data-tab-index="index"
        :data-tab-path="tab.path"
        @click="openTab(tab.path)"
        @contextmenu.prevent.stop="openContextMenu($event, tab.path)"
      >
        <ElIcon class="layout-tabs-bar__icon">
          <component :is="resolveTabIcon(tab)" />
        </ElIcon>
        <span class="layout-tabs-bar__title">{{ getTabDisplayTitle(tab) }}</span>
        <ElIcon v-if="tab.isAffix === '1'" class="layout-tabs-bar__affix">
          <StarFilled />
        </ElIcon>
        <button
          v-else
          class="layout-tabs-bar__close"
          type="button"
          :aria-label="i18nT('tabs.close', { title: getTabDisplayTitle(tab) })"
          @click.stop="closeTab(tab)"
        >
          <ElIcon><Close /></ElIcon>
        </button>
      </button>
    </KoiScrollNav>

    <Teleport to="body">
      <transition name="layout-tabs-menu">
        <div
          v-if="contextMenu.visible"
          class="layout-tabs-context-menu"
          :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
          role="menu"
          @click.stop
        >
          <button
            v-for="item in contextMenuItems"
            :key="item.key"
            class="layout-tabs-context-menu__item"
            type="button"
            role="menuitem"
            @click="runContextAction(item.key)"
          >
            <ElIcon>
              <component :is="item.icon" />
            </ElIcon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import {
  Back,
  CircleClose,
  Close,
  Document,
  Files,
  FolderDelete,
  House,
  Lock,
  Operation,
  Refresh,
  Right,
  Setting,
  StarFilled,
  Unlock,
} from '@element-plus/icons-vue'

import { HOME_URL } from '../app/stores/cacheStorage'
import { type RouteTab, useTabsStore } from '../app/stores/tabsStore'
import { getLocalizedModuleTitle, tosModules } from '../domain/moduleCatalog'
import { getMenuLanguage } from '../languages/menuLanguage'
import { useAppLanguage } from '../shared/i18n/appLanguage'
import KoiScrollNav from './KoiScrollNav.vue'

type ContextAction =
  | 'refresh'
  | 'close-current'
  | 'close-other'
  | 'close-left'
  | 'close-right'
  | 'close-all'
  | 'affix'
  | 'unaffix'

interface ContextMenuItem {
  key: ContextAction
  label: string
  icon: Component
}

type RouteLike = Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'path' | 'name' | 'meta'>

const emit = defineEmits<{
  refreshCurrent: [tab: RouteTab]
}>()

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()
const { locale, t: i18nT } = useI18n()
const { isEnglish, text } = useAppLanguage()
const scrollNavRef = ref<InstanceType<typeof KoiScrollNav> | null>(null)

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  choosePath: '',
})

const activeTabIndex = computed(() => tabsStore.tabList.findIndex((tab) => tab.path === route.fullPath))
const activeSelector = computed(() => {
  return activeTabIndex.value >= 0 ? `[data-tab-index="${activeTabIndex.value}"]` : ''
})

const chooseTab = computed(() => tabsStore.tabList.find((tab) => tab.path === contextMenu.choosePath))
const chooseTabIndex = computed(() => tabsStore.tabList.findIndex((tab) => tab.path === contextMenu.choosePath))

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  void locale.value
  const tab = chooseTab.value
  if (!tab) {
    return []
  }

  const index = chooseTabIndex.value
  const hasClosableLeft = tabsStore.tabList.some((item, itemIndex) => itemIndex < index && item.isAffix !== '1')
  const hasClosableRight = tabsStore.tabList.some((item, itemIndex) => itemIndex > index && item.isAffix !== '1')
  const hasClosableOther = tabsStore.tabList.some((item) => item.path !== tab.path && item.isAffix !== '1')
  const closableCount = tabsStore.tabList.filter((item) => item.isAffix !== '1').length
  const canCloseCurrent = tab.path !== HOME_URL && tab.isAffix !== '1'
  const items: ContextMenuItem[] = [
    { key: 'refresh', label: i18nT('tabs.refresh'), icon: Refresh },
  ]

  if (canCloseCurrent) {
    items.push({ key: 'close-current', label: i18nT('tabs.closeCurrent'), icon: Close })
  }
  if (hasClosableOther) {
    items.push({ key: 'close-other', label: i18nT('tabs.closeOther'), icon: CircleClose })
  }
  if (hasClosableLeft) {
    items.push({ key: 'close-left', label: i18nT('tabs.closeLeft'), icon: Back })
  }
  if (hasClosableRight) {
    items.push({ key: 'close-right', label: i18nT('tabs.closeRight'), icon: Right })
  }
  if (closableCount > 1) {
    items.push({ key: 'close-all', label: i18nT('tabs.closeAll'), icon: FolderDelete })
  }
  if (tab.path !== HOME_URL) {
    items.push(
      tab.isAffix === '1'
        ? { key: 'unaffix', label: i18nT('tabs.unsetAffix'), icon: Unlock }
        : { key: 'affix', label: i18nT('tabs.setAffix'), icon: Lock },
    )
  }

  return items
})

function resolveTabIcon(tab: RouteTab): Component {
  if (tab.path === HOME_URL || tab.name === 'home') {
    return House
  }
  if (tab.name === 'settings') {
    return Setting
  }
  if (tab.name === 'automation-templates') {
    return Files
  }
  if (tab.name.includes('automation')) {
    return Operation
  }
  return Document
}

function getRouteTitle(routeLike: RouteLike): string {
  const routeName = typeof routeLike.name === 'string' ? routeLike.name : ''
  const module = tosModules.find((item) => item.routeName === routeName || item.path === routeLike.path)

  if (module) {
    return getLocalizedModuleTitle(module, isEnglish.value ? 'en-US' : 'zh-CN')
  }

  if (routeName === 'release-updates') {
    return isEnglish.value ? 'Release Updates' : text('版本更新记录')
  }

  const title = routeLike.meta.title
  return typeof title === 'string' && title.trim() ? text(title) : text('未命名页面')
}

function getTabDisplayTitle(tab: RouteTab): string {
  const resolvedRoute = router.resolve(tab.path) as RouteLike
  return getRouteTitle(resolvedRoute) || getMenuLanguage(tab.title)
}

function buildRouteTab(routeLike: RouteLike): RouteTab | null {
  if (typeof routeLike.name !== 'string') {
    return null
  }

  const keepAliveName = routeLike.meta.keepAliveName || routeLike.name
  return {
    icon: routeLike.name,
    title: getRouteTitle(routeLike),
    path: routeLike.fullPath,
    name: keepAliveName,
    isKeepAlive: routeLike.meta.isKeepAlive === '0' ? '0' : '1',
    isAffix: routeLike.path === HOME_URL || routeLike.meta.isAffix === '1' ? '1' : '0',
  }
}

function ensureHomeTab(): void {
  const homeRoute = router.resolve(HOME_URL) as RouteLike
  const homeTab = buildRouteTab(homeRoute)
  if (homeTab) {
    tabsStore.ensureHomeTab(homeTab)
  }
}

function syncCurrentRoute(): void {
  ensureHomeTab()
  const currentTab = buildRouteTab(route)
  if (currentTab) {
    tabsStore.addTab(currentTab)
  }
  requestTabsScrollUpdate()
}

function requestTabsScrollUpdate(): void {
  void nextTick(() => {
    scrollNavRef.value?.updateScrollState()
    scrollNavRef.value?.scrollToSelector()
  })
}

async function openTab(path: string): Promise<void> {
  closeContextMenu()
  if (path !== route.fullPath) {
    await router.push(path)
  }
}

async function closeTab(tab: RouteTab): Promise<void> {
  const nextPath = tabsStore.removeTab(tab.path, route.fullPath)
  closeContextMenu()
  if (nextPath !== route.fullPath) {
    await router.push(nextPath)
  }
  requestTabsScrollUpdate()
}

function openContextMenu(event: MouseEvent, tabPath: string): void {
  contextMenu.choosePath = tabPath
  const menuWidth = 176
  const menuHeight = Math.max(44, contextMenuItems.value.length * 36 + 12)
  const padding = 12
  contextMenu.x = Math.min(event.clientX, window.innerWidth - menuWidth - padding)
  contextMenu.y = Math.min(event.clientY, window.innerHeight - menuHeight - padding)
  contextMenu.visible = true
}

function closeContextMenu(): void {
  contextMenu.visible = false
}

async function runContextAction(action: ContextAction): Promise<void> {
  const tab = chooseTab.value
  if (!tab) {
    closeContextMenu()
    return
  }

  closeContextMenu()

  if (action === 'refresh') {
    await openTab(tab.path)
    emit('refreshCurrent', tab)
    return
  }

  if (action === 'close-current') {
    await closeTab(tab)
    return
  }

  if (action === 'close-other') {
    tabsStore.closeManyTabs(tab.path)
    await openTab(tab.path)
    return
  }

  if (action === 'close-left') {
    tabsStore.closeSideTabs(tab.path, 'left')
    await openTab(tab.path)
    return
  }

  if (action === 'close-right') {
    tabsStore.closeSideTabs(tab.path, 'right')
    await openTab(tab.path)
    return
  }

  if (action === 'close-all') {
    tabsStore.closeManyTabs()
    await openTab(HOME_URL)
    return
  }

  if (action === 'affix') {
    tabsStore.replaceIsAffix(tab.path, '1')
    return
  }

  if (action === 'unaffix') {
    tabsStore.replaceIsAffix(tab.path, '0')
  }
}

function handleDocumentClick(): void {
  closeContextMenu()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

watch(
  () => route.fullPath,
  () => syncCurrentRoute(),
  { immediate: true },
)

watch(
  () => [tabsStore.tabList.length, activeTabIndex.value],
  () => requestTabsScrollUpdate(),
)

watch(
  () => [isEnglish.value, locale.value],
  () => {
    for (const tab of tabsStore.tabList) {
      const resolvedRoute = router.resolve(tab.path) as RouteLike
      const nextTab = buildRouteTab(resolvedRoute)
      if (nextTab) {
        tabsStore.setTabTitle(nextTab.title, tab.path)
      }
    }
  },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<style scoped>
.layout-tabs-bar {
  height: 42px;
  min-height: 42px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  min-width: 0;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  position: relative;
  z-index: 210;
}

.layout-tabs-bar__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  min-width: 0;
  height: 32px;
  padding: 0 9px 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--color-muted, #64748b);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.layout-tabs-bar__item:hover {
  background: var(--color-surface-muted, #f1f5f9);
  color: var(--color-primary, #0f766e);
}

.layout-tabs-bar__item:active {
  transform: scale(0.98);
}

.layout-tabs-bar__item.is-active {
  border-color: #99f6e4;
  background: var(--color-primary-soft, #f0fdfa);
  color: var(--color-primary, #0f766e);
  font-weight: 700;
}

.layout-tabs-bar__icon,
.layout-tabs-bar__affix {
  flex: 0 0 auto;
  font-size: 14px;
}

.layout-tabs-bar__affix {
  color: #f59e0b;
}

.layout-tabs-bar__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout-tabs-bar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: -3px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.64;
  transition: background 0.16s ease, opacity 0.16s ease;
}

.layout-tabs-bar__close:hover {
  opacity: 1;
  background: rgba(15, 118, 110, 0.11);
}

.layout-tabs-context-menu {
  position: fixed;
  z-index: 1200;
  width: 176px;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.14),
    0 3px 10px rgba(15, 23, 42, 0.08);
}

.layout-tabs-context-menu__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #334155;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.16s ease, color 0.16s ease;
}

.layout-tabs-context-menu__item:hover {
  background: #f0fdfa;
  color: #0f766e;
}

.layout-tabs-menu-enter-active,
.layout-tabs-menu-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.layout-tabs-menu-enter-from,
.layout-tabs-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .layout-tabs-bar {
    padding: 0 8px;
  }

  .layout-tabs-bar__item {
    max-width: 156px;
  }
}
</style>
