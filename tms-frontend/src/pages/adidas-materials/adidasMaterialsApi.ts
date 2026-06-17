import type {
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'
import {
  compareVersionNumbers,
  expectedAutomationHelperVersion,
} from '../web-automation/webAutomationApi'

const moduleName = 'adidas 材料'
const launcherBaseUrl = 'http://127.0.0.1:3210'
const launcherBootProtocolUrl = 'tos://automation/launcher/start'
const launcherStartPath = '/api/adidas-materials/start'

export interface AdidasMaterialsLauncherHealth {
  ok?: boolean
  version?: string
  helperVersion?: string
  pid?: number
}

export interface AdidasMaterialsLauncherUpdateStatus {
  needsUpdate: boolean
  currentVersion: string
  expectedVersion: string
  message: string
}

export class AdidasMaterialsLauncherUpdateRequiredError extends Error {
  readonly currentVersion: string
  readonly expectedVersion: string

  constructor(status: AdidasMaterialsLauncherUpdateStatus) {
    super(status.message)
    this.name = 'AdidasMaterialsLauncherUpdateRequiredError'
    this.currentVersion = status.currentVersion
    this.expectedVersion = status.expectedVersion
  }
}

export async function launchAdidasMaterialsCollector(): Promise<ElectronActionResult> {
  await recordAdidasMaterialsEvent('launch-start')

  const result = window.electronAPI?.launchAdidasMaterialCollector
    ? await window.electronAPI.launchAdidasMaterialCollector()
    : await launchAdidasMaterialsCollectorFromWeb()

  await recordAdidasMaterialsEvent(result.success ? 'launch-success' : 'launch-failure', {
    result,
  })

  return result
}

async function launchAdidasMaterialsCollectorFromWeb(): Promise<ElectronActionResult> {
  await ensureLocalAutomationLauncher()
  const health = await fetchLauncherHealth().catch(() => null)
  const updateStatus = buildLauncherUpdateStatus(health)
  if (updateStatus.needsUpdate) {
    throw new AdidasMaterialsLauncherUpdateRequiredError(updateStatus)
  }

  try {
    return await requestLauncherJson<ElectronActionResult>('POST', launcherStartPath)
  } catch (error) {
    if (isLauncherMissingAdidasCollector(error)) {
      throw new AdidasMaterialsLauncherUpdateRequiredError(buildLauncherUpdateStatus(health, true))
    }
    throw error
  }
}

export async function readAdidasMaterialsLauncherUpdateStatus(): Promise<AdidasMaterialsLauncherUpdateStatus> {
  const health = await fetchLauncherHealth().catch(() => null)
  return buildLauncherUpdateStatus(health)
}

export async function recordAdidasMaterialsEvent(
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

async function isLauncherReachable(): Promise<boolean> {
  try {
    const payload = await fetchLauncherHealth(1200)
    return Boolean(payload && payload.ok)
  } catch {
    return false
  }
}

async function fetchLauncherHealth(timeoutMs = 1200): Promise<AdidasMaterialsLauncherHealth> {
  const response = await fetchWithTimeout(`${launcherBaseUrl}/health`, { method: 'GET' }, timeoutMs)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json().catch(() => ({}))
  return (payload && typeof payload === 'object' ? payload : {}) as AdidasMaterialsLauncherHealth
}

async function ensureLocalAutomationLauncher(): Promise<void> {
  if (await isLauncherReachable()) {
    return
  }

  triggerProtocol(launcherBootProtocolUrl)
  const ready = await waitFor(async () => isLauncherReachable(), 12000, 500)
  if (!ready) {
    throw new Error('无法一键启动本机后台启动器。请确认已安装新版 TOS，且浏览器允许打开 tos://automation/launcher/start。')
  }
}

function buildLauncherUpdateStatus(
  health: AdidasMaterialsLauncherHealth | null | undefined,
  forceUpdate = false,
): AdidasMaterialsLauncherUpdateStatus {
  const expectedVersion = expectedAutomationHelperVersion
  const currentVersion = String(health?.helperVersion || health?.version || '').trim()
  const versionBehind = Boolean(currentVersion && expectedVersion)
    && compareVersionNumbers(currentVersion, expectedVersion) < 0
  const unknownVersion = !currentVersion
  const needsUpdate = forceUpdate || versionBehind || unknownVersion
  let message = ''

  if (needsUpdate) {
    const currentLabel = currentVersion || '未知版本'
    message = `本机自动化助手需要更新。当前版本：${currentLabel}；系统要求：${expectedVersion}。请下载安装最新助手后重新打开此页面。`
  }

  return {
    needsUpdate,
    currentVersion,
    expectedVersion,
    message,
  }
}

function isLauncherMissingAdidasCollector(error: unknown): boolean {
  return error instanceof Error
    && /HTTP 404|Not found|entry not found|adidas materials collector entry not found|缺少 adidas|adidas.*启动接口/i
      .test(error.message)
}

function triggerProtocol(url: string): void {
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
        : `本机启动器请求失败，HTTP ${response.status}`
    throw new Error(`${message} (HTTP ${response.status})`)
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
