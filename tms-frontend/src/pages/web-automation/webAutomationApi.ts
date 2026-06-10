import type {
  AutomationAppInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = 'web-automation'
const launcherBaseUrl = 'http://127.0.0.1:3210'
const launcherProtocolUrl = 'tos://automation/launcher/start'

export interface LocalExecutorHealth {
  ok: boolean
  busy?: boolean
  activeRun?: unknown
  activeRuns?: unknown[]
  activeRunCount?: number
  lastRun?: unknown
  recentRuns?: unknown[]
  dataDir?: string
  runtimeConfigPath?: string
  runtimeSecretPath?: string
  config?: Record<string, unknown>
}

export interface ExecutorCredentials {
  ok: boolean
  hasStoredCredentials: boolean
  username: string
}

export function hasElectronAutomationSupport(): boolean {
  return Boolean(window.electronAPI?.getAutomationApps)
}

export function primeLocalAutomationLauncherBoot(): void {
  if (window.electronAPI?.launchAutomationApp) {
    return
  }
  triggerAutomationProtocol(launcherProtocolUrl)
}

export async function fetchAutomationApps(): Promise<AutomationAppInfo[]> {
  if (window.electronAPI?.getAutomationApps) {
    return window.electronAPI.getAutomationApps()
  }

  const payload = await requestLauncherJson<{ apps?: AutomationAppInfo[] }>('GET', '/api/apps')
  return Array.isArray(payload.apps) ? payload.apps : []
}

export async function launchAutomationConsole(appId: string): Promise<ElectronActionResult> {
  await recordWebAutomationEvent('launch-start', { appId })

  let result: ElectronActionResult
  if (window.electronAPI?.launchAutomationApp) {
    result = await window.electronAPI.launchAutomationApp(appId)
  } else {
    await ensureLocalAutomationLauncher()
    result = await requestLauncherJson<ElectronActionResult>('POST', `/api/apps/${encodeURIComponent(appId)}/start`)
  }

  await recordWebAutomationEvent(result.success ? 'launch-success' : 'launch-failure', {
    appId,
    result,
  })
  return result
}

export async function stopAutomationConsole(appId: string): Promise<ElectronActionResult> {
  await recordWebAutomationEvent('stop-start', { appId })

  let result: ElectronActionResult
  if (window.electronAPI?.stopAutomationApp) {
    result = await window.electronAPI.stopAutomationApp(appId)
  } else {
    await ensureLocalAutomationLauncher()
    result = await requestLauncherJson<ElectronActionResult>('POST', `/api/apps/${encodeURIComponent(appId)}/stop`)
  }

  await recordWebAutomationEvent(result.success ? 'stop-success' : 'stop-failure', {
    appId,
    result,
  })
  return result
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
    // Diagnostics must never block user actions.
  }
}

export async function probeLocalExecutorHealth(baseUrl: string): Promise<LocalExecutorHealth> {
  const normalizedUrl = String(baseUrl || '').replace(/\/+$/, '')
  const candidates = [`${normalizedUrl}/api/health`, `${normalizedUrl}/health`]
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, { method: 'GET' }, 2500)
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
    : new Error('Local executor did not respond.')
}

export async function fetchExecutorCredentials(baseUrl: string): Promise<ExecutorCredentials> {
  return requestExecutorJson<ExecutorCredentials>('GET', baseUrl, '/api/credentials')
}

export async function saveExecutorCredentials(
  baseUrl: string,
  token: string,
  username: string,
  password: string,
): Promise<ExecutorCredentials> {
  return requestExecutorJson<ExecutorCredentials>('PUT', baseUrl, '/api/credentials', {
    username,
    password,
  }, token)
}

export async function clearExecutorCredentials(
  baseUrl: string,
  token: string,
): Promise<ExecutorCredentials> {
  return requestExecutorJson<ExecutorCredentials>('DELETE', baseUrl, '/api/credentials', {}, token)
}

export async function probeLocalAutomationLauncherHealth(): Promise<boolean> {
  return isLauncherReachable()
}

async function ensureLocalAutomationLauncher(): Promise<void> {
  if (await isLauncherReachable()) {
    return
  }

  triggerAutomationProtocol(launcherProtocolUrl)
  const ready = await waitFor(async () => isLauncherReachable(), 12000, 500)
  if (!ready) {
    throw new Error('Local launcher is not ready. In source mode run `npm run launcher:register:dev`; in installed mode confirm TOS is installed and the tos:// protocol is registered.')
  }
}

async function isLauncherReachable(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${launcherBaseUrl}/health`, { method: 'GET' }, 1200)
    if (!response.ok) {
      return false
    }
    const payload = await response.json().catch(() => ({}))
    return Boolean(payload && payload.ok)
  } catch {
    return false
  }
}

function triggerAutomationProtocol(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }
  return false
}

async function requestLauncherJson<T = Record<string, unknown>>(
  method: string,
  pathname: string,
): Promise<T> {
  const response = await fetchWithTimeout(`${launcherBaseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }, 15000)

  const rawText = await response.text()
  const payload = safeParseJson(rawText)

  if (!response.ok) {
    const message = payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload.error === 'string'
        ? payload.error
        : `Launcher request failed with HTTP ${response.status}.`
    throw new Error(message)
  }

  return (payload || {}) as T
}

async function requestExecutorJson<T = Record<string, unknown>>(
  method: string,
  baseUrl: string,
  pathname: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const normalizedUrl = String(baseUrl || '').replace(/\/+$/, '')
  const headers: Record<string, string> = {}
  let requestBody: string | undefined

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  if (token) {
    headers['X-Executor-Token'] = token
  }

  const response = await fetchWithTimeout(`${normalizedUrl}${pathname}`, {
    method,
    headers,
    body: requestBody,
  }, 5000)
  const rawText = await response.text()
  const payload = safeParseJson(rawText)

  if (!response.ok) {
    const message = payload && typeof payload.message === 'string'
      ? payload.message
      : `Executor request failed with HTTP ${response.status}.`
    throw new Error(message)
  }

  return (payload || {}) as T
}

function safeParseJson(rawText: string): Record<string, unknown> | null {
  try {
    return rawText ? JSON.parse(rawText) : {}
  } catch {
    return null
  }
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
