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
                <template v-for="cat in group.categories" :key="cat.id">
                  <!-- Category title (only shown for groups with multiple categories) -->
                  <button
                    v-if="!group.hasSingleCategory"
                    class="menu-category-title"
                    type="button"
                    :aria-expanded="expandedCategories.has(cat.id)"
                    @click="toggleCategory(cat.id)"
                  >
                    <span class="menu-label">{{ getCategoryLabel(cat.cat) }}</span>
                    <AppIcon
                      :name="expandedCategories.has(cat.id) ? 'chevron-down' : 'chevron-right'"
                      class="menu-arrow"
                    />
                  </button>

                  <!-- Category items: shown directly if single-category, else under category toggle -->
                  <template v-if="group.hasSingleCategory || expandedCategories.has(cat.id)">
                    <RouterLink
                      v-for="mod in cat.modules"
                      :key="mod.id"
                      class="menu-item"
                      :class="[
                        !group.hasSingleCategory ? 'child-item' : '',
                        isModuleActive(mod) ? 'is-active' : ''
                      ]"
                      :to="mod.path"
                    >
                      <AppIcon :name="getModuleIcon(mod)" class="menu-icon" />
                      <span class="menu-label">{{ getModuleNavLabel(mod) }}</span>
                    </RouterLink>
                  </template>
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
              <span>{{ text('首页') }}</span>
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

          <div ref="utilityMenuRef" class="topbar-menu">
            <button
              class="topbar-menu-btn"
              type="button"
              :aria-expanded="utilityMenuOpen"
              aria-haspopup="menu"
              @click="toggleUtilityMenu"
            >
              <span class="topbar-menu-icon">
                <AppIcon name="settings" class="action-icon" />
              </span>
              <span class="topbar-menu-label">{{ text('系统') }}</span>
              <AppIcon name="chevron-down" class="topbar-menu-chevron" />
            </button>

            <transition name="utility-menu-fade">
              <div v-if="utilityMenuOpen" class="utility-menu" role="menu">
                <button class="utility-menu-item" type="button" role="menuitem" @click="openSettingsPage">
                  <span class="utility-menu-icon">
                    <AppIcon name="settings" />
                  </span>
                  <span>
                    <strong>{{ text('系统设置') }}</strong>
                    <small>{{ text('语言、版本更新与自动化助手') }}</small>
                  </span>
                </button>
              </div>
            </transition>
          </div>
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

    <transition name="release-notice-fade">
      <div
        v-if="releaseNotice.visible && releaseNotice.releaseNotes"
        class="release-notice-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notice-title"
        @click="dismissReleaseNotice"
      >
        <section class="release-notice-card" @click.stop>
          <header class="release-notice-head">
            <div class="release-notice-mark">
              <AppIcon name="sparkles" />
            </div>
            <div class="release-notice-title-block">
              <p class="release-notice-kicker">{{ releaseNoticeVersionLabel }}</p>
              <h2 id="release-notice-title">{{ releaseNoticeTitle }}</h2>
            </div>
            <button
              class="release-notice-close"
              type="button"
              :aria-label="releaseNoticeCloseLabel"
              @click="dismissReleaseNotice"
            >
              <AppIcon name="stop-circle" />
            </button>
          </header>

          <div class="release-notice-groups">
            <section
              v-for="group in releaseNoticeGroups"
              :key="group.key"
              class="release-notice-group"
              :class="`release-notice-group--${group.key}`"
            >
              <div class="release-notice-group-title">
                <AppIcon :name="group.icon" />
                <strong>{{ group.title }}</strong>
              </div>
              <ul>
                <li v-for="item in group.items" :key="item">{{ text(item) }}</li>
              </ul>
            </section>
          </div>

          <footer class="release-notice-actions">
            <button class="release-notice-primary" type="button" @click="dismissReleaseNotice">
              {{ releaseNoticeConfirmLabel }}
            </button>
          </footer>
        </section>
      </div>
    </transition>

    <transition name="toast-slide">
      <div v-if="toast.visible" class="toast-overlay" @click="toast.visible = false">
        <div class="toast-card" :class="`toast-${toast.type}`">
          <AppIcon :name="toast.icon" class="toast-icon" />
          <div class="toast-body">
            <p class="toast-title">{{ toast.title }}</p>
            <p class="toast-message">{{ toast.message }}</p>
          </div>
          <button class="toast-close" type="button" @click.stop="toast.visible = false">
            <AppIcon name="stop-circle" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import {
  getLocalizedModuleTitle,
  getModulesByGroup,
  tosNavGroups,
  tosModuleCategoryLabels,
  type TosModuleCategory,
  type TosModuleDefinition,
  type TosModuleGroup,
  type TosNavGroupDefinition,
} from '../domain/moduleCatalog'
import { useAppLanguage } from '../shared/i18n/appLanguage'
import AppIcon from '../shared/ui/AppIcon.vue'
import {
  buildReleaseNoticeStateFromStorage,
  markReleaseNoticeSeen,
  type ReleaseNoticeState,
} from '../shared/version/releaseNotice'

interface SidebarCategory {
  id: string
  cat: TosModuleCategory
  modules: TosModuleDefinition[]
}

interface SidebarGroup extends TosNavGroupDefinition {
  categories: SidebarCategory[]
  hasSingleCategory: boolean
  displayLabel: string
  isCollapsible: boolean
  showLabel: boolean
}

const route = useRoute()
const router = useRouter()
const isSidebarHidden = ref(false)
const isMobile = ref(false)
const expandedNavGroups = ref<Set<TosModuleGroup>>(new Set(['jessica', 'sophia', 'jane', 'eric', 'it', 'finance-excel']))
const expandedCategories = ref<Set<string>>(new Set())
const { isEnglish, t, text } = useAppLanguage()
const utilityMenuRef = ref<HTMLElement | null>(null)
const utilityMenuOpen = ref(false)

interface ToastState {
  visible: boolean
  type: 'warning' | 'error' | 'info'
  icon: string
  title: string
  message: string
}

const toast = ref<ToastState>({ visible: false, type: 'info', icon: 'info', title: '', message: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

const releaseNotice = ref<ReleaseNoticeState>({ visible: false, releaseNotes: null })

const releaseNoticeTitle = computed(() => (isEnglish.value ? "What's New" : '本次更新内容'))
const releaseNoticeCloseLabel = computed(() => (isEnglish.value ? 'Close release notes' : '关闭更新提示'))
const releaseNoticeConfirmLabel = computed(() => (isEnglish.value ? 'Got it' : '我知道了'))
const releaseNoticeVersionLabel = computed(() => {
  const version = releaseNotice.value.releaseNotes?.version?.trim().replace(/^v/i, '')
  return version ? `V${version}` : ''
})

const releaseNoticeGroups = computed(() => {
  const notes = releaseNotice.value.releaseNotes
  if (!notes) {
    return []
  }

  return [
    { key: 'added', title: text('新增'), icon: 'sparkles', items: notes.added },
    { key: 'improved', title: text('优化'), icon: 'activity', items: notes.improved },
    { key: 'fixed', title: text('修复'), icon: 'check-circle', items: notes.fixed },
  ].filter((group) => group.items.length > 0)
})

function showToast(type: ToastState['type'], icon: string, title: string, message: string): void {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, type, icon, title, message }
  toastTimer = setTimeout(() => { toast.value.visible = false }, 4000)
}

function dismissReleaseNotice(): void {
  markReleaseNoticeSeen(window.localStorage)
  releaseNotice.value = { visible: false, releaseNotes: null }
}

const sidebarGroups = computed<SidebarGroup[]>(() =>
  tosNavGroups
    .map((group) => {
      const modules = getModulesByGroup(group.id).filter(shouldShowInSidebar)
      const catMap = new Map<TosModuleCategory, TosModuleDefinition[]>()
      for (const mod of modules) {
        const list = catMap.get(mod.category)
        if (list) { list.push(mod) } else { catMap.set(mod.category, [mod]) }
      }
      const categories: SidebarCategory[] = []
      for (const [cat, catModules] of catMap) {
        categories.push({ id: `${group.id}:${cat}`, cat, modules: catModules })
      }

      return {
        ...group,
        categories,
        hasSingleCategory: categories.length <= 1,
        displayLabel: getGroupLabel(group),
        isCollapsible: group.id !== 'home',
        showLabel: group.id !== 'home',
      }
    })
    .filter((group) => group.categories.length > 0),
)

const pageTitle = computed(() => {
  const activeModule = tosNavGroups
    .flatMap((group) => getModulesByGroup(group.id))
    .find((module) => isModuleActive(module))

  if (activeModule) {
    return getLocalizedModuleTitle(activeModule, isEnglish.value ? 'en-US' : 'zh-CN')
  }

  const title = route.meta.title
  return typeof title === 'string' ? text(title) : text('首页')
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

function shouldShowInSidebar(module: TosModuleDefinition): boolean {
  if (module.id === 'settings') {
    return false
  }
  return module.stage !== 'placeholder'
}

function isModuleActive(module: TosModuleDefinition): boolean {
  return route.name === module.routeName
}

function isNavGroupCollapsible(groupId: TosModuleGroup): boolean {
  return groupId !== 'home'
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

function toggleCategory(catId: string): void {
  const next = new Set(expandedCategories.value)
  if (next.has(catId)) { next.delete(catId) } else { next.add(catId) }
  expandedCategories.value = next
}

function getCategoryLabel(cat: TosModuleCategory): string {
  return isEnglish.value ? tosModuleCategoryLabels[cat].labelEn : tosModuleCategoryLabels[cat].label
}

function toggleSidebar(): void {
  isSidebarHidden.value = !isSidebarHidden.value
}

function toggleUtilityMenu(): void {
  utilityMenuOpen.value = !utilityMenuOpen.value
}

function closeUtilityMenu(): void {
  utilityMenuOpen.value = false
}

function openSettingsPage(): void {
  closeUtilityMenu()
  void router.push('/settings')
}

function handleTopbarDocumentClick(event: MouseEvent): void {
  if (!utilityMenuOpen.value) return
  const target = event.target
  if (target instanceof Node && utilityMenuRef.value?.contains(target)) {
    return
  }
  closeUtilityMenu()
}

function handleTopbarKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeUtilityMenu()
  }
}

function getGroupLabel(group: TosNavGroupDefinition): string {
  return isEnglish.value ? group.labelEn : group.label
}

function getModuleNavLabel(module: TosModuleDefinition): string {
  return isEnglish.value ? module.navLabelEn : module.navLabel
}

function getGroupIcon(groupId: TosModuleGroup): string {
  const map: Record<TosModuleGroup, string> = {
    home: 'radar',
    jessica: 'check-circle',
    sophia: 'files',
    jane: 'grid',
    eric: 'terminal',
    it: 'file-search',
    'finance-excel': 'database',
    'pdf-data-compare': 'file-search',
    'general-tools': 'layers',
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
    'draft-packing-compare': 'file-search',
    'browser-plugins': 'puzzle',
    'infornexus': 'globe',
    'jane-sap': 'server',
    'eric-infornexus': 'globe',
    'adidas-materials': 'package',
  }
  return customIcons[module.id] || getGroupIcon(module.group)
}

async function exportDiagnostics(): Promise<void> {
  const exportDiagnosticsPackage = window.electronAPI?.exportDiagnosticsPackage
  if (!exportDiagnosticsPackage) {
    showToast(
      'warning',
      'alert-circle',
      text('功能受限'),
      text('导出诊断包功能需要在桌面客户端中使用，当前浏览器预览环境不支持。'),
    )
    return
  }
  await exportDiagnosticsPackage()
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 992
  if (isMobile.value) {
    isSidebarHidden.value = true
  }
}

onMounted(() => {
  handleResize()
  releaseNotice.value = buildReleaseNoticeStateFromStorage()
  window.addEventListener('resize', handleResize)
  document.addEventListener('click', handleTopbarDocumentClick)
  document.addEventListener('keydown', handleTopbarKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleTopbarDocumentClick)
  document.removeEventListener('keydown', handleTopbarKeydown)
})

watch(
  () => route.name,
  () => {
    const activeModules = tosNavGroups
      .flatMap((group) => getModulesByGroup(group.id))
      .filter((module) => isModuleActive(module))

    if (activeModules.length === 0) {
      return
    }

    const activeGroups = activeModules.map((module) => module.group)
    expandedNavGroups.value = new Set([...expandedNavGroups.value, ...activeGroups])

    const activeCatIds = activeModules
      .filter((mod) => mod.category)
      .map((mod) => `${mod.group}:${mod.category}`)
    expandedCategories.value = new Set([...expandedCategories.value, ...activeCatIds])

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
  --topbar-height: 78px;
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

.menu-category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  border: 0;
  background: transparent;
  color: var(--soft-text-muted, #909399);
  font-size: 12px;
  padding: 6px 14px 6px 24px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-align: left;
  cursor: pointer;
  border-radius: var(--soft-radius-xs, 10px);
  transition: all 0.25s ease;
}

.menu-category-title:hover {
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #606266);
}

.child-item {
  height: 38px;
  font-size: 13px;
  padding-left: 28px;
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
  margin: 0 10px;
  border-radius: 0 0 var(--soft-radius, 16px) var(--soft-radius, 16px);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(219, 231, 229, 0.78);
  border-top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px 0 12px;
  flex-shrink: 0;
  box-shadow: 0 10px 26px rgba(15, 78, 73, 0.08);
  position: relative;
  z-index: 10;
  transition: box-shadow 0.35s ease;
}

.topbar:hover {
  box-shadow: 0 12px 30px rgba(15, 78, 73, 0.1);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1 1 auto;
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
  min-width: 0;
  flex: 1 1 auto;
  font-size: 14px;
  color: var(--soft-text-secondary, #64748b);
  gap: 10px;
  white-space: nowrap;
}

.breadcrumb-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
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
  min-width: 0;
  max-width: min(42vw, 420px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--soft-text, #1e293b);
  font-weight: 700;
  letter-spacing: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
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

.action-label--short {
  display: none;
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

.topbar-menu {
  position: relative;
}

.topbar-menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 10px 0 8px;
  border: 1px solid #dbe7e5;
  border-radius: 999px;
  background: #ffffff;
  color: #1e293b;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.topbar-menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #ecfeff;
  color: #0d9488;
}

.topbar-menu-btn:hover {
  border-color: #99f6e4;
  color: #0f766e;
  box-shadow: 0 10px 22px rgba(15, 118, 110, 0.14);
  transform: translateY(-1px);
}

.topbar-menu-btn[aria-expanded="true"] {
  border-color: #5eead4;
  color: #0f766e;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.16);
}

.topbar-menu-chevron {
  font-size: 12px;
  color: #64748b;
  transition: transform 0.2s ease;
}

.topbar-menu-btn[aria-expanded="true"] .topbar-menu-chevron {
  transform: rotate(180deg);
}

.utility-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: 226px;
  padding: 6px;
  border: 1px solid #d8e6e3;
  border-radius: 12px;
  background: #ffffff;
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.13),
    0 3px 10px rgba(15, 23, 42, 0.06);
}

.utility-menu-item {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 50px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #1f2937;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.utility-menu-item:hover:not(:disabled) {
  background: #eefdf8;
  color: #0f766e;
}

.utility-menu-item:disabled {
  cursor: wait;
  opacity: 0.72;
}

.utility-menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #ecfeff;
  color: #0d9488;
  font-size: 15px;
}

.utility-menu-item strong,
.utility-menu-item small {
  display: block;
}

.utility-menu-item strong {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}

.utility-menu-item small {
  margin-top: 2px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
}

.utility-spin {
  animation: utility-spin 0.85s linear infinite;
}

.utility-menu-fade-enter-active,
.utility-menu-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.utility-menu-fade-enter-from,
.utility-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes utility-spin {
  to { transform: rotate(360deg); }
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

@media (max-width: 768px) {
  .app-layout {
    --topbar-height: 60px;
  }

  .topbar {
    margin: 8px 8px 0;
    padding: 0 10px;
    gap: 8px;
    border-radius: 14px;
  }

  .topbar-left {
    gap: 8px;
  }

  .menu-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex: 0 0 36px;
  }

  .breadcrumb {
    gap: 6px;
    font-size: 13px;
  }

  .breadcrumb-item.current {
    max-width: 22vw;
  }

  .topbar-right {
    gap: 6px;
  }

  .topbar-pill {
    height: 34px;
    padding: 0 10px;
    gap: 5px;
    font-size: 12px;
  }

  .topbar-action,
  .topbar-menu-btn {
    height: 36px;
    padding: 0 12px;
    gap: 5px;
    border-radius: 10px;
    font-size: 12px;
  }

  .action-label--full {
    display: none;
  }

  .action-label--short {
    display: inline;
  }

  .topbar-menu-label {
    display: none;
  }

  .utility-menu {
    width: min(278px, calc(100vw - 24px));
  }

  .content-shell {
    margin: 8px 8px 12px;
    padding: 12px;
    border-radius: 14px;
  }
}

@media (max-width: 520px) {
  .breadcrumb-home span,
  .breadcrumb-separator {
    display: none;
  }

  .breadcrumb-item.current {
    max-width: 28vw;
  }
}

@media (max-width: 380px) {
  .topbar-pill {
    padding: 0 8px;
  }

  .topbar-action,
  .topbar-menu-btn {
    padding: 0 10px;
  }
}

/* Toast */
.release-notice-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(6px);
}

.release-notice-card {
  width: min(640px, 100%);
  max-height: min(760px, calc(100vh - 40px));
  overflow-y: auto;
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0 26px 80px rgba(15, 23, 42, 0.22),
    0 8px 24px rgba(15, 23, 42, 0.12);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.release-notice-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid #e2e8f0;
}

.release-notice-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #2563eb);
  box-shadow: 0 12px 24px rgba(13, 148, 136, 0.22);
  font-size: 20px;
}

.release-notice-title-block {
  min-width: 0;
}

.release-notice-kicker {
  margin: 0 0 4px;
  color: #0d9488;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.release-notice-title-block h2 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: 0;
}

.release-notice-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.2s ease, color 0.2s ease;
}

.release-notice-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.release-notice-groups {
  display: grid;
  gap: 14px;
  padding: 20px 24px 8px;
}

.release-notice-group {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

.release-notice-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-size: 14px;
}

.release-notice-group-title .app-icon {
  color: #0d9488;
  font-size: 16px;
}

.release-notice-group--improved .release-notice-group-title .app-icon {
  color: #2563eb;
}

.release-notice-group--fixed .release-notice-group-title .app-icon {
  color: #ea580c;
}

.release-notice-group ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 0 18px;
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

.release-notice-actions {
  display: flex;
  justify-content: flex-end;
  padding: 18px 24px 24px;
}

.release-notice-primary {
  min-width: 104px;
  height: 38px;
  padding: 0 18px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(13, 148, 136, 0.24);
}

.release-notice-primary:hover {
  background: linear-gradient(135deg, #0f766e, #115e59);
}

.release-notice-fade-enter-active,
.release-notice-fade-leave-active {
  transition: opacity 0.22s ease;
}

.release-notice-fade-enter-active .release-notice-card,
.release-notice-fade-leave-active .release-notice-card {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.release-notice-fade-enter-from,
.release-notice-fade-leave-to {
  opacity: 0;
}

.release-notice-fade-enter-from .release-notice-card,
.release-notice-fade-leave-to .release-notice-card {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 640px) {
  .release-notice-backdrop {
    align-items: flex-end;
    padding: 12px;
  }

  .release-notice-card {
    max-height: calc(100vh - 24px);
    border-radius: 14px;
  }

  .release-notice-head {
    padding: 18px 18px 14px;
    gap: 12px;
  }

  .release-notice-mark {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .release-notice-title-block h2 {
    font-size: 19px;
  }

  .release-notice-groups {
    padding: 16px 18px 6px;
  }

  .release-notice-actions {
    padding: 16px 18px 18px;
  }

  .release-notice-primary {
    width: 100%;
  }
}

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

.release-notice-close .app-icon,
.toast-close .app-icon {
  width: 16px;
  height: 16px;
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
