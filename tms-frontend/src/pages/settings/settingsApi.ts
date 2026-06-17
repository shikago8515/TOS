import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
} from '../../types/electronApi'
import { buildBackendDownloadUrl, getBackendBaseUrl } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'

const defaultTosDesktopDownloadPath = 'https://ai.tomwell.net:56130/tos/tos-desktop/download'
const defaultTosDesktopFullDownloadPath = 'https://ai.tomwell.net:56130/tos/tos-desktop-full/download'
const defaultServerBackendBaseUrl = 'https://ai.tomwell.net:56130/tos/desktop-api'

export function hasUpdateBridge(): boolean {
  return Boolean(window.electronAPI?.getUpdateStatus)
}

export async function getAppVersionInfo(): Promise<AppVersionInfo> {
  if (!window.electronAPI?.getAppVersion) {
    return {
      version: await readBrowserAppVersion(),
      isPackaged: false,
    }
  }

  return window.electronAPI.getAppVersion()
}

/**
 * 始终从后端运行时获取版本号，保证与版本更新页面显示一致。
 * 不依赖 Electron bridge，避免打包版本与后端运行时版本不同步。
 */
export async function getBackendRuntimeVersion(): Promise<string> {
  try {
    const backendBaseUrl = await getVersionBackendBaseUrl()
    const response = await fetch(`${backendBaseUrl}/`)

    if (!response.ok) {
      return fallbackAppVersion
    }

    const payload = await response.json() as { version?: unknown }
    return typeof payload.version === 'string' && payload.version.trim()
      ? payload.version.trim()
      : fallbackAppVersion
  } catch (_error) {
    return fallbackAppVersion
  }
}

export async function getUpdateStatusSnapshot(): Promise<UpdateStatus> {
  if (!window.electronAPI?.getUpdateStatus) {
    return buildUnsupportedStatus()
  }

  return window.electronAPI.getUpdateStatus()
}

export async function checkForUpdates(): Promise<UpdateActionResult> {
  if (!window.electronAPI?.checkForUpdates) {
    return buildUnsupportedResult()
  }

  return window.electronAPI.checkForUpdates()
}

export async function downloadUpdate(): Promise<UpdateActionResult> {
  if (!window.electronAPI?.downloadUpdate) {
    return buildUnsupportedResult()
  }

  return window.electronAPI.downloadUpdate()
}

export async function installUpdate(): Promise<UpdateActionResult> {
  if (!window.electronAPI?.installUpdate) {
    return buildUnsupportedResult()
  }

  return window.electronAPI.installUpdate()
}

export async function openManualDownload(): Promise<UpdateActionResult> {
  if (!window.electronAPI?.openManualDownload) {
    return buildUnsupportedResult()
  }

  return window.electronAPI.openManualDownload()
}

export function subscribeUpdateStatus(callback: (status: UpdateStatus) => void): () => void {
  return window.electronAPI?.onUpdateStatus?.(callback) ?? (() => {})
}

export function getTosDesktopDownloadUrl(): string {
  const configuredUrl = import.meta.env.VITE_TOS_DESKTOP_DOWNLOAD_URL
  return typeof configuredUrl === 'string' && configuredUrl.trim()
    ? configuredUrl.trim()
    : defaultTosDesktopDownloadPath
}

export async function resolveTosDesktopDownloadUrl(): Promise<string> {
  const configuredUrl = getTosDesktopDownloadUrl()
  return configuredUrl.startsWith('/api/')
    ? buildBackendDownloadUrl(configuredUrl)
    : configuredUrl
}

export async function openTosDesktopDownload(): Promise<void> {
  const downloadUrl = await resolveTosDesktopDownloadUrl()
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.rel = 'noopener'
  anchor.download = ''
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export function getTosDesktopFullDownloadUrl(): string {
  const configuredUrl = import.meta.env.VITE_TOS_DESKTOP_FULL_DOWNLOAD_URL
  return typeof configuredUrl === 'string' && configuredUrl.trim()
    ? configuredUrl.trim()
    : defaultTosDesktopFullDownloadPath
}

export async function resolveTosDesktopFullDownloadUrl(): Promise<string> {
  const configuredUrl = getTosDesktopFullDownloadUrl()
  return configuredUrl.startsWith('/api/')
    ? buildBackendDownloadUrl(configuredUrl)
    : configuredUrl
}

export async function openTosDesktopFullDownload(): Promise<void> {
  const downloadUrl = await resolveTosDesktopFullDownloadUrl()
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.rel = 'noopener'
  anchor.download = ''
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

async function buildUnsupportedResult(): Promise<UpdateActionResult> {
  return {
    success: false,
    error: '当前运行环境不支持应用更新',
    status: await buildUnsupportedStatus(),
  }
}

async function buildUnsupportedStatus(): Promise<UpdateStatus> {
  const currentVersion = await readBrowserAppVersion()

  // 服务器/浏览器模式没有 Electron bridge，仅保留版本快照，不暴露桌面更新源。
  return {
    status: 'unsupported',
    currentVersion,
    isPackaged: false,
    feedUrl: '',
    feedUrlSource: 'none',
    updateAvailable: false,
    checking: false,
    downloading: false,
    downloaded: false,
    updateInfo: null,
    manualDownload: null,
    changelog: null,
    progress: null,
    error: '',
  }
}

async function readBrowserAppVersion(): Promise<string> {
  try {
    const backendBaseUrl = await getVersionBackendBaseUrl()
    const response = await fetch(`${backendBaseUrl}/`)

    if (!response.ok) {
      return fallbackAppVersion
    }

    const payload = await response.json() as { version?: unknown }
    return typeof payload.version === 'string' && payload.version.trim()
      ? payload.version.trim()
      : fallbackAppVersion
  } catch (_error) {
    return fallbackAppVersion
  }
}

async function getVersionBackendBaseUrl(): Promise<string> {
  if (window.electronAPI?.startBackendServer || window.electronAPI?.getBackendUrl) {
    return getBackendBaseUrl()
  }

  const configuredUrl = import.meta.env.VITE_BACKEND_URL
  return typeof configuredUrl === 'string' && configuredUrl.trim()
    ? configuredUrl.trim().replace(/\/$/, '')
    : defaultServerBackendBaseUrl
}
