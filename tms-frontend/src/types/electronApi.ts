export interface ElectronActionResult {
  success: boolean
  error?: string
  url?: string
  command?: string
  mode?: string
  alreadyOpen?: boolean
  alreadyRunning?: boolean
  browser?: string
  expectedVersion?: string
  missingPaths?: string[]
  port?: number
  profileDir?: string
  remote?: boolean
  version?: string
  versionMismatch?: boolean
}

export interface DirectorySelectionResult {
  success: boolean
  canceled?: boolean
  path?: string
  error?: string
}

export interface ExternalModuleInfo {
  id: string
  name: string
  description: string
  available: boolean
  path?: string
  executablePath?: string
}

export interface BrowserPluginInfo {
  id: string
  name: string
  description: string
  provider?: string
  category: string
  version?: string
  available: boolean
  browserAvailable: boolean
  previewOnly?: boolean
  targetUrl?: string
  matchPatterns: string[]
}

export interface AutomationAppInfo {
  id: string
  name: string
  description: string
  provider?: string
  category?: string
  version?: string
  available: boolean
  running: boolean
  port?: number
  url: string
}

export interface DiagnosticEvent {
  module?: string
  action: string
  payload?: unknown
}

export interface AppVersionInfo {
  version: string
  isPackaged: boolean
}

export interface UpdateInfo {
  version: string
  releaseName?: string
  releaseDate?: string
  releaseNotes?: unknown
}

export interface UpdateChangelog {
  version: string
  date?: string
  added: string[]
  improved: string[]
  fixed: string[]
}

export interface ManualDownloadInfo {
  type: 'windows-x64-unpacked'
  label: string
  version: string
  url: string
  sha512?: string
  size?: number
}

export interface UpdateProgress {
  percent: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}

export type UpdateStatusCode =
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'unsupported'
  | 'not-configured'

export interface UpdateStatus {
  status: UpdateStatusCode
  currentVersion: string
  isPackaged: boolean
  feedUrl: string
  feedUrlSource: string
  updateAvailable: boolean
  checking: boolean
  downloading: boolean
  downloaded: boolean
  updateInfo: UpdateInfo | null
  manualDownload: ManualDownloadInfo | null
  changelog: UpdateChangelog | null
  progress: UpdateProgress | null
  error: string | null
}

export interface UpdateActionResult {
  success: boolean
  error?: string
  url?: string
  status: UpdateStatus
}

export interface ElectronApi {
  getBackendUrl(): Promise<string>
  startBackendServer(): Promise<ElectronActionResult>
  getAppVersion(): Promise<AppVersionInfo>
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<UpdateActionResult>
  downloadUpdate(): Promise<UpdateActionResult>
  installUpdate(): Promise<UpdateActionResult>
  openManualDownload(): Promise<UpdateActionResult>
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void
  openExternal(url: string): Promise<ElectronActionResult>
  recordDiagnosticEvent(event: DiagnosticEvent): Promise<ElectronActionResult>
  exportDiagnosticsPackage(): Promise<ElectronActionResult>
  getExternalModules(): Promise<ExternalModuleInfo[]>
  launchExternalModule(moduleId: string): Promise<ElectronActionResult>
  getBrowserPlugins(): Promise<BrowserPluginInfo[]>
  launchBrowserPlugin(pluginId: string): Promise<ElectronActionResult>
  getAutomationApps(): Promise<AutomationAppInfo[]>
  launchAutomationApp(appId: string): Promise<ElectronActionResult>
  stopAutomationApp(appId: string): Promise<ElectronActionResult>
  selectDirectory?(options?: { title?: string; defaultPath?: string }): Promise<DirectorySelectionResult>
  launchAdidasMaterialCollector(): Promise<ElectronActionResult>
}

declare global {
  interface Window {
    electronAPI?: ElectronApi
  }
}
