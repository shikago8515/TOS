<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-hidden': isSidebarHidden }">
    <aside class="app-sidebar" aria-label="TOS 主导航" :aria-hidden="isSidebarHidden">
      <div class="sidebar-header">
        <RouterLink class="brand" to="/">
          <span class="brand-mark">T</span>
          <span class="brand-name">TOS</span>
        </RouterLink>

        <button
          class="sidebar-hide-button"
          type="button"
          :aria-label="sidebarToggleLabel"
          :title="sidebarToggleLabel"
          @click="hideSidebar"
        >
          <span aria-hidden="true">‹</span>
        </button>
      </div>

      <nav class="nav-groups">
        <section
          v-for="group in sidebarGroups"
          :key="group.id"
          class="nav-group"
          :class="{ 'nav-group--single': group.items.length === 1 }"
        >
          <button
            v-if="group.isCollapsible"
            class="nav-group-button"
            type="button"
            :aria-expanded="isNavGroupExpanded(group.id)"
            @click="toggleNavGroup(group.id)"
          >
            <span>{{ group.displayLabel }}</span>
            <span class="nav-chevron" aria-hidden="true">
              {{ isNavGroupExpanded(group.id) ? '⌄' : '›' }}
            </span>
          </button>

          <p v-else-if="group.showLabel" class="nav-group-title">
            {{ group.displayLabel }}
          </p>

          <div v-if="!group.isCollapsible || isNavGroupExpanded(group.id)" class="nav-group-items">
            <template v-for="item in group.items" :key="item.id">
              <div
                v-if="item.kind === 'parent'"
                class="nav-parent"
                :class="{ 'nav-parent--active': item.active }"
              >
                <button
                  class="nav-parent-button"
                  :class="{ 'nav-parent-button--active': item.active }"
                  type="button"
                  :aria-expanded="isNavParentExpanded(item.id)"
                  @click="toggleNavParent(item.id)"
                >
                  <span class="nav-dot" aria-hidden="true" />
                  <span class="nav-label">{{ item.label }}</span>
                  <span class="nav-chevron" aria-hidden="true">
                    {{ isNavParentExpanded(item.id) ? '⌄' : '›' }}
                  </span>
                </button>

                <div v-if="isNavParentExpanded(item.id)" class="nav-children">
                  <RouterLink
                    v-for="module in item.modules"
                    :key="module.id"
                    class="nav-link nav-link--child"
                    :to="module.path"
                    :class="{ 'nav-link--active': isModuleActive(module) }"
                  >
                    <span class="nav-dot nav-dot--child" aria-hidden="true" />
                    <span class="nav-label">{{ getModuleNavLabel(module) }}</span>
                  </RouterLink>
                </div>
              </div>

              <RouterLink
                v-else
                class="nav-link"
                :to="item.module.path"
                :class="{ 'nav-link--active': isModuleActive(item.module) }"
              >
                <span class="nav-dot" aria-hidden="true" />
                <span class="nav-label">{{ getModuleNavLabel(item.module) }}</span>
              </RouterLink>
            </template>
          </div>
        </section>
      </nav>

    </aside>

    <div class="app-main">
      <header class="topbar">
        <div class="topbar-title">
          <button
            class="sidebar-toggle-button"
            type="button"
            :aria-label="sidebarToggleLabel"
            :title="sidebarToggleLabel"
            @click="toggleSidebar"
          >
            <span aria-hidden="true">☰</span>
          </button>

          <div>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>

        <div class="topbar-actions">
          <span class="current-date">{{ displayDate }}</span>
          <button class="diagnostics-button" type="button" @click="exportDiagnostics">
            {{ t('app.diagnostics.export') }}
          </button>
        </div>
      </header>

      <main class="content-frame">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import {
  getModulesByGroup,
  getNavParentsByGroup,
  tosNavGroups,
  type TosModuleDefinition,
  type TosModuleGroup,
  type TosNavGroupDefinition,
  type TosNavParentDefinition,
} from '../domain/moduleCatalog'
import { useAppLanguage } from '../shared/i18n/appLanguage'

interface SidebarModuleItem {
  id: string
  kind: 'module'
  module: TosModuleDefinition
  order: number
}

interface SidebarParentItem {
  id: string
  kind: 'parent'
  label: string
  modules: TosModuleDefinition[]
  order: number
  active: boolean
}

interface SidebarGroup extends TosNavGroupDefinition {
  items: SidebarItem[]
  displayLabel: string
  isCollapsible: boolean
  showLabel: boolean
}

type SidebarItem = SidebarModuleItem | SidebarParentItem

const route = useRoute()
const isSidebarHidden = ref(false)
const expandedNavGroups = ref<Set<TosModuleGroup>>(new Set(['excel', 'automation', 'collector']))
const expandedNavParents = ref<Set<string>>(new Set(['jane-table-making']))
const { isEnglish, t } = useAppLanguage()

const sidebarGroups = computed<SidebarGroup[]>(() =>
  tosNavGroups
    .map((group) => {
      const modules = getModulesByGroup(group.id).filter(shouldShowInSidebar)
      const parents = getNavParentsByGroup(group.id)
      const parentItems = parents
        .map((parent) => buildSidebarParent(parent, modules))
        .filter((item): item is SidebarParentItem => item !== null)
      const parentIds = new Set(parentItems.map((parent) => parent.id))
      const moduleItems = modules
        .filter((module) => !module.navParentId || !parentIds.has(module.navParentId))
        .map<SidebarModuleItem>((module) => ({
          id: module.id,
          kind: 'module',
          module,
          order: module.order,
        }))
      const items = [...moduleItems, ...parentItems].sort(
        (left, right) => left.order - right.order,
      )

      return {
        ...group,
        items,
        displayLabel: getGroupLabel(group),
        isCollapsible: group.id !== 'home' && group.id !== 'settings',
        showLabel: group.id === 'collector' || items.length > 1,
      }
    })
    .filter((group) => group.items.length > 0),
)

const pageTitle = computed(() => {
  const activeModule = tosNavGroups
    .flatMap((group) => getModulesByGroup(group.id))
    .find((module) => isModuleActive(module))

  if (activeModule) {
    return isEnglish.value ? activeModule.navLabelEn : activeModule.title
  }

  const title = route.meta.title
  return typeof title === 'string' ? title : '首页'
})

const sidebarToggleLabel = computed(() =>
  isSidebarHidden.value ? t('app.sidebar.show') : t('app.sidebar.hide'),
)

const displayDate = computed(() => {
  const today = new Date()
  const weekdays = isEnglish.value
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')

  return `${month}/${day}${weekdays[today.getDay()]}`
})

function buildSidebarParent(
  parent: TosNavParentDefinition,
  modules: TosModuleDefinition[],
): SidebarParentItem | null {
  const childModules = modules
    .filter((module) => module.navParentId === parent.id)
    .sort((left, right) => left.order - right.order)

  if (childModules.length === 0) {
    return null
  }

  return {
    id: parent.id,
    kind: 'parent',
    label: getParentLabel(parent),
    modules: childModules,
    order: parent.order,
    active: childModules.some(isModuleActive),
  }
}

function shouldShowInSidebar(module: TosModuleDefinition): boolean {
  return module.stage !== 'placeholder' || module.group === 'settings'
}

function isModuleActive(module: TosModuleDefinition): boolean {
  return route.name === module.routeName
}

function isNavGroupExpanded(groupId: TosModuleGroup): boolean {
  return expandedNavGroups.value.has(groupId)
}

function isNavParentExpanded(parentId: string): boolean {
  return expandedNavParents.value.has(parentId)
}

function toggleNavGroup(groupId: TosModuleGroup): void {
  const nextExpanded = new Set(expandedNavGroups.value)

  if (nextExpanded.has(groupId)) {
    nextExpanded.delete(groupId)
  } else {
    nextExpanded.add(groupId)
  }

  expandedNavGroups.value = nextExpanded
}

function toggleNavParent(parentId: string): void {
  const nextExpanded = new Set(expandedNavParents.value)

  if (nextExpanded.has(parentId)) {
    nextExpanded.delete(parentId)
  } else {
    nextExpanded.add(parentId)
  }

  expandedNavParents.value = nextExpanded
}

function toggleSidebar(): void {
  isSidebarHidden.value = !isSidebarHidden.value
}

function hideSidebar(): void {
  isSidebarHidden.value = true
}

function getGroupLabel(group: TosNavGroupDefinition): string {
  return isEnglish.value ? group.labelEn : group.label
}

function getParentLabel(parent: TosNavParentDefinition): string {
  return isEnglish.value ? parent.labelEn : parent.label
}

function getModuleNavLabel(module: TosModuleDefinition): string {
  return isEnglish.value ? module.navLabelEn : module.navLabel
}

async function exportDiagnostics(): Promise<void> {
  await window.electronAPI?.exportDiagnosticsPackage()
}

watch(
  () => route.name,
  () => {
    const activeModules = tosNavGroups
      .flatMap((group) => getModulesByGroup(group.id))
      .filter((module) => isModuleActive(module))
    const activeParents = activeModules
      .filter((module) => module.navParentId)
      .map((module) => module.navParentId as string)
    const activeGroups = activeModules.map((module) => module.group)

    if (activeParents.length === 0 && activeGroups.length === 0) {
      return
    }

    expandedNavParents.value = new Set([...expandedNavParents.value, ...activeParents])
    expandedNavGroups.value = new Set([...expandedNavGroups.value, ...activeGroups])
  },
  { immediate: true },
)

</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
  background: #edf3f8;
  transition: grid-template-columns 180ms ease;
}

.app-shell--sidebar-hidden {
  grid-template-columns: 0 minmax(0, 1fr);
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  padding: 22px 18px;
  color: #dbe7f3;
  background: #17283a;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    padding 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
}

.app-shell--sidebar-hidden .app-sidebar {
  padding-right: 0;
  padding-left: 0;
  pointer-events: none;
  opacity: 0;
  border-right-color: transparent;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 212px;
  margin-bottom: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 48px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #153352;
  font-weight: 800;
  background: #f5fbff;
  border-radius: 8px;
}

.brand-name {
  display: block;
  color: #f4f9ff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
}

.sidebar-hide-button,
.sidebar-toggle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  padding: 0;
  font-size: 20px;
  line-height: 1;
  border-radius: 7px;
  cursor: pointer;
}

.sidebar-hide-button {
  color: #c9d6e3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar-hide-button:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
}

.nav-groups {
  display: grid;
  gap: 18px;
  min-width: 212px;
}

.nav-group {
  display: grid;
  gap: 6px;
}

.nav-group-title,
.nav-group-button {
  min-height: 30px;
  color: #7f94a8;
  font-size: 12px;
  font-weight: 800;
}

.nav-group-title {
  margin: 0 0 2px;
}

.nav-group-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 3px 0;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.nav-group-button:hover {
  color: #c9d6e3;
}

.nav-group-items {
  display: grid;
  gap: 6px;
}

.nav-link,
.nav-parent-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
  color: #c9d6e3;
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.nav-link:hover,
.nav-link--active,
.nav-parent-button:hover,
.nav-parent-button--active {
  color: #ffffff;
  background: rgba(76, 132, 194, 0.28);
}

.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-chevron {
  margin-left: auto;
  color: #93a6b8;
  font-size: 15px;
}

.nav-children {
  display: grid;
  gap: 4px;
  margin-top: 4px;
  padding-left: 16px;
}

.nav-link--child {
  min-height: 34px;
  padding-left: 12px;
  font-size: 13px;
}

.nav-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  background: currentColor;
  border-radius: 999px;
  opacity: 0.72;
}

.nav-dot--child {
  width: 6px;
  height: 6px;
}

.app-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 86px;
  padding: 18px 30px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #dbe5ee;
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.sidebar-toggle-button {
  color: #185782;
  background: #eff8ff;
  border: 1px solid #b9d8ee;
}

.sidebar-toggle-button:hover {
  background: #e1f2ff;
}

.topbar h1 {
  margin: 0;
  color: #172033;
  font-size: 24px;
  font-weight: 760;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.current-date {
  color: #546579;
  font-size: 13px;
  font-weight: 700;
}

.diagnostics-button {
  min-height: 34px;
  padding: 0 14px;
  color: #185782;
  font-weight: 700;
  background: #eff8ff;
  border: 1px solid #b9d8ee;
  border-radius: 7px;
  cursor: pointer;
}

.diagnostics-button:hover {
  background: #e1f2ff;
}

.content-frame {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 28px 30px 34px;
}

@media (max-width: 900px) {
  .app-shell,
  .app-shell--sidebar-hidden {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    display: none;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
