import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
} from '../../types/electronApi'
import { getBackendBaseUrl } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'

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
    const backendBaseUrl = await getBackendBaseUrl()
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
