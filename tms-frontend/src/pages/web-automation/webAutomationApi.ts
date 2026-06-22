import type {
  AutomationAppInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'
import {
  buildBackendDownloadUrl,
  postFormData,
  requestBackendJson,
} from '../../shared/api/backendClient'

const moduleName = 'web-automation'
const launcherBaseUrl = 'http://127.0.0.1:3210'
const launcherProtocolUrl = 'tos://automation/launcher/start'
const defaultAutomationHelperDownloadPath = '/api/system/config/automation-helper/download'
const localHealthProbeTimeoutMs = 650
const localLauncherProbeTimeoutMs = 650
export const minimumAutomationHelperVersion = '0.9.8-beta.3.19'

export interface LocalExecutorHealth {
  ok: boolean
  version?: string
  helperVersion?: string
  busy?: boolean
  activeRun?: unknown
  activeRuns?: unknown[]
  activeRunCount?: number
  lastRun?: unknown
  recentRuns?: unknown[]
  dataDir?: string
  runtimeConfigPath?: string
  runtimeSecretPath?: string
  capabilities?: Record<string, unknown>
  config?: Record<string, unknown>
}

export interface ExecutorCredentials {
  ok: boolean
  hasStoredCredentials: boolean
  username: string
  automationId?: string
  sourceAutomationId?: string
  accountKey?: string
  createdAt?: string
  updatedAt?: string
}

export interface ExecutorCredentialOption {
  automationId?: string
  sourceAutomationId?: string
  accountKey: string
  hasStoredCredentials: boolean
  username: string
  createdAt?: string
  updatedAt?: string
}

export interface ResolvedAutomationCredentials {
  ok: boolean
  automationId: string
  accountKey: string
  username: string
  password: string
}

export interface AutomationTemplate {
  id: number
  moduleId: string
  templateKey: string
  displayName: string
  originalFilename: string
  contentType: string
  fileSize: number
  sha256: string
  downloadPath: string
}

export interface AutomationRunRecord {
  runId: string
  automationId: string
  moduleId: string
  runName: string
  status: string
  message: string
}

export interface AutomationRunFileInput {
  url: string
  fileName: string
  fileRole: string
  contentType?: string
}

export type AutomationHelperPanelOpenResult =
  | { status: 'opened'; message: string }
  | { status: 'not-running' | 'unsupported' | 'error'; message: string }

export function hasElectronAutomationSupport(): boolean {
  return Boolean(window.electronAPI?.getAutomationApps)
}

export function primeLocalAutomationLauncherBoot(): void {
  if (window.electronAPI?.launchAutomationApp) {
    return
  }
  triggerAutomationProtocol(launcherProtocolUrl)
}

export function getAutomationHelperDownloadUrl(): string {
  const configuredUrl = import.meta.env.VITE_AUTOMATION_HELPER_DOWNLOAD_URL
  return typeof configuredUrl === 'string' && configuredUrl.trim()
    ? configuredUrl.trim()
    : defaultAutomationHelperDownloadPath
}

export async function resolveAutomationHelperDownloadUrl(): Promise<string> {
  const configuredUrl = getAutomationHelperDownloadUrl()
  return configuredUrl.startsWith('/api/')
    ? buildBackendDownloadUrl(configuredUrl)
    : configuredUrl
}

export async function openAutomationHelperDownload(): Promise<void> {
  const downloadUrl = await resolveAutomationHelperDownloadUrl()
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.rel = 'noopener'
  anchor.download = ''
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export async function openAutomationHelperPanel(): Promise<AutomationHelperPanelOpenResult> {
  const status = await probeAutomationHelperUpdatePanel()
  if (status === 'available') {
    window.open(`${launcherBaseUrl}/`, '_blank', 'noopener')
    return {
      status: 'opened',
      message: '已打开本机自动化助手更新面板。',
    }
  }

  if (status === 'unsupported') {
    return {
      status: 'unsupported',
      message: '本机小助手版本过旧，暂不支持更新面板。请先下载安装最新版小助手后再打开。',
    }
  }

  return {
    status: 'not-running',
    message: '未检测到正在运行的本机自动化助手。请先安装并启动最新版小助手，再打开更新面板。',
  }
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

  if (!result.success && result.error) {
    result = {
      ...result,
      error: formatAutomationLauncherErrorMessage(result.error, appId),
    }
  }

  await recordWebAutomationEvent(result.success ? 'launch-success' : 'launch-failure', {
    appId,
    result,
  })
  return result
}

export function formatAutomationLauncherErrorMessage(message: string, appId?: string): string {
  const rawMessage = String(message || '').trim()
  if (/Unknown automation app:/i.test(rawMessage)) {
    const appLabel = appId === 'shipping-automation-demo' ? 'Shipping 执行器' : '对应执行器'
    return `本机自动化助手版本过旧或安装不完整，缺少 ${appLabel}。请安装最新 TOS 完整安装包或最新版小助手，重启小助手后再执行。`
  }

  return rawMessage
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
  return firstFulfilled(
    candidates.map((url) => fetchExecutorHealthCandidate(url)),
  )
}

async function fetchExecutorHealthCandidate(url: string): Promise<LocalExecutorHealth> {
  const response = await fetchWithTimeout(url, { method: 'GET' }, localHealthProbeTimeoutMs)
  if (!response.ok) {
    throw new Error(`Health check returned HTTP ${response.status}.`)
  }

  const payload = await response.json().catch(() => ({}))
  return {
    ok: true,
    ...(payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {}),
  } as LocalExecutorHealth
}

async function firstFulfilled<T>(promises: Promise<T>[]): Promise<T> {
  if (promises.length === 0) {
    throw new Error('No health check candidates configured.')
  }

  return new Promise<T>((resolve, reject) => {
    let rejectedCount = 0
    let lastError: unknown = null

    for (const promise of promises) {
      promise.then(resolve).catch((error) => {
        rejectedCount += 1
        lastError = error
        if (rejectedCount === promises.length) {
          reject(lastError instanceof Error ? lastError : new Error('Local executor did not respond.'))
        }
      })
    }
  })
}

function buildCredentialAccountQuery(accountKey?: string): string {
  const key = String(accountKey || '').trim()
  return key ? `?accountKey=${encodeURIComponent(key)}` : ''
}

export async function fetchExecutorCredentialOptions(
  automationId: string,
): Promise<ExecutorCredentialOption[]> {
  const payload = await requestBackendJson<{ accounts?: ExecutorCredentialOption[] }>({
    path: `/api/automation/credentials/${encodeURIComponent(automationId)}/accounts`,
  })
  return Array.isArray(payload.accounts) ? payload.accounts : []
}

export async function fetchExecutorCredentials(
  automationId: string,
  accountKey = 'default',
): Promise<ExecutorCredentials> {
  return requestBackendJson<ExecutorCredentials>({
    path: `/api/automation/credentials/${encodeURIComponent(automationId)}${buildCredentialAccountQuery(accountKey)}`,
  })
}

export async function saveExecutorCredentials(
  automationId: string,
  username: string,
  password: string,
  accountKey = 'default',
): Promise<ExecutorCredentials> {
  return requestBackendJson<ExecutorCredentials>({
    method: 'PUT',
    path: `/api/automation/credentials/${encodeURIComponent(automationId)}`,
    body: {
      username,
      password,
      accountKey,
    },
  })
}

export async function clearExecutorCredentials(
  automationId: string,
  accountKey = 'default',
): Promise<ExecutorCredentials> {
  return requestBackendJson<ExecutorCredentials>({
    method: 'DELETE',
    path: `/api/automation/credentials/${encodeURIComponent(automationId)}${buildCredentialAccountQuery(accountKey)}`,
  })
}

export async function resolveAutomationCredentials(
  automationId: string,
  accountKey = 'default',
): Promise<ResolvedAutomationCredentials> {
  return requestBackendJson<ResolvedAutomationCredentials>({
    method: 'POST',
    path: `/api/automation/credentials/${encodeURIComponent(automationId)}/resolve${buildCredentialAccountQuery(accountKey)}`,
  })
}

export async function fetchAutomationTemplates(moduleId: string): Promise<AutomationTemplate[]> {
  const payload = await requestBackendJson<{ templates?: AutomationTemplate[] }>({
    path: `/api/automation/templates?moduleId=${encodeURIComponent(moduleId)}`,
  })
  return Array.isArray(payload.templates) ? payload.templates : []
}

export async function buildAutomationTemplateDownloadUrl(template: AutomationTemplate): Promise<string> {
  return buildBackendDownloadUrl(template.downloadPath)
}

export async function createAutomationRunRecord(
  automationId: string,
  sourceFile: File,
  runName = '',
): Promise<AutomationRunRecord | null> {
  const formData = new FormData()
  formData.append('automation_id', automationId)
  formData.append('module_id', automationId)
  formData.append('run_name', runName || automationId)
  formData.append('message', 'started')
  formData.append('source_file', sourceFile)

  const payload = await postFormData<{ run?: AutomationRunRecord }>({
    path: '/api/automation/runs',
    formData,
  })
  return payload.run || null
}

export async function finishAutomationRunRecord(
  runId: string,
  status: string,
  message: string,
  result: unknown,
  resultFiles: AutomationRunFileInput[] = [],
): Promise<void> {
  await requestBackendJson({
    method: 'PATCH',
    path: `/api/automation/runs/${encodeURIComponent(runId)}`,
    body: {
      status,
      message,
      result,
      resultFiles,
    },
  })
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
    const response = await fetchWithTimeout(`${launcherBaseUrl}/health`, { method: 'GET' }, localLauncherProbeTimeoutMs)
    if (!response.ok) {
      return false
    }
    const payload = await response.json().catch(() => ({}))
    return Boolean(payload && payload.ok)
  } catch {
    return false
  }
}

async function probeAutomationHelperUpdatePanel(): Promise<'available' | 'unsupported' | 'not-running'> {
  try {
    const response = await fetchWithTimeout(`${launcherBaseUrl}/api/update/status`, { method: 'GET' }, 900)
    if (!response.ok) {
      return response.status === 404 ? 'unsupported' : 'not-running'
    }

    const payload = await response.json().catch(() => ({}))
    return payload && typeof payload === 'object' && (payload as { ok?: unknown }).ok === true
      ? 'available'
      : 'unsupported'
  } catch {
    return 'not-running'
  }
}

export function resolveLocalAutomationHelperVersion(
  health: LocalExecutorHealth | null | undefined,
  activeApp?: AutomationAppInfo | null,
): string {
  const directVersion = String(health?.version || health?.helperVersion || '').trim()
  if (directVersion) return directVersion

  const configVersion = health?.config && typeof health.config === 'object'
    ? String((health.config as Record<string, unknown>).version || '').trim()
    : ''
  if (configVersion) return configVersion

  return ''
}

export function getAutomationHelperUpdateMessage(
  health: LocalExecutorHealth | null | undefined,
  activeApp?: AutomationAppInfo | null,
  minimumRequiredVersion = minimumAutomationHelperVersion,
): string {
  const requiredVersion = resolveAutomationHelperRequiredVersion(activeApp, minimumRequiredVersion)
  if (!requiredVersion) return ''

  const current = resolveLocalAutomationHelperVersion(health, activeApp)
  if (!current) {
    return `本机自动化助手版本无法识别，当前功能要求小助手版本不低于 ${requiredVersion}，请下载并安装最新小助手后重试。`
  }

  if (compareVersionNumbers(current, requiredVersion) < 0) {
    return `本机自动化助手版本 ${current} 低于当前功能要求 ${requiredVersion}，请下载并安装最新小助手后重试。`
  }

  return ''
}

function resolveAutomationHelperRequiredVersion(
  activeApp: AutomationAppInfo | null | undefined,
  minimumRequiredVersion: string,
): string {
  const appRequiredVersion = String(activeApp?.requiredHelperVersion || '').trim()
  if (appRequiredVersion) return appRequiredVersion
  return String(minimumRequiredVersion || '').trim()
}

export function compareVersionNumbers(left: string, right: string): number {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function versionParts(version: string): number[] {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part))
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
    throw new Error(formatAutomationLauncherErrorMessage(message))
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
