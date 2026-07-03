import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
  UpdateStatusCode,
} from '../../types/electronApi'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import {
  checkForUpdates,
  getBackendRuntimeVersion,
  getAppVersionInfo,
  getServerInstallerVersions,
  getUpdateStatusSnapshot,
  hasUpdateBridge,
  installUpdate,
  openTosDesktopDownload,
  openTosDesktopFullDownload,
  subscribeUpdateStatus,
} from './settingsApi'
import type { ServerInstallerVersions } from './settingsApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import { showAppAlert } from '../../shared/ui/appAlert'
import {
  openAutomationHelperDownload,
  probeLocalAutomationLauncherHealthPayload,
  syncLocalAutomationModules,
} from '../web-automation/webAutomationApi'
import type { LocalAutomationModuleSyncResult } from '../web-automation/webAutomationApi'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UpdateAction = '' | 'init' | 'check' | 'download' | 'install' | 'manual'
type HelperModuleSyncSummaryTone = 'info' | 'success' | 'warning' | 'danger'

interface HelperModuleSyncSummaryItem {
  key: string
  label: string
  value: number
  tone: HelperModuleSyncSummaryTone
}

export function useSettingsPageModel() {
  const versionInfo = ref<AppVersionInfo>({
    version: fallbackAppVersion,
    isPackaged: false,
  })
  const backendVersion = ref('')
  const serverInstallerVersions = ref<ServerInstallerVersions | null>(null)
  const status = ref<UpdateStatus | null>(null)
  const activeAction = ref<UpdateAction>('')
  const message = ref('')
  const messageTone = ref<NoticeTone>('info')
  const desktopInstallerDownloading = ref(false)
  const desktopFullInstallerDownloading = ref(false)
  const helperDownloading = ref(false)
  const helperUpdateChecking = ref(false)
  const helperUpdateChecked = ref(false)
  const helperLocalVersion = ref('')
  const helperUpdateError = ref('')
  const helperModuleSyncing = ref(false)
  const helperModuleSyncResult = ref<LocalAutomationModuleSyncResult | null>(null)
  const helperModuleSyncError = ref('')
  let unsubscribeUpdateStatus: (() => void) | undefined
  const { t, text } = useAppLanguage()
  
  const hasDesktopUpdateSupport = computed(() => hasUpdateBridge())
  
  const statusLabels: Record<UpdateStatusCode, string> = {
    idle: '待检查',
    checking: '检查中',
    'not-available': '已是最新',
    available: '发现新版本',
    downloading: '下载中',
    downloaded: '可安装',
    installing: '安装中',
    error: '更新异常',
    unsupported: '开发环境',
    'not-configured': '未配置',
  }
  
  const statusTones: Record<UpdateStatusCode, NoticeTone> = {
    idle: 'info',
    checking: 'info',
    'not-available': 'success',
    available: 'success',
    downloading: 'info',
    downloaded: 'success',
    installing: 'info',
    error: 'error',
    unsupported: 'warning',
    'not-configured': 'warning',
  }
  
  const feedSourceLabels: Record<string, string> = {
    env: '环境变量',
    'user-config': '本地配置',
    package: '打包配置',
    preview: '预览参考',
    'server-manifest': '服务器安装包',
    none: '未读取',
  }
  
  const currentVersion = computed(
    () => status.value?.currentVersion || versionInfo.value.version || backendVersion.value,
  )
  const latestVersion = computed(() => {
    const current = currentVersion.value
    const remote = status.value?.updateInfo?.version
  
    if (!current && !remote) return '-'
    if (!remote) return current ? formatDisplayVersion(current) : '-'
    if (!current) return formatDisplayVersion(remote)
  
    return compareVersionStrings(remote, current) >= 0
      ? formatDisplayVersion(remote)
      : formatDisplayVersion(current)
  })
  const statusLabel = computed(() => text(statusLabels[status.value?.status || 'idle']))
  const statusTone = computed(() => statusTones[status.value?.status || 'idle'])
  const runModeLabel = computed(() => {
    const isPackaged = status.value?.isPackaged ?? versionInfo.value.isPackaged
    return isPackaged ? text('安装版') : text('服务器 / 浏览器')
  })
  const feedUrl = computed(() => status.value?.feedUrl || '')
  const feedUrlText = computed(() => feedUrl.value || '-')
  const feedUrlSourceLabel = computed(() => {
    const rawSource = feedSourceLabels[status.value?.feedUrlSource || ''] || status.value?.feedUrlSource
    return rawSource ? text(rawSource) : ''
  })
  const noticeText = computed(() => message.value || status.value?.error || '')
  const noticeTone = computed(() => {
    if (message.value) return messageTone.value
    return statusTone.value
  })
  const progressPercent = computed(() => {
    const percent = status.value?.progress?.percent ?? 0
    return Math.max(0, Math.min(100, Math.round(percent)))
  })
  const downloadDetail = computed(() => {
    const progress = status.value?.progress
    if (!progress?.total) return text('正在准备下载信息')
    return `${formatBytes(progress.transferred || 0)} / ${formatBytes(progress.total)}`
  })
  const changelogGroups = computed(() => {
    const changelog = status.value?.changelog
    return [
      { key: 'added', title: text('新增'), items: changelog?.added ?? [] },
      { key: 'improved', title: text('优化'), items: changelog?.improved ?? [] },
      { key: 'fixed', title: text('修复'), items: changelog?.fixed ?? [] },
    ]
  })
  const hasCategorizedChangelog = computed(() =>
    changelogGroups.value.some((group) => group.items.length > 0),
  )
  const releaseNoteItems = computed(() => readReleaseNoteItems(status.value?.updateInfo?.releaseNotes))
  const manualDownload = computed(() => status.value?.manualDownload ?? null)
  const manualDownloadDetail = computed(() => {
    const file = manualDownload.value
    if (!file) return ''
  
    const version = file.version ? formatDisplayVersion(file.version) : '-'
    const size = file.size ? formatBytes(file.size) : '-'
    return `${file.label} · ${version} · ${size}`
  })
  const serverInstallerPackageRows = computed(() => {
    const packageMap = new Map(
      (serverInstallerVersions.value?.packages ?? []).map((packageInfo) => [packageInfo.id, packageInfo]),
    )
    return [
      {
        key: 'tos-desktop',
        label: '轻量安装器版本',
        packageInfo: packageMap.get('tos-desktop'),
      },
      {
        key: 'tos-desktop-full',
        label: '离线全量包版本',
        packageInfo: packageMap.get('tos-desktop-full'),
      },
      {
        key: 'automation-helper',
        label: '网页小助手版本',
        packageInfo: packageMap.get('automation-helper'),
      },
    ].map((item) => ({
      key: item.key,
      label: item.label,
      filename: item.packageInfo?.filename ?? '',
      versionLabel: item.packageInfo?.version ? formatDisplayVersion(item.packageInfo.version) : '-',
      source: item.packageInfo?.source ?? '',
    }))
  })
  const automationHelperPackage = computed(() =>
    serverInstallerVersions.value?.packages.find((packageInfo) => packageInfo.id === 'automation-helper') ?? null,
  )
  const helperUpdateCurrentRawVersion = computed(() => {
    if (helperLocalVersion.value) return helperLocalVersion.value
    return helperUpdateChecked.value ? '' : currentVersion.value
  })
  const helperUpdateServerRawVersion = computed(() =>
    automationHelperPackage.value?.version || serverInstallerVersions.value?.version || currentVersion.value,
  )
  const helperUpdateCurrentVersion = computed(() => {
    const version = helperUpdateCurrentRawVersion.value.trim()
    return version ? formatDisplayVersion(version) : text('未检测到')
  })
  const helperUpdateServerVersion = computed(() => {
    const version = helperUpdateServerRawVersion.value.trim()
    return version ? formatDisplayVersion(version) : '-'
  })
  const helperUpdateView = computed(() => {
    if (helperModuleSyncing.value) {
      return {
        label: '热更新中',
        tagType: 'info',
        message: '正在检测服务器自动化模块，并把最新功能逻辑同步到本机小助手。',
      }
    }

    if (helperUpdateChecking.value) {
      return {
        label: '检查中',
        tagType: 'info',
        message: '正在读取本机小助手壳子版本和服务器功能模块清单。',
      }
    }

    if (helperUpdateError.value) {
      return {
        label: '检查失败',
        tagType: 'danger',
        message: helperUpdateError.value,
      }
    }

    if (helperModuleSyncError.value) {
      return {
        label: '热更新失败',
        tagType: 'danger',
        message: helperModuleSyncError.value,
      }
    }

    if (helperModuleSyncResult.value) {
      const result = helperModuleSyncResult.value
      const installed = Number(result.installed || 0)
      const failed = Number(result.failed || 0)
      const blocked = Number(result.blocked || 0)
      const pendingRestart = Number(result.pendingRestart || 0)

      if (blocked > 0) {
        return {
          label: '壳子需更新',
          tagType: 'warning',
          message: '服务器功能模块要求更高版本的小助手壳子，请到下载中心安装最新完整包。',
        }
      }

      if (failed > 0 || result.ok === false) {
        return {
          label: '部分失败',
          tagType: 'danger',
          message: result.error || '部分自动化功能模块热更新失败，请稍后重试。',
        }
      }

      if (pendingRestart > 0) {
        return {
          label: '已下载待切换',
          tagType: 'warning',
          message: '新功能逻辑已下载。当前有执行器正在运行，本次任务结束后会自动切换到新模块。',
        }
      }

      if (installed > 0) {
        return {
          label: '热更新完成',
          tagType: 'success',
          message: '自动化功能逻辑已同步到本机小助手，无需重新下载安装包。',
        }
      }

      return {
        label: '已是最新',
        tagType: 'success',
        message: '自动化功能逻辑已经和服务器保持一致，无需重新下载安装包。',
      }
    }

    if (!helperUpdateChecked.value) {
      return {
        label: '待检查',
        tagType: 'info',
        message: '点击检查并热更新后，会先检测小助手壳子，再同步服务器最新功能逻辑。',
      }
    }

    const localVersion = helperLocalVersion.value.trim()
    if (!localVersion) {
      return {
        label: '未检测到',
        tagType: 'warning',
        message: '未检测到正在运行的本机小助手。请先启动小助手；如果仍然失败，请到下载中心安装最新完整包。',
      }
    }

    const serverVersion = helperUpdateServerRawVersion.value.trim()
    if (!serverVersion) {
      return {
        label: '服务器未知',
        tagType: 'warning',
        message: '暂时无法读取服务器小助手版本，请稍后重新检查。',
      }
    }

    const versionDiff = compareVersionStrings(localVersion, serverVersion)
    if (versionDiff < 0) {
      return {
        label: '壳子有新版',
        tagType: 'warning',
        message: '服务器已有新版小助手壳子。壳子能力变化无法靠热更新完成，请到下载中心安装最新完整包。',
      }
    }

    if (versionDiff > 0) {
      return {
        label: '本机较新',
        tagType: 'info',
        message: '本机小助手版本高于服务器记录，请确认服务器安装包清单是否已经更新。',
      }
    }

    return {
      label: '可热更新',
      tagType: 'success',
      message: '当前小助手壳子版本一致，可直接热更新里面的自动化功能逻辑。',
    }
  })
  const helperModuleSyncSummary = computed<HelperModuleSyncSummaryItem[]>(() => {
    const result = helperModuleSyncResult.value
    if (!result) return []

    const checked = Number(result.checked || 0)
    const installed = Number(result.installed || 0)
    const upToDate = Number(result.upToDate || 0)
    const pendingRestart = Number(result.pendingRestart || 0)
    const failed = Number(result.failed || 0)
    const blocked = Number(result.blocked || 0)
    return [
      { key: 'checked', label: '已检查', value: checked, tone: 'info' },
      { key: 'installed', label: '已更新', value: installed, tone: 'success' },
      { key: 'upToDate', label: '已最新', value: upToDate, tone: 'success' },
      { key: 'pendingRestart', label: '待切换', value: pendingRestart, tone: 'warning' },
      { key: 'failed', label: '失败', value: failed, tone: 'danger' },
      { key: 'blocked', label: '受限', value: blocked, tone: 'warning' },
    ]
  })
  const helperHotUpdateButtonText = computed(() =>
    helperModuleSyncing.value ? '热更新中...' : '检查并热更新功能模块',
  )
  const emptyChangelogText = computed(() => {
    if (status.value?.status === 'available' || status.value?.status === 'downloaded') {
      return '更新源暂未提供 changelog.json'
    }
    return '检查到新版本后会显示新增、优化和修复内容'
  })
  const canDownload = computed(() =>
    Boolean(status.value?.updateAvailable && !status.value.downloading && !status.value.downloaded),
  )
  const canInstall = computed(() => Boolean(status.value?.downloaded))
  const isActionLocked = computed(() =>
    Boolean(activeAction.value || status.value?.checking || status.value?.downloading),
  )
  
  const versionItems = computed(() => {
    const items = [{
      key: 'current',
      icon: 'check-circle',
      label: t('app.settings.currentVersion'),
      value: formatDisplayVersion(currentVersion.value),
      tone: 'teal',
      mono: false,
    }]
  
    if (hasDesktopUpdateSupport.value) {
      items.push({
        key: 'latest',
        icon: 'sparkles',
        label: t('app.settings.latestVersion'),
        value: latestVersion.value,
        tone: 'blue',
        mono: false,
      })
    }
  
    items.push({
      key: 'mode',
      icon: 'monitor-code',
      label: t('app.settings.runMode'),
      value: runModeLabel.value,
      tone: 'slate',
      mono: false,
    })
  
    return items
  })
  
  onMounted(() => {
    unsubscribeUpdateStatus = subscribeUpdateStatus((nextStatus) => {
      status.value = nextStatus
    })
    void loadSettings()
  })
  
  onBeforeUnmount(() => {
    unsubscribeUpdateStatus?.()
  })
  
  async function loadSettings(): Promise<void> {
    activeAction.value = 'init'
    message.value = ''
  
    try {
      const [nextVersionInfo, nextStatus, runtimeVersion, installerVersions] = await Promise.all([
        getAppVersionInfo(),
        getUpdateStatusSnapshot(),
        getBackendRuntimeVersion(),
        getServerInstallerVersions(),
      ])
      versionInfo.value = nextVersionInfo
      status.value = nextStatus
      backendVersion.value = runtimeVersion
      serverInstallerVersions.value = installerVersions
    } catch (error) {
      messageTone.value = 'error'
      message.value = readErrorMessage(error, '读取应用更新状态失败')
    } finally {
      activeAction.value = ''
    }
  }
  
  async function handleCheck(): Promise<void> {
    if (!hasDesktopUpdateSupport.value) {
      await loadSettings()
      messageTone.value = 'success'
      message.value = '运行参数已刷新，浏览器模式不支持桌面增量更新检测'
      return
    }

    await runUpdateAction('check', checkForUpdates)
  }
  
  async function handleDownload(): Promise<void> {
    if (activeAction.value) {
      return
    }

    activeAction.value = 'download'
    message.value = ''

    try {
      await openTosDesktopFullDownload()
      messageTone.value = 'info'
      message.value = '已交给浏览器下载完整安装包，右上角下载管理器会显示进度。'
    } catch (error) {
      messageTone.value = 'error'
      await showInstallerDownloadError(error, 'TOS 完整安装包下载失败')
    } finally {
      activeAction.value = ''
    }
  }
  
  async function handleInstall(): Promise<void> {
    await runUpdateAction('install', installUpdate)
  }
  
  async function handleManualDownload(): Promise<void> {
    if (activeAction.value) {
      return
    }

    activeAction.value = 'manual'
    message.value = ''

    try {
      await openTosDesktopDownload()
      messageTone.value = 'info'
      message.value = '已交给浏览器下载轻量安装包，右上角下载管理器会显示进度。'
    } catch (error) {
      messageTone.value = 'error'
      await showInstallerDownloadError(error, 'TOS 应用安装包下载失败')
    } finally {
      activeAction.value = ''
    }
  }

  async function handleDesktopInstallerDownload(): Promise<void> {
    desktopInstallerDownloading.value = true
    message.value = ''

    try {
      await openTosDesktopDownload()
      messageTone.value = 'info'
      message.value = '已交给浏览器下载 TOS 应用安装包，右上角下载管理器会显示进度。'
    } catch (error) {
      messageTone.value = 'error'
      await showInstallerDownloadError(error, 'TOS 应用安装包下载失败')
    } finally {
      desktopInstallerDownloading.value = false
    }
  }

  async function handleDesktopFullInstallerDownload(): Promise<void> {
    desktopFullInstallerDownloading.value = true
    message.value = ''

    try {
      await openTosDesktopFullDownload()
      messageTone.value = 'info'
      message.value = '已交给浏览器下载 TOS 完整安装包，右上角下载管理器会显示进度。'
    } catch (error) {
      messageTone.value = 'error'
      await showInstallerDownloadError(error, 'TOS 完整安装包下载失败')
    } finally {
      desktopFullInstallerDownloading.value = false
    }
  }
  
  async function handleHelperDownload(): Promise<void> {
    helperDownloading.value = true
    message.value = ''
  
    try {
      await openAutomationHelperDownload()
      messageTone.value = 'info'
      message.value = '已交给浏览器下载自动化助手安装包，右上角下载管理器会显示进度。'
    } catch (error) {
      messageTone.value = 'error'
      await showInstallerDownloadError(error, '自动化助手安装包下载失败')
    } finally {
      helperDownloading.value = false
    }
  }

  async function handleHelperUpdateCheck(): Promise<void> {
    if (helperUpdateChecking.value) {
      return
    }

    helperUpdateChecking.value = true
    helperUpdateError.value = ''
    helperModuleSyncError.value = ''

    try {
      const [installerVersions, launcherHealth] = await Promise.all([
        getServerInstallerVersions(),
        probeLocalAutomationLauncherHealthPayload(),
      ])
      serverInstallerVersions.value = installerVersions
      helperLocalVersion.value = String(
        launcherHealth?.helperVersion || launcherHealth?.version || '',
      ).trim()
      helperUpdateChecked.value = true
    } catch (error) {
      helperUpdateChecked.value = true
      helperUpdateError.value = readErrorMessage(error, '检查自动化助手版本失败')
    } finally {
      helperUpdateChecking.value = false
    }
  }

  async function handleHelperHotUpdate(): Promise<void> {
    if (helperModuleSyncing.value || helperUpdateChecking.value) {
      return
    }

    helperModuleSyncing.value = true
    helperUpdateError.value = ''
    helperModuleSyncError.value = ''
    helperModuleSyncResult.value = null
    message.value = ''

    try {
      const [installerVersions, launcherHealth] = await Promise.all([
        getServerInstallerVersions(),
        probeLocalAutomationLauncherHealthPayload(),
      ])
      serverInstallerVersions.value = installerVersions
      helperLocalVersion.value = String(
        launcherHealth?.helperVersion || launcherHealth?.version || '',
      ).trim()
      helperUpdateChecked.value = true

      if (!launcherHealth?.ok || !helperLocalVersion.value) {
        throw new Error('未检测到正在运行的本机小助手。请先启动小助手；如果仍然失败，请到下载中心安装最新完整包。')
      }

      const serverVersion = helperUpdateServerRawVersion.value.trim()
      if (serverVersion && compareVersionStrings(helperLocalVersion.value, serverVersion) < 0) {
        throw new Error('本机小助手壳子版本低于服务器最新版本。壳子能力变化不能热更新，请到下载中心安装最新完整包。')
      }

      const result = await syncLocalAutomationModules({ forceUpdate: true })
      helperModuleSyncResult.value = result

      if (result.ok === false) {
        throw new Error(result.error || '自动化功能模块热更新失败。')
      }

      messageTone.value = Number(result.pendingRestart || 0) > 0 ? 'warning' : 'success'
      message.value = buildHelperModuleSyncMessage(result)
    } catch (error) {
      const errorMessage = readErrorMessage(error, '自动化功能模块热更新失败')
      helperModuleSyncError.value = errorMessage
      messageTone.value = 'error'
      message.value = errorMessage
    } finally {
      helperModuleSyncing.value = false
    }
  }

  async function showInstallerDownloadError(error: unknown, fallback: string): Promise<void> {
    const errorMessage = readErrorMessage(error, fallback)
    message.value = errorMessage
    await showAppAlert(errorMessage, {
      title: '安装包下载失败',
      tone: 'error',
      confirmText: '我知道了',
    })
  }

  function handleExportRuntimeParams(): void {
    const exportedAt = new Date().toISOString()
    const exportPayload = {
      exportedAt,
      app: {
        currentVersion: currentVersion.value,
        latestVersion: latestVersion.value,
        backendVersion: backendVersion.value,
        runMode: runModeLabel.value,
        isPackaged: status.value?.isPackaged ?? versionInfo.value.isPackaged,
      },
      update: {
        status: status.value?.status ?? 'idle',
        statusLabel: statusLabel.value,
        updateAvailable: status.value?.updateAvailable ?? false,
        checking: status.value?.checking ?? false,
        downloading: status.value?.downloading ?? false,
        downloaded: status.value?.downloaded ?? false,
        feedUrl: feedUrlText.value,
        feedUrlSource: status.value?.feedUrlSource ?? '',
        feedUrlSourceLabel: feedUrlSourceLabel.value,
        error: status.value?.error ?? '',
      },
      installers: serverInstallerPackageRows.value.map((packageRow) => ({
        key: packageRow.key,
        label: packageRow.label,
        version: packageRow.versionLabel,
        filename: packageRow.filename,
        source: packageRow.source,
      })),
      environment: {
        hasDesktopUpdateSupport: hasDesktopUpdateSupport.value,
        userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      },
    }

    downloadJsonFile(
      exportPayload,
      `tos-runtime-params-${exportedAt.replace(/[:.]/g, '-')}.json`,
    )
    messageTone.value = 'success'
    message.value = '运行参数已导出'
  }
  
  async function runUpdateAction(
    action: Exclude<UpdateAction, '' | 'init'>,
    actionHandler: () => Promise<UpdateActionResult>,
  ): Promise<void> {
    activeAction.value = action
    message.value = ''
  
    try {
      const result = await actionHandler()
      status.value = result.status
  
      if (!result.success) {
        messageTone.value = statusTones[result.status.status] === 'warning' ? 'warning' : 'error'
        message.value = result.error || '更新操作失败'
        return
      }
  
      messageTone.value = readSuccessTone(result.status.status)
      message.value = readSuccessMessage(action, result.status)
    } catch (error) {
      messageTone.value = 'error'
      message.value = readErrorMessage(error, '更新操作失败')
    } finally {
      activeAction.value = ''
    }
  }
  
  function readSuccessTone(nextStatus: UpdateStatusCode): NoticeTone {
    return nextStatus === 'not-available' ? 'success' : 'info'
  }
  
  function readSuccessMessage(action: Exclude<UpdateAction, '' | 'init'>, nextStatus: UpdateStatus): string {
    if (action === 'check') {
      if (nextStatus.status === 'not-available') return '当前已经是最新版本'
      if (nextStatus.status === 'available') return '发现可用新版本'
      return '检查更新完成'
    }
  
    if (action === 'download') {
      return nextStatus.downloaded ? '更新包已下载完成' : '更新包开始下载'
    }
  
    if (action === 'manual') {
      return '已打开免安装版下载链接'
    }
  
    return '正在退出并安装更新'
  }
  
  function readReleaseNoteItems(notes: unknown): string[] {
    if (typeof notes === 'string') {
      return notes.trim() ? [notes.trim()] : []
    }
  
    if (!Array.isArray(notes)) {
      return []
    }
  
    return notes
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'note' in item) {
          const note = (item as { note?: unknown }).note
          return typeof note === 'string' ? note : ''
        }
        return ''
      })
      .filter((item) => item.trim())
  }
  
  function readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message
    }
  
    return fallback
  }

  function buildHelperModuleSyncMessage(result: LocalAutomationModuleSyncResult): string {
    const installed = Number(result.installed || 0)
    const pendingRestart = Number(result.pendingRestart || 0)
    const failed = Number(result.failed || 0)
    const blocked = Number(result.blocked || 0)

    if (blocked > 0) {
      return '部分模块要求更新小助手壳子，请到下载中心安装最新完整包。'
    }

    if (failed > 0) {
      return '部分自动化模块热更新失败，请稍后重试。'
    }

    if (pendingRestart > 0) {
      return '新功能逻辑已下载。当前有执行器正在运行，任务结束后会自动切换。'
    }

    if (installed > 0) {
      return '自动化功能模块热更新完成。'
    }

    return '自动化功能模块已经是最新。'
  }

  function downloadJsonFile(payload: unknown, filename: string): void {
    if (typeof document === 'undefined') {
      return
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }
  
  function formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0 MB'
    }
  
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }
  
  function formatDisplayVersion(version: string): string {
    const normalized = version.trim().replace(/^v/i, '')
    return normalized ? `V${normalized}` : '-'
  }
  
  function compareVersionStrings(left: string, right: string): number {
    const leftVersion = parseVersion(left)
    const rightVersion = parseVersion(right)
  
    for (let index = 0; index < 3; index += 1) {
      const diff = leftVersion.main[index] - rightVersion.main[index]
      if (diff !== 0) return diff
    }
  
    if (!leftVersion.pre.length && rightVersion.pre.length) return 1
    if (leftVersion.pre.length && !rightVersion.pre.length) return -1
  
    const maxLength = Math.max(leftVersion.pre.length, rightVersion.pre.length)
    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = leftVersion.pre[index]
      const rightPart = rightVersion.pre[index]
  
      if (leftPart === undefined) return -1
      if (rightPart === undefined) return 1
      if (leftPart === rightPart) continue
  
      if (typeof leftPart === 'number' && typeof rightPart === 'number') return leftPart - rightPart
      if (typeof leftPart === 'number') return -1
      if (typeof rightPart === 'number') return 1
      return String(leftPart).localeCompare(String(rightPart), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    }
  
    return 0
  }
  
  function parseVersion(version: string): { main: number[]; pre: Array<string | number> } {
    const normalized = version.replace(/^v/i, '')
    const [mainText, preText = ''] = normalized.split('-', 2)
    const main = mainText
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10))
  
    while (main.length < 3) {
      main.push(0)
    }
  
    return {
      main: main.map((part) => (Number.isFinite(part) ? part : 0)),
      pre: preText
        .split(/[.-]/)
        .filter(Boolean)
        .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase())),
    }
  }

  return {
    activeAction,
    canDownload,
    canInstall,
    changelogGroups,
    currentVersion,
    desktopFullInstallerDownloading,
    desktopInstallerDownloading,
    downloadDetail,
    emptyChangelogText,
    feedUrlSourceLabel,
    feedUrlText,
    handleCheck,
    handleDesktopFullInstallerDownload,
    handleDesktopInstallerDownload,
    handleDownload,
    handleExportRuntimeParams,
    handleHelperDownload,
    handleHelperHotUpdate,
    handleHelperUpdateCheck,
    handleInstall,
    handleManualDownload,
    hasCategorizedChangelog,
    hasDesktopUpdateSupport,
    helperDownloading,
    helperHotUpdateButtonText,
    helperModuleSyncing,
    helperModuleSyncSummary,
    helperUpdateChecking,
    helperUpdateCurrentVersion,
    helperUpdateServerVersion,
    helperUpdateView,
    isActionLocked,
    latestVersion,
    manualDownload,
    manualDownloadDetail,
    message,
    noticeText,
    noticeTone,
    progressPercent,
    releaseNoteItems,
    runModeLabel,
    serverInstallerPackageRows,
    serverInstallerVersions,
    status,
    statusLabel,
    statusTone,
    t,
    text,
    versionItems,
  }
}
