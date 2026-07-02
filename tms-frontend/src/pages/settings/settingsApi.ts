import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
} from '../../types/electronApi'
import {
  buildBackendDownloadUrl,
  getBackendBaseUrl,
  openUrlAsBrowserDownload,
} from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'

const defaultTosDesktopDownloadPath = '/api/system/config/tos-desktop/download'
const defaultTosDesktopFullDownloadPath = '/api/system/config/tos-desktop-full/download'
const installerVersionsPath = '/api/system/config/installer-versions'

export interface ServerInstallerPackage {
  id: string
  label: string
  version: string
  filename: string
  downloadPath: string
  bucket: string
  objectKey: string
  contentType: string
  fileSize?: number | null
  sha256?: string | null
  updatedAt?: string | null
  versionedObjectKey?: string | null
  defaultFilename?: string | null
  source?: string
}

export interface ServerInstallerVersions {
  ok: boolean
  version: string
  manifestUpdatedAt?: string | null
  packages: ServerInstallerPackage[]
}

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
  return readServerManifestVersion()
}

export async function getServerInstallerVersions(): Promise<ServerInstallerVersions> {
  try {
    const backendBaseUrl = await getVersionBackendBaseUrl(installerVersionsPath)
    const response = await fetch(`${backendBaseUrl}${installerVersionsPath}`)

    if (!response.ok) {
      return buildFallbackInstallerVersions()
    }

    const payload = await response.json() as Partial<ServerInstallerVersions>
    return {
      ok: payload.ok === true,
      version: typeof payload.version === 'string' && payload.version.trim()
        ? payload.version.trim()
        : fallbackAppVersion,
      manifestUpdatedAt: typeof payload.manifestUpdatedAt === 'string'
        ? payload.manifestUpdatedAt
        : null,
      packages: Array.isArray(payload.packages)
        ? payload.packages.map(normalizeServerInstallerPackage).filter(isServerInstallerPackage)
        : [],
    }
  } catch (_error) {
    return buildFallbackInstallerVersions()
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
  openUrlAsBrowserDownload(downloadUrl, 'TOS-Desktop-Setup.exe')
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
  openUrlAsBrowserDownload(downloadUrl, 'TOS-Desktop-Full-Setup.exe')
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
  return readServerManifestVersion()
}

async function readServerManifestVersion(): Promise<string> {
  try {
    const backendBaseUrl = await getVersionBackendBaseUrl(installerVersionsPath)
    const response = await fetch(`${backendBaseUrl}${installerVersionsPath}`)

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

function buildFallbackInstallerVersions(): ServerInstallerVersions {
  return {
    ok: false,
    version: fallbackAppVersion,
    manifestUpdatedAt: null,
    packages: [],
  }
}

function normalizeServerInstallerPackage(packageInfo: unknown): ServerInstallerPackage | null {
  if (!packageInfo || typeof packageInfo !== 'object') {
    return null
  }

  const value = packageInfo as Record<string, unknown>
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (!id) {
    return null
  }

  return {
    id,
    label: typeof value.label === 'string' ? value.label : '',
    version: typeof value.version === 'string' ? value.version : '',
    filename: typeof value.filename === 'string' ? value.filename : '',
    downloadPath: typeof value.downloadPath === 'string' ? value.downloadPath : '',
    bucket: typeof value.bucket === 'string' ? value.bucket : '',
    objectKey: typeof value.objectKey === 'string' ? value.objectKey : '',
    contentType: typeof value.contentType === 'string' ? value.contentType : '',
    fileSize: typeof value.fileSize === 'number' ? value.fileSize : null,
    sha256: typeof value.sha256 === 'string' ? value.sha256 : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    versionedObjectKey: typeof value.versionedObjectKey === 'string' ? value.versionedObjectKey : null,
    defaultFilename: typeof value.defaultFilename === 'string' ? value.defaultFilename : null,
    source: typeof value.source === 'string' ? value.source : '',
  }
}

function isServerInstallerPackage(packageInfo: ServerInstallerPackage | null): packageInfo is ServerInstallerPackage {
  return packageInfo !== null
}

async function getVersionBackendBaseUrl(path = ''): Promise<string> {
  const configuredUrl = import.meta.env.VITE_BACKEND_URL
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '')
  }

  return getBackendBaseUrl('default', path)
}
