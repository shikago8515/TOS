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
            <button
              v-if="group.showLabel && group.isCollapsible"
              class="menu-group-title menu-group-title--button"
              type="button"
              :aria-expanded="isNavGroupExpanded(group.id)"
              @click="toggleNavGroup(group.id)"
            >
              <span class="menu-group-label">{{ group.displayLabel }}</span>
              <AppIcon
                :name="isNavGroupExpanded(group.id) ? 'chevron-down' : 'chevron-right'"
                class="menu-group-arrow"
              />
            </button>
            <div v-else-if="group.showLabel" class="menu-group-title">
              <span class="menu-group-label">{{ group.displayLabel }}</span>
            </div>

            <transition name="expand-fade">
              <div v-show="isNavGroupExpanded(group.id)" class="menu-group-items">
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
                    <AppIcon :name="getModuleIcon(item.module)" class="menu-icon" />
                    <span class="menu-label">{{ getModuleNavLabel(item.module) }}</span>
                  </RouterLink>
                </template>
              </div>
            </transition>
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
            <span class="breadcrumb-home">
              <AppIcon name="radar" class="breadcrumb-home-icon" />
              <span>首页</span>
            </span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">{{ pageTitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <div class="topbar-pill">
            <AppIcon name="calendar" class="pill-icon" />
            <span>{{ displayDate }}</span>
          </div>

          <button class="topbar-action" type="button" @click="exportDiagnostics">
            <AppIcon name="activity" class="action-icon" />
            <span class="action-label">{{ t('app.diagnostics.export') }}</span>
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

    <transition name="toast-slide">
      <div v-if="toast.visible" class="toast-overlay" @click="toast.visible = false">
        <div class="toast-card" :class="`toast-${toast.type}`">
          <AppIcon :name="toast.icon" class="toast-icon" />
          <div class="toast-body">
            <p class="toast-title">{{ toast.title }}</p>
            <p class="toast-message">{{ toast.message }}</p>
          </div>
          <button class="toast-close" type="button" @click.stop="toast.visible = false">
            ×
          </button>
        </div>
      </div>
    </transition>
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

interface ToastState {
  visible: boolean
  type: 'warning' | 'error' | 'info'
  icon: string
  title: string
  message: string
}

const toast = ref<ToastState>({ visible: false, type: 'info', icon: 'info', title: '', message: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(type: ToastState['type'], icon: string, title: string, message: string): void {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, type, icon, title, message }
  toastTimer = setTimeout(() => { toast.value.visible = false }, 4000)
}

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

function isNavGroupCollapsible(groupId: TosModuleGroup): boolean {
  return groupId !== 'home' && groupId !== 'settings'
}

function isNavGroupExpanded(groupId: TosModuleGroup): boolean {
  return !isNavGroupCollapsible(groupId) || expandedNavGroups.value.has(groupId)
}

function toggleNavGroup(groupId: TosModuleGroup): void {
  if (!isNavGroupCollapsible(groupId)) {
    return
  }

  const nextExpanded = new Set(expandedNavGroups.value)

  if (nextExpanded.has(groupId)) {
    nextExpanded.delete(groupId)
  } else {
    nextExpanded.add(groupId)
  }

  expandedNavGroups.value = nextExpanded
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
    automation: 'globe',
    testing: 'shield-check',
    collector: 'globe-search',
    settings: 'monitor-code'
  }
  return map[groupId] || 'layers'
}

function getModuleIcon(module: TosModuleDefinition): string {
  const customIcons: Record<string, string> = {
    'jessca': 'check-circle',
    'sophia-tina': 'files',
    'jane': 'grid',
    'jane-bom-summary': 'bar-chart',
    'jane-bom-compare': 'sliders',
    'jane-outbound-compare': 'sliders',
    'eric': 'terminal',
    'it-invoice-pdf-reorder': 'file-search',
    'browser-plugins': 'puzzle',
    'infornexus': 'globe',
    'jane-sap': 'server',
    'eric-infornexus': 'globe',
    'adidas-materials': 'package',
  }
  return customIcons[module.id] || getGroupIcon(module.group)
}

async function exportDiagnostics(): Promise<void> {
  if (!window.electronAPI) {
    showToast('warning', 'alert-circle', '功能受限', '导出诊断包功能需要在桌面客户端中使用，当前浏览器预览环境不支持。')
    return
  }
  await window.electronAPI.exportDiagnosticsPackage()
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
  --sidebar-width: 232px;
  --topbar-height: 68px;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: var(--soft-bg, #f0f4f8);
}

.side-nav {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: var(--soft-surface, #ffffff);
  color: var(--soft-text, #303133);
  display: flex;
  flex-direction: column;
  transform: translateX(0);
  transition: transform 0.34s ease;
  box-shadow: 4px 0 16px rgba(166, 180, 200, 0.2);
  border-right: none;
  z-index: 20;
  height: 100%;
}

.brand {
  height: 78px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: var(--soft-radius-sm, 12px);
  background: linear-gradient(135deg, #0d9488, #0f766e);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  box-shadow:
    3px 3px 8px rgba(13, 148, 136, 0.2),
    -2px -2px 5px rgba(255, 255, 255, 0.6);
  transition: all 0.35s ease;
}

.brand-mark:hover {
  transform: scale(1.05) rotate(-2deg);
  box-shadow:
    4px 4px 12px rgba(13, 148, 136, 0.25),
    -3px -3px 6px rgba(255, 255, 255, 0.7);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-text h1 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0.3px;
  color: var(--soft-text, #303133);
  font-weight: 700;
}

.brand-text p {
  margin: 2px 0 0;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--soft-text-muted, #909399);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  border: 0;
  background: transparent;
  color: var(--soft-text-muted, #909399);
  font-size: 12px;
  padding: 12px 14px 6px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-align: left;
}

.menu-group-title--button {
  cursor: pointer;
  border-radius: var(--soft-radius-xs, 10px);
  transition: all 0.25s ease;
}

.menu-group-title--button:hover {
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #606266);
}

.menu-group-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-group-arrow {
  flex-shrink: 0;
  font-size: 14px;
}

.menu-group-items {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  align-items: center;
  margin: 4px 0;
  padding: 0 14px;
  border-radius: var(--soft-radius-xs, 10px);
  height: 42px;
  color: var(--soft-text-secondary, #606266);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  position: relative;
}

.menu-item::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: var(--soft-accent, #0d9488);
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
  opacity: 0;
}

.menu-item.is-active::before {
  transform: translateY(-50%) scaleY(1);
  opacity: 1;
}

.menu-item:hover::before {
  transform: translateY(-50%) scaleY(0.6);
  opacity: 0.5;
}

.menu-icon {
  font-size: 17px;
  color: var(--soft-text-muted, #909399);
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  margin-right: 10px;
  flex-shrink: 0;
}

.menu-item:hover .menu-icon {
  color: var(--soft-text-secondary, #606266);
  transform: scale(1.08);
}

.menu-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-arrow {
  font-size: 14px;
  color: var(--soft-text-muted, #909399);
  transition: transform 0.3s ease;
}

.menu-item:hover {
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text, #303133);
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
}

.menu-item.is-active {
  color: var(--soft-accent, #0d9488);
  background: var(--soft-accent-light, #f0fdfa);
  font-weight: 600;
  padding-left: 16px;
  box-shadow:
    inset 2px 2px 4px rgba(13, 148, 136, 0.06),
    inset -2px -2px 4px rgba(255, 255, 255, 0.9);
}

.menu-item.is-active .menu-icon {
  color: var(--soft-accent, #0d9488);
  filter: drop-shadow(0 0 3px rgba(13, 148, 136, 0.25));
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

.child-item::before {
  display: none;
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
  margin: 10px 10px 0;
  border-radius: var(--soft-radius, 16px);
  background: var(--soft-surface, #ffffff);
  border: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 12px;
  flex-shrink: 0;
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  position: relative;
  z-index: 10;
  transition: box-shadow 0.35s ease;
}

.topbar:hover {
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--soft-radius-sm, 12px);
  border: none;
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  cursor: pointer;
  font-size: 17px;
}

.menu-btn:hover {
  color: var(--soft-accent, #0d9488);
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  transform: translateY(-1px);
}

.menu-btn:active {
  box-shadow: var(--soft-shadow-pressed, inset 3px 3px 6px rgba(166,180,200,0.35), inset -3px -3px 6px rgba(255,255,255,0.85));
  transform: translateY(0);
}

.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--soft-text-secondary, #64748b);
  gap: 10px;
}

.breadcrumb-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--soft-text-muted, #94a3b8);
  font-weight: 500;
  transition: color 0.25s ease;
}

.breadcrumb-home:hover {
  color: var(--soft-accent, #0d9488);
}

.breadcrumb-home-icon {
  font-size: 14px;
}

.breadcrumb-separator {
  color: var(--soft-text-muted, #94a3b8);
  font-size: 13px;
  opacity: 0.6;
}

.breadcrumb-item.current {
  color: var(--soft-text, #1e293b);
  font-weight: 700;
  letter-spacing: -0.2px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  height: 34px;
  border-radius: 999px;
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
  transition: all 0.3s ease;
  white-space: nowrap;
}

.pill-icon {
  font-size: 14px;
  color: var(--soft-accent, #0d9488);
  opacity: 0.7;
}

.topbar-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 18px;
  border-radius: var(--soft-radius-sm, 12px);
  border: none;
  background: linear-gradient(135deg, var(--soft-accent, #0d9488), #0f766e);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow:
    3px 3px 8px rgba(13, 148, 136, 0.25),
    -2px -2px 6px rgba(255, 255, 255, 0.6);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.action-icon {
  font-size: 15px;
  opacity: 0.85;
}

.topbar-action:hover {
  box-shadow:
    5px 5px 14px rgba(13, 148, 136, 0.3),
    -3px -3px 8px rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
}

.topbar-action:active {
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.15),
    inset -2px -2px 5px rgba(255, 255, 255, 0.1);
  transform: translateY(0);
}

.content-shell {
  flex: 1;
  min-height: 0;
  margin: 10px 10px 14px;
  border-radius: var(--soft-radius, 16px);
  background: var(--soft-surface, #ffffff);
  border: none;
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  overflow-y: auto;
  padding: 16px;
  transition: box-shadow 0.35s ease;
}

.content-shell:hover {
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
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

/* Toast */
.toast-overlay {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  cursor: pointer;
}

.toast-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 420px;
  padding: 16px 18px;
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #e4e7ed;
}

.toast-warning {
  border-left-color: #e6a23c;
}

.toast-error {
  border-left-color: #f56c6c;
}

.toast-info {
  border-left-color: #409eff;
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: #909399;
}

.toast-warning .toast-icon {
  color: #e6a23c;
}

.toast-error .toast-icon {
  color: #f56c6c;
}

.toast-info .toast-icon {
  color: #409eff;
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px;
}

.toast-message {
  font-size: 13px;
  color: #606266;
  margin: 0;
  line-height: 1.5;
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
  transition: background 0.2s;
}

.toast-close:hover {
  background: #f5f7fa;
  color: #303133;
}

.toast-slide-enter-active {
  transition: all 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.toast-slide-leave-active {
  transition: all 0.25s ease-in;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.98);
}
</style>
