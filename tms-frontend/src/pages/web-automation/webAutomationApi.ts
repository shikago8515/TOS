import type {
  AutomationAppInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = '网页自动化'

export interface LocalExecutorHealth {
  ok: boolean
  busy?: boolean
  activeRun?: unknown
  lastRun?: unknown
  dataDir?: string
  runtimeConfigPath?: string
  runtimeSecretPath?: string
  config?: Record<string, unknown>
}

export function hasElectronAutomationSupport(): boolean {
  return Boolean(window.electronAPI?.getAutomationApps)
}

export async function fetchAutomationApps(): Promise<AutomationAppInfo[]> {
  if (!window.electronAPI?.getAutomationApps) {
    throw new Error('当前运行环境不支持网页自动化模块')
  }

  return window.electronAPI.getAutomationApps()
}

export async function launchAutomationConsole(appId: string): Promise<ElectronActionResult> {
  if (!window.electronAPI?.launchAutomationApp) {
    throw new Error('当前运行环境不支持启动网页自动化控制台')
  }

  await recordWebAutomationEvent('launch-start', { appId })
  const result = await window.electronAPI.launchAutomationApp(appId)
  await recordWebAutomationEvent(result.success ? 'launch-success' : 'launch-failure', {
    appId,
    result,
  })

  return result
}

export async function stopAutomationConsole(appId: string): Promise<ElectronActionResult> {
  if (!window.electronAPI?.stopAutomationApp) {
    throw new Error('当前运行环境不支持停止网页自动化控制台')
  }

  await recordWebAutomationEvent('stop-start', { appId })
  const result = await window.electronAPI.stopAutomationApp(appId)
  await recordWebAutomationEvent(result.success ? 'stop-success' : 'stop-failure', {
    appId,
    result,
  })

  return result
}

export async function openAutomationConsoleExternal(url: string): Promise<ElectronActionResult> {
  if (!window.electronAPI?.openExternal) {
    throw new Error('当前运行环境不支持打开外部网页')
  }

  await recordWebAutomationEvent('open-external', { url })
  return window.electronAPI.openExternal(url)
}

export async function recordWebAutomationEvent(
  action: string,
  payload?: DiagnosticEvent['payload'],
): Promise<void> {
  try {
    await window.electronAPI?.recordDiagnosticEvent?.({
      module: moduleName,
      action,
      payload,
    })
  } catch {
    // Diagnostics must never block the user action.
  }
}

export async function probeLocalExecutorHealth(baseUrl: string): Promise<LocalExecutorHealth> {
  const normalizedUrl = String(baseUrl || '').replace(/\/+$/, '')
  const candidates = [`${normalizedUrl}/api/health`, `${normalizedUrl}/health`]
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
      }, 2500)

      if (!response.ok) {
        lastError = new Error(`Health check returned HTTP ${response.status}.`)
        continue
      }

      const payload = await response.json().catch(() => ({}))
      return {
        ok: true,
        ...(payload && typeof payload === 'object'
          ? payload as Record<string, unknown>
          : {}),
      } as LocalExecutorHealth
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('本地执行器未响应。')
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}
