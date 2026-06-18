import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
import {
  buildReleaseNoticeGroups,
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

export function useAppShellModel() {
  const route = useRoute()
  const router = useRouter()
  const isSidebarHidden = ref(false)
  const isMobile = ref(false)
  const expandedNavGroups = ref<Set<TosModuleGroup>>(new Set(['jessica', 'sophia', 'jane', 'eric', 'jason', 'finance-excel']))
  const expandedCategories = ref<Set<string>>(new Set())
  const { isEnglish, t, text } = useAppLanguage()
  const profileMenuRef = ref<HTMLElement | null>(null)
  const profileMenuOpen = ref(false)
  
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

    return buildReleaseNoticeGroups(notes, text)
  })
  
  const hasUnseenReleaseNotes = computed(() => {
    return releaseNotice.value.visible && releaseNotice.value.releaseNotes !== null
  })

  function showToast(type: ToastState['type'], icon: string, title: string, message: string): void {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = { visible: true, type, icon, title, message }
    toastTimer = setTimeout(() => { toast.value.visible = false }, 4000)
  }
  
  function dismissReleaseNotice(): void {
    if (releaseNotice.value.releaseNotes) {
      markReleaseNoticeSeen(window.localStorage, undefined, releaseNotice.value.releaseNotes)
    }
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
  
  function toggleProfileMenu(): void {
    profileMenuOpen.value = !profileMenuOpen.value
  }

  function closeProfileMenu(): void {
    profileMenuOpen.value = false
  }

  function openSettingsPage(): void {
    closeProfileMenu()
    void router.push('/settings')
  }

  function openReleaseUpdatesPage(): void {
    closeProfileMenu()
    void router.push('/release-updates')
  }

  function handleTopbarDocumentClick(event: MouseEvent): void {
    if (!profileMenuOpen.value) return
    const target = event.target
    if (target instanceof Node && profileMenuRef.value?.contains(target)) {
      return
    }
    closeProfileMenu()
  }

  function handleTopbarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      closeProfileMenu()
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
      jason: 'file-search',
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
      'jason-pdf-reorder': 'file-search',
      'po-auto-download': 'download-cloud',
      'draft-packing-compare': 'file-search',
      'browser-plugins': 'puzzle',
      'web-automation': 'workflow',
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

  return {
    dismissReleaseNotice,
    displayDate,
    expandedCategories,
    getCategoryLabel,
    getModuleIcon,
    getModuleNavLabel,
    hasUnseenReleaseNotes,
    isMobile,
    isModuleActive,
    isNavGroupExpanded,
    isSidebarHidden,
    openReleaseUpdatesPage,
    openSettingsPage,
    pageTitle,
    releaseNotice,
    releaseNoticeCloseLabel,
    releaseNoticeConfirmLabel,
    releaseNoticeGroups,
    releaseNoticeTitle,
    releaseNoticeVersionLabel,
    sidebarGroups,
    sidebarToggleLabel,
    text,
    toast,
    toggleCategory,
    toggleNavGroup,
    toggleSidebar,
    toggleProfileMenu,
    profileMenuOpen,
    profileMenuRef,
  }
}
