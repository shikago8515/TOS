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
  downloadUpdate,
  getAppVersionInfo,
  getUpdateStatusSnapshot,
  hasUpdateBridge,
  installUpdate,
  openManualDownload,
  subscribeUpdateStatus,
} from './settingsApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import { openAutomationHelperDownload } from '../web-automation/webAutomationApi'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UpdateAction = '' | 'init' | 'check' | 'download' | 'install' | 'manual'

export function useSettingsPageModel() {
  const versionInfo = ref<AppVersionInfo>({
    version: fallbackAppVersion,
    isPackaged: false,
  })
  const status = ref<UpdateStatus | null>(null)
  const activeAction = ref<UpdateAction>('')
  const message = ref('')
  const messageTone = ref<NoticeTone>('info')
  const helperDownloading = ref(false)
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
    none: '未读取',
  }
  
  const currentVersion = computed(() => status.value?.currentVersion || versionInfo.value.version)
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
      const [nextVersionInfo, nextStatus] = await Promise.all([
        getAppVersionInfo(),
        getUpdateStatusSnapshot(),
      ])
      versionInfo.value = nextVersionInfo
      status.value = nextStatus
    } catch (error) {
      messageTone.value = 'error'
      message.value = readErrorMessage(error, '读取应用更新状态失败')
    } finally {
      activeAction.value = ''
    }
  }
  
  async function handleCheck(): Promise<void> {
    await runUpdateAction('check', checkForUpdates)
  }
  
  async function handleDownload(): Promise<void> {
    await runUpdateAction('download', downloadUpdate)
  }
  
  async function handleInstall(): Promise<void> {
    await runUpdateAction('install', installUpdate)
  }
  
  async function handleManualDownload(): Promise<void> {
    await runUpdateAction('manual', openManualDownload)
  }
  
  async function handleHelperDownload(): Promise<void> {
    helperDownloading.value = true
    message.value = ''
  
    try {
      await openAutomationHelperDownload()
      messageTone.value = 'info'
      message.value = '已打开自动化助手安装包下载。'
    } catch (error) {
      messageTone.value = 'error'
      message.value = readErrorMessage(error, '自动化助手安装包下载失败')
    } finally {
      helperDownloading.value = false
    }
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
    downloadDetail,
    emptyChangelogText,
    feedUrlSourceLabel,
    feedUrlText,
    handleCheck,
    handleDownload,
    handleHelperDownload,
    handleInstall,
    handleManualDownload,
    hasCategorizedChangelog,
    hasDesktopUpdateSupport,
    helperDownloading,
    isActionLocked,
    manualDownload,
    manualDownloadDetail,
    message,
    noticeText,
    noticeTone,
    progressPercent,
    releaseNoteItems,
    status,
    statusLabel,
    statusTone,
    t,
    text,
    versionItems,
  }
}
