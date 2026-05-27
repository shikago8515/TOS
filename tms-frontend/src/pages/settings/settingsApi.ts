import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
} from '../../types/electronApi'

const fallbackVersion = '0.9.7-beta.1.1'

export function hasUpdateBridge(): boolean {
  return Boolean(window.electronAPI?.getUpdateStatus)
}

export async function getAppVersionInfo(): Promise<AppVersionInfo> {
  if (!window.electronAPI?.getAppVersion) {
    return {
      version: fallbackVersion,
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

export function subscribeUpdateStatus(callback: (status: UpdateStatus) => void): () => void {
  return window.electronAPI?.onUpdateStatus?.(callback) ?? (() => {})
}

function buildUnsupportedResult(): UpdateActionResult {
  return {
    success: false,
    error: '当前运行环境不支持应用更新',
    status: buildUnsupportedStatus(),
  }
}

function buildUnsupportedStatus(): UpdateStatus {
  // 浏览器预览时没有 Electron bridge，页面仍保留可渲染的版本状态。
  return {
    status: 'unsupported',
    currentVersion: fallbackVersion,
    isPackaged: false,
    feedUrl: '',
    feedUrlSource: 'none',
    updateAvailable: false,
    checking: false,
    downloading: false,
    downloaded: false,
    updateInfo: null,
    changelog: null,
    progress: null,
    error: '当前运行环境不支持应用更新',
  }
}
