<template>
  <div class="app-layout" :class="{ 'sidebar-hidden': isSidebarHidden }">
    <aside class="side-nav" :class="{ 'is-open': !isSidebarHidden }">
      <div class="brand">
        <div class="brand-mark">
          <AppIcon name="command" class="brand-logo" />
        </div>
        <div class="brand-text">
          <h1>TOS</h1>
          <p>Workstation</p>
        </div>
      </div>

      <div class="nav-scroll">
        <nav class="menu">
          <template v-for="group in sidebarGroups" :key="group.id">
            <div v-if="group.showLabel" class="menu-group-title">
              {{ group.displayLabel }}
            </div>

            <template v-for="item in group.items" :key="item.id">
              <div
                v-if="item.kind === 'parent'"
                class="menu-parent"
                :class="{ 'is-active': item.active }"
              >
                <div
                  class="menu-item"
                  :class="{ 'is-active': item.active }"
                  @click="toggleNavParent(item.id)"
                >
                  <AppIcon :name="getGroupIcon(group.id)" class="menu-icon" />
                  <span class="menu-label">{{ item.label }}</span>
                  <AppIcon :name="isNavParentExpanded(item.id) ? 'chevron-down' : 'chevron-right'" class="menu-arrow" />
                </div>

                <transition name="expand-fade">
                  <div v-show="isNavParentExpanded(item.id)" class="menu-children">
                    <RouterLink
                      v-for="module in item.modules"
                      :key="module.id"
                      class="menu-item child-item"
                      :to="module.path"
                      :class="{ 'is-active': isModuleActive(module) }"
                    >
                      <span class="menu-label">{{ getModuleNavLabel(module) }}</span>
                    </RouterLink>
                  </div>
                </transition>
              </div>

              <RouterLink
                v-else
                class="menu-item"
                :to="item.module.path"
                :class="{ 'is-active': isModuleActive(item.module) }"
              >
                <AppIcon :name="getGroupIcon(group.id)" class="menu-icon" />
                <span class="menu-label">{{ getModuleNavLabel(item.module) }}</span>
              </RouterLink>
            </template>
          </template>
        </nav>
      </div>
    </aside>

    <div
      class="sidebar-mask"
      v-if="isMobile && !isSidebarHidden"
      @click="isSidebarHidden = true"
    ></div>

    <section class="main-panel">
      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-btn" type="button" @click="toggleSidebar" :title="sidebarToggleLabel">
            <AppIcon name="menu" />
          </button>
          
          <div class="breadcrumb">
            <span class="breadcrumb-item">首页</span>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-item current">{{ pageTitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <div class="mode-tag">
            <AppIcon name="calendar" />
            <span class="tag-text">{{ displayDate }}</span>
          </div>

          <button class="action-btn" type="button" @click="exportDiagnostics">
            <AppIcon name="activity" />
            <span>{{ t('app.diagnostics.export') }}</span>
          </button>
        </div>
      </header>

      <main class="content-shell">
        <RouterView v-slot="{ Component, route }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </RouterView>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
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
import AppIcon from '../shared/ui/AppIcon.vue'

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
const isMobile = ref(false)
const expandedNavGroups = ref<Set<TosModuleGroup>>(new Set(['excel', 'automation', 'collector']))
const expandedNavParents = ref<Set<string>>(new Set(['jane-table-making', 'web-automation-group']))
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

function isNavParentExpanded(parentId: string): boolean {
  return expandedNavParents.value.has(parentId)
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

function getGroupLabel(group: TosNavGroupDefinition): string {
  return isEnglish.value ? group.labelEn : group.label
}

function getParentLabel(parent: TosNavParentDefinition): string {
  return isEnglish.value ? parent.labelEn : parent.label
}

function getModuleNavLabel(module: TosModuleDefinition): string {
  return isEnglish.value ? module.navLabelEn : module.navLabel
}

function getGroupIcon(groupId: TosModuleGroup): string {
  const map: Record<TosModuleGroup, string> = {
    home: 'radar',
    excel: 'database',
    automation: 'workflow',
    testing: 'shield-check',
    collector: 'globe-search',
    settings: 'monitor-code'
  }
  return map[groupId] || 'layers'
}

async function exportDiagnostics(): Promise<void> {
  await window.electronAPI?.exportDiagnosticsPackage()
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 992
  if (isMobile.value) {
    isSidebarHidden.value = true
  }
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

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
    
    if (isMobile.value) {
      isSidebarHidden.value = true
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.app-layout {
  --sidebar-width: 268px;
  --topbar-height: 68px;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 12% 10%, rgba(82, 196, 196, 0.12), transparent 38%),
    radial-gradient(circle at 88% 12%, rgba(64, 158, 255, 0.1), transparent 35%),
    #f3f8fb;
}

.side-nav {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: #ffffff;
  color: #303133;
  display: flex;
  flex-direction: column;
  transform: translateX(0);
  transition: transform 0.34s ease;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
  border-right: 1px solid #f0f2f5;
  z-index: 20;
  height: 100%;
}

.brand {
  height: 78px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-text h1 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0.3px;
  color: #303133;
  font-weight: 600;
}

.brand-text p {
  margin: 2px 0 0;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #909399;
}

.nav-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.menu {
  padding: 8px 10px 16px;
  display: flex;
  flex-direction: column;
}

.menu-group-title {
  color: #909399;
  font-size: 12px;
  padding: 12px 14px 6px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.menu-item {
  display: flex;
  align-items: center;
  margin: 4px 0;
  padding: 0 14px;
  border-radius: 8px;
  height: 42px;
  color: #606266;
  transition: all 0.25s ease;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
}

.menu-icon {
  font-size: 17px;
  color: #909399;
  transition: color 0.2s;
  margin-right: 10px;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-arrow {
  font-size: 14px;
  color: #909399;
  transition: transform 0.3s ease;
}

.menu-item:hover {
  background: #f5f7fa;
  color: #303133;
}

.menu-item.is-active {
  color: #0d9488;
  background: #f0fdfa;
  font-weight: 500;
}

.menu-item.is-active .menu-icon {
  color: #0d9488;
}

.menu-children {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
}

.child-item {
  height: 38px;
  font-size: 13px;
}

.sidebar-hidden .side-nav {
  transform: translateX(-105%);
}

.sidebar-mask {
  position: fixed;
  inset: 0;
  background: rgba(13, 38, 58, 0.36);
  backdrop-filter: blur(1px);
  z-index: 15;
  animation: mask-in 0.22s ease;
}

@keyframes mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.main-panel {
  margin-left: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.34s ease;
}

.sidebar-hidden .main-panel {
  margin-left: 0;
}

.topbar {
  height: var(--topbar-height);
  margin: 14px 16px 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(183, 217, 230, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 10px;
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(40, 92, 124, 0.08);
  position: relative;
  z-index: 10;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: rgba(74, 164, 230, 0.16);
  color: #1e88d0;
  transition: all 0.24s ease;
  cursor: pointer;
  font-size: 16px;
}

.menu-btn:hover {
  transform: translateY(-1px);
  background: rgba(74, 164, 230, 0.24);
}

.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #606266;
}

.breadcrumb-separator {
  margin: 0 8px;
  color: #c0c4cc;
  font-size: 12px;
}

.breadcrumb-item.current {
  color: #24658d;
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-tag {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 0 12px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid #a8d9ef;
  background: #edf8ff;
  color: #2a6f95;
  font-size: 13px;
}

.mode-tag .tag-text {
  margin-left: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid rgba(183, 217, 230, 0.6);
  background: #f8fcff;
  color: #204c68;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.26s ease;
}

.action-btn:hover {
  border-color: #7fc2ea;
  box-shadow: 0 4px 12px rgba(35, 132, 189, 0.12);
  color: #1e88d0;
}

.content-shell {
  flex: 1;
  min-height: 0;
  margin: 12px 16px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(183, 217, 230, 0.58);
  box-shadow: 0 12px 28px rgba(37, 102, 139, 0.08);
  overflow-y: auto;
  padding: 20px;
}

/* Animations */
.expand-fade-enter-active,
.expand-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.expand-fade-enter-from,
.expand-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s ease;
}
.page-slide-enter-from {
  opacity: 0;
  transform: translateX(15px);
}
.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-15px);
}

@media (max-width: 992px) {
  .main-panel {
    margin-left: 0;
  }
}
</style>
