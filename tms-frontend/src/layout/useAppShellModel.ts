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
import {
  getAppVersionInfo,
  getServerInstallerVersions,
  openTosDesktopFullDownload,
  type ServerInstallerPackage,
} from '../pages/settings/settingsApi'

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
  let installerUpdateTimer: number | null = null
  
  const releaseNotice = ref<ReleaseNoticeState>({ visible: false, releaseNotes: null })
  const installerUpdate = ref({
    checking: false,
    downloading: false,
    currentVersion: '',
    latestVersion: '',
    packageInfo: null as ServerInstallerPackage | null,
    checkedAt: null as Date | null,
    error: '',
    notifiedVersion: '',
  })
  
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

  const hasInstallerUpdate = computed(() => {
    const { latestVersion, currentVersion } = installerUpdate.value
    return Boolean(latestVersion) && compareVersionStrings(latestVersion, currentVersion) > 0
  })

  const installerUpdateLabel = computed(() => formatDisplayVersion(installerUpdate.value.latestVersion))

  const installerUpdateTitle = computed(() => {
    if (hasInstallerUpdate.value) {
      return text(`发现安装包更新 ${installerUpdateLabel.value}，点击下载最新版完整安装包`)
    }
    if (installerUpdate.value.checking) {
      return text('正在检查安装包版本')
    }
    return text('安装包已是最新版本')
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
      if (activeModule.id === 'automation-runs') {
        return text('自动化执行档案')
      }
      if (activeModule.id === 'automation-templates') {
        return text('Excel 模板中心')
      }
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
    if (module.id === 'settings' || module.id === 'automation-runs' || module.id === 'automation-templates') {
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

  function openAutomationRunsPage(): void {
    closeProfileMenu()
    void router.push('/automation-runs')
  }

  function openAutomationTemplatesPage(): void {
    closeProfileMenu()
    void router.push('/automation-templates')
  }

  function openReleaseUpdatesPage(): void {
    closeProfileMenu()
    void router.push('/release-updates')
  }

  async function refreshInstallerUpdateHint(silent = true): Promise<void> {
    if (!isDesktopRuntime() || installerUpdate.value.checking) {
      return
    }

    installerUpdate.value = {
      ...installerUpdate.value,
      checking: true,
      error: '',
    }

    try {
      const [appVersionInfo, serverVersions] = await Promise.all([
        getAppVersionInfo(),
        getServerInstallerVersions(),
      ])
      const desktopFullPackage = serverVersions.packages.find((item) => item.id === 'tos-desktop-full')
      const desktopPackage = serverVersions.packages.find((item) => item.id === 'tos-desktop')
      const packageInfo = desktopFullPackage || desktopPackage || null
      const currentVersion = appVersionInfo.version || ''
      const latestVersion = packageInfo?.version || serverVersions.version || ''
      const nextState = {
        ...installerUpdate.value,
        checking: false,
        currentVersion,
        latestVersion,
        packageInfo,
        checkedAt: new Date(),
        error: '',
      }
      installerUpdate.value = nextState

      if (packageInfo && compareVersionStrings(latestVersion, currentVersion) > 0) {
        const versionKey = latestVersion.trim()
        if (!silent || installerUpdate.value.notifiedVersion !== versionKey) {
          showToast(
            'warning',
            'download-cloud',
            text('发现安装包更新'),
            text(`服务器已有 ${formatDisplayVersion(latestVersion)}，可从右上角下载最新版完整安装包。`),
          )
          installerUpdate.value = {
            ...installerUpdate.value,
            notifiedVersion: versionKey,
          }
        }
      } else if (!silent) {
        showToast(
          'info',
          'check-circle',
          text('已是最新版本'),
          text('当前桌面端安装包版本已和服务器保持一致。'),
        )
      }
    } catch (error) {
      installerUpdate.value = {
        ...installerUpdate.value,
        checking: false,
        error: error instanceof Error ? error.message : String(error),
      }
      if (!silent) {
        showToast(
          'error',
          'alert-circle',
          text('检查更新失败'),
          text('无法连接服务器安装包版本清单，请稍后再试。'),
        )
      }
    }
  }

  async function downloadInstallerUpdate(): Promise<void> {
    if (!hasInstallerUpdate.value || installerUpdate.value.downloading) {
      return
    }

    installerUpdate.value = {
      ...installerUpdate.value,
      downloading: true,
    }

    try {
      await openTosDesktopFullDownload()
      showToast(
        'info',
        'download-cloud',
        text('已开始下载安装包'),
        text(`正在下载 ${installerUpdateLabel.value || text('最新版本')} 完整安装包，下载完成后请按安装向导覆盖安装。`),
      )
    } catch (_error) {
      showToast(
        'error',
        'alert-circle',
        text('下载安装包失败'),
        text('无法打开服务器安装包下载，请检查网络或稍后重试。'),
      )
    } finally {
      installerUpdate.value = {
        ...installerUpdate.value,
        downloading: false,
      }
    }
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
      'iplex-dual-table-compare': 'database',
      'shipping-automation': 'globe',
      'xinlongtai-shipping-automation': 'globe',
      'tc-inv-automation': 'workflow',
      'po-auto-download': 'download-cloud',
      'draft-packing-compare': 'file-search',
      'web-automation': 'workflow',
      'jane-sap': 'server',
      'eric-infornexus': 'globe',
      'adidas-materials': 'package',
      'automation-runs': 'database',
      'automation-templates': 'files',
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
    void refreshInstallerUpdateHint(true)
    installerUpdateTimer = window.setInterval(() => {
      void refreshInstallerUpdateHint(true)
    }, 30 * 60 * 1000)
    window.addEventListener('resize', handleResize)
    document.addEventListener('click', handleTopbarDocumentClick)
    document.addEventListener('keydown', handleTopbarKeydown)
  })
  
  onBeforeUnmount(() => {
    if (installerUpdateTimer) {
      window.clearInterval(installerUpdateTimer)
      installerUpdateTimer = null
    }
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
    hasInstallerUpdate,
    hasUnseenReleaseNotes,
    installerUpdate,
    installerUpdateLabel,
    installerUpdateTitle,
    isMobile,
    isModuleActive,
    isNavGroupExpanded,
    isSidebarHidden,
    openAutomationRunsPage,
    openAutomationTemplatesPage,
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
    downloadInstallerUpdate,
    refreshInstallerUpdateHint,
    toggleCategory,
    toggleNavGroup,
    toggleSidebar,
    toggleProfileMenu,
    profileMenuOpen,
    profileMenuRef,
  }
}

function isDesktopRuntime(): boolean {
  return Boolean(window.electronAPI?.getAppVersion)
}

function formatDisplayVersion(version: string): string {
  const normalized = version.trim()
  if (!normalized) {
    return ''
  }
  return /^v/i.test(normalized) ? normalized : `V${normalized}`
}

function compareVersionStrings(left: string, right: string): number {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)
  const mainLength = Math.max(leftVersion.main.length, rightVersion.main.length, 3)

  for (let index = 0; index < mainLength; index += 1) {
    const leftPart = leftVersion.main[index] || 0
    const rightPart = rightVersion.main[index] || 0
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1
    }
  }

  if (leftVersion.pre.length === 0 && rightVersion.pre.length > 0) return 1
  if (leftVersion.pre.length > 0 && rightVersion.pre.length === 0) return -1

  const preLength = Math.max(leftVersion.pre.length, rightVersion.pre.length)
  for (let index = 0; index < preLength; index += 1) {
    const leftPart = leftVersion.pre[index]
    const rightPart = rightVersion.pre[index]
    if (leftPart === undefined && rightPart !== undefined) return -1
    if (leftPart !== undefined && rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumber = Number(leftPart)
    const rightNumber = Number(rightPart)
    const leftNumeric = Number.isFinite(leftNumber) && String(leftNumber) === leftPart
    const rightNumeric = Number.isFinite(rightNumber) && String(rightNumber) === rightPart

    if (leftNumeric && rightNumeric) return leftNumber > rightNumber ? 1 : -1
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return String(leftPart).localeCompare(String(rightPart))
  }

  return 0
}

function parseVersion(version: string): { main: number[]; pre: string[] } {
  const normalized = version
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
  const [mainPart = '', prePart = ''] = normalized.split('-', 2)
  const main = mainPart
    .split('.')
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) ? part : 0))
  const pre = prePart
    ? prePart.split('.').map((part) => part.trim()).filter(Boolean)
    : []

  return { main, pre }
}
