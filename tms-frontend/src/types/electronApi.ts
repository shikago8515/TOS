export interface ElectronActionResult {
  success: boolean
  error?: string
  url?: string
  command?: string
  alreadyOpen?: boolean
  alreadyRunning?: boolean
  browser?: string
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

export interface ElectronApi {
  getBackendUrl(): Promise<string>
  startBackendServer(): Promise<ElectronActionResult>
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
  launchAdidasMaterialCollector(): Promise<ElectronActionResult>
}

declare global {
  interface Window {
    electronAPI?: ElectronApi
  }
}
