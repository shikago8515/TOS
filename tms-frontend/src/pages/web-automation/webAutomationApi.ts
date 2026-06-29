import type {
  AutomationAppInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'
import {
  buildBackendDownloadUrl,
  downloadUrlAsFile,
  postFormData,
  readResponseMessage,
  requestBackendJson,
} from '../../shared/api/backendClient'

const moduleName = 'web-automation'
const launcherBaseUrl = 'http://127.0.0.1:3210'
const launcherProtocolUrl = 'tos://automation/launcher/start'
const defaultAutomationHelperDownloadPath = '/api/system/config/automation-helper/download'
const localHealthProbeTimeoutMs = 650
const localLauncherProbeTimeoutMs = 650
export const minimumAutomationHelperVersion = '0.9.8-beta.3.19'

export interface InfornexusAutoAddManualSessionSummary {
  manualSessionId: string
  startedAt?: string
  autoAddSearchUrl?: string
  finalUrl?: string
  title?: string
}

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
  manualSession?: InfornexusAutoAddManualSessionSummary | null
  dataDir?: string
  runtimeConfigPath?: string
  runtimeSecretPath?: string
  capabilities?: Record<string, unknown>
  config?: Record<string, unknown>
}

export function isLocalExecutorBusy(health: LocalExecutorHealth | null | undefined): boolean {
  const activeRunCount = Number(health?.activeRunCount || 0)
  return Boolean(
    health?.busy
      || health?.activeRun
      || (Array.isArray(health?.activeRuns) && health.activeRuns.length > 0)
      || (Number.isFinite(activeRunCount) && activeRunCount > 0),
  )
}

export function collectLocalExecutorActiveRuns(health: LocalExecutorHealth | null | undefined): Record<string, any>[] {
  const runs: Record<string, any>[] = []
  const activeRun = toActiveRunRecord(health?.activeRun)
  if (activeRun) runs.push(activeRun)
  if (Array.isArray(health?.activeRuns)) {
    for (const item of health.activeRuns) {
      const run = toActiveRunRecord(item)
      if (run) runs.push(run)
    }
  }
  return runs
}

export function findLocalExecutorActiveRun(
  health: LocalExecutorHealth | null | undefined,
  matcher: (run: Record<string, any>) => boolean,
): Record<string, any> | null {
  return collectLocalExecutorActiveRuns(health).find(matcher) || null
}

function toActiveRunRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null
}

export interface LocalAutomationLauncherHealth {
  ok: boolean
  version?: string
  helperVersion?: string
  host?: string
  port?: number
  pid?: number
}

export interface LaunchAutomationConsoleOptions {
  forceUpdate?: boolean
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
  isActive?: boolean
  downloadPath: string
  createdAt?: string
  updatedAt?: string
}

export interface AutomationRunRecord {
  runId: string
  automationId: string
  moduleId: string
  runName: string
  status: string
  message: string
  result?: unknown
  startedAt?: string
  finishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface AutomationRunFileRecord {
  id: number
  runId: string
  fileRole: string
  bucket: string
  objectKey: string
  originalFilename: string
  contentType: string
  fileSize: number
  sha256: string
  createdAt: string
  downloadPath: string
}

export interface AutomationRunFileInput {
  url: string
  fileName: string
  fileRole: string
  contentType?: string
  contentBase64?: string
}

export type AutomationHelperPanelOpenResult =
  | { status: 'opened'; message: string }
  | { status: 'not-running' | 'unsupported' | 'error'; message: string }

export interface InfornexusAutoAddSearchOpenRequest {
  baseUrl: string
  token: string
  username: string
  password: string
  headless?: boolean
}

export interface InfornexusAutoAddSearchOpenResult {
  ok: boolean
  loginSuccess: boolean
  searchOpened: boolean
  manualSessionId: string
  autoAddSearchUrl: string
  finalUrl: string
  title: string
  message: string
  generatedAt: string
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
  await downloadUrlAsFile(downloadUrl, 'TOS-Automation-Helper-Setup.exe')
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

export async function launchAutomationConsole(
  appId: string,
  options: LaunchAutomationConsoleOptions = {},
): Promise<ElectronActionResult> {
  const forceUpdate = options.forceUpdate !== false
  await recordWebAutomationEvent('launch-start', { appId, forceUpdate })

  let result: ElectronActionResult
  if (window.electronAPI?.launchAutomationApp) {
    result = await window.electronAPI.launchAutomationApp(appId, { forceUpdate })
  } else {
    await ensureLocalAutomationLauncher()
    result = await requestLauncherJson<ElectronActionResult>(
      'POST',
      `/api/apps/${encodeURIComponent(appId)}/start`,
      { forceUpdate },
    )
  }

  if (!result.success && result.error) {
    result = {
      ...result,
      error: formatAutomationLauncherErrorMessage(result.error, appId),
    }
  }

  await recordWebAutomationEvent(result.success ? 'launch-success' : 'launch-failure', {
    appId,
    forceUpdate,
    result,
  })
  return result
}

export async function openInfornexusAutoAddSearchPage(
  request: InfornexusAutoAddSearchOpenRequest,
): Promise<InfornexusAutoAddSearchOpenResult> {
  return requestExecutorJson<InfornexusAutoAddSearchOpenResult>(
    'POST',
    request.baseUrl,
    '/api/open-infornexus-auto-add-search',
    {
      token: request.token,
      username: request.username,
      password: request.password,
      headless: Boolean(request.headless),
    },
    request.token,
    60000,
  )
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

export async function fetchAllAutomationTemplates(includeInactive = false): Promise<AutomationTemplate[]> {
  const payload = await requestBackendJson<{ templates?: AutomationTemplate[] }>({
    path: `/api/automation/templates?includeInactive=${includeInactive ? 'true' : 'false'}`,
  })
  return Array.isArray(payload.templates) ? payload.templates : []
}

export async function uploadAutomationTemplate(input: {
  moduleId: string
  templateKey: string
  displayName: string
  file: File
}): Promise<AutomationTemplate> {
  const formData = new FormData()
  formData.append('module_id', input.moduleId)
  formData.append('template_key', input.templateKey || 'default')
  formData.append('display_name', input.displayName || input.file.name)
  formData.append('file', input.file)

  const payload = await postFormData<{ template?: AutomationTemplate }>({
    path: '/api/automation/templates',
    formData,
  })
  if (!payload.template) {
    throw new Error('模板上传完成，但后端未返回模板记录。')
  }
  return payload.template
}

export async function updateAutomationTemplate(
  templateId: number,
  input: {
    moduleId?: string
    templateKey?: string
    displayName?: string
    isActive?: boolean
  },
): Promise<AutomationTemplate> {
  const payload = await requestBackendJson<{ template?: AutomationTemplate }>({
    method: 'PATCH',
    path: `/api/automation/templates/${encodeURIComponent(String(templateId))}`,
    body: input,
  })
  if (!payload.template) {
    throw new Error('模板更新完成，但后端未返回模板记录。')
  }
  return payload.template
}

export async function deleteAutomationTemplate(templateId: number): Promise<void> {
  await requestBackendJson({
    method: 'DELETE',
    path: `/api/automation/templates/${encodeURIComponent(String(templateId))}`,
  })
}

export async function buildAutomationTemplateDownloadUrl(template: AutomationTemplate): Promise<string> {
  return buildBackendDownloadUrl(template.downloadPath)
}

export async function downloadAutomationTemplate(template: AutomationTemplate | null | undefined): Promise<void> {
  if (!template) {
    throw new Error('当前模块还没有配置 Excel 模板，请联系管理员上传模板后再下载。')
  }

  const url = await buildAutomationTemplateDownloadUrl(template)
  let response: Response
  try {
    response = await fetch(url, { method: 'GET' })
  } catch (_error) {
    throw new Error('无法连接后端服务，模板下载失败。请确认本地后端或服务器后端正在运行。')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || isTemplateErrorContentType(contentType)) {
    const rawText = await response.text().catch(() => '')
    throw new Error(readTemplateDownloadErrorMessage(rawText, response.status, template.downloadPath))
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error('模板文件为空，请联系管理员重新上传模板。')
  }

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.rel = 'noopener'
  anchor.download = readTemplateDownloadFilename(response, template)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function createAutomationRunRecord(
  automationId: string,
  sourceFile: File | null,
  runName = '',
): Promise<AutomationRunRecord | null> {
  const formData = new FormData()
  formData.append('automation_id', automationId)
  formData.append('module_id', automationId)
  formData.append('run_name', runName || automationId)
  formData.append('message', 'started')
  if (sourceFile) formData.append('source_file', sourceFile)

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
): Promise<{ run?: AutomationRunRecord; files: AutomationRunFileRecord[]; warnings: string[] }> {
  const payload = await requestBackendJson<{
    run?: AutomationRunRecord
    files?: AutomationRunFileRecord[]
    warnings?: string[]
  }>({
    method: 'PATCH',
    path: `/api/automation/runs/${encodeURIComponent(runId)}`,
    body: {
      status,
      message,
      result,
      resultFiles,
    },
  })
  return {
    run: payload.run,
    files: Array.isArray(payload.files) ? payload.files : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  }
}

export async function fetchAutomationRuns(params: {
  automationId?: string
  moduleId?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ runs: AutomationRunRecord[]; pagination: { page: number; pageSize: number; total: number } }> {
  const query = new URLSearchParams()
  if (params.automationId) query.set('automationId', params.automationId)
  if (params.moduleId) query.set('moduleId', params.moduleId)
  if (params.status) query.set('status', params.status)
  if (params.keyword) query.set('keyword', params.keyword)
  query.set('page', String(params.page || 1))
  query.set('pageSize', String(params.pageSize || 30))

  const payload = await requestBackendJson<{
    runs?: AutomationRunRecord[]
    pagination?: { page?: number; pageSize?: number; total?: number }
  }>({
    path: `/api/automation/runs?${query.toString()}`,
  })
  return {
    runs: Array.isArray(payload.runs) ? payload.runs : [],
    pagination: {
      page: Number(payload.pagination?.page || params.page || 1),
      pageSize: Number(payload.pagination?.pageSize || params.pageSize || 30),
      total: Number(payload.pagination?.total || 0),
    },
  }
}

export async function fetchAutomationRunDetail(runId: string): Promise<{
  run: AutomationRunRecord
  files: AutomationRunFileRecord[]
}> {
  const payload = await requestBackendJson<{
    run?: AutomationRunRecord
    files?: AutomationRunFileRecord[]
  }>({
    path: `/api/automation/runs/${encodeURIComponent(runId)}`,
  })
  if (!payload.run) {
    throw new Error('执行记录不存在。')
  }
  return {
    run: payload.run,
    files: Array.isArray(payload.files) ? payload.files : [],
  }
}

export async function fetchAutomationRunFiles(runId: string): Promise<AutomationRunFileRecord[]> {
  const payload = await requestBackendJson<{ files?: AutomationRunFileRecord[] }>({
    path: `/api/automation/runs/${encodeURIComponent(runId)}/files`,
  })
  return Array.isArray(payload.files) ? payload.files : []
}

export function buildAutomationRunFileDownloadUrl(file: AutomationRunFileRecord): Promise<string> {
  return buildBackendDownloadUrl(file.downloadPath)
}

export async function downloadAutomationRunFile(file: AutomationRunFileRecord): Promise<void> {
  const url = await buildAutomationRunFileDownloadUrl(file)
  let response: Response
  try {
    response = await fetch(url, { method: 'GET' })
  } catch (_error) {
    throw new Error('无法连接后端服务，执行文件下载失败。请确认本地后端或服务器后端正在运行。')
  }

  if (!response.ok) {
    const rawText = await response.text().catch(() => '')
    throw new Error(readAutomationRunFileDownloadErrorMessage(rawText, response.status, file.downloadPath))
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.rel = 'noopener'
  anchor.download = readAutomationRunFileDownloadFilename(response, file)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function probeLocalAutomationLauncherHealth(): Promise<boolean> {
  return Boolean(await fetchLocalAutomationLauncherHealth())
}

export async function probeLocalAutomationLauncherHealthPayload(): Promise<LocalAutomationLauncherHealth | null> {
  return fetchLocalAutomationLauncherHealth()
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
  return Boolean(await fetchLocalAutomationLauncherHealth())
}

async function fetchLocalAutomationLauncherHealth(): Promise<LocalAutomationLauncherHealth | null> {
  try {
    const response = await fetchWithTimeout(`${launcherBaseUrl}/health`, { method: 'GET' }, localLauncherProbeTimeoutMs)
    if (!response.ok) {
      return null
    }
    const payload = await response.json().catch(() => ({}))
    return payload && typeof payload === 'object' && (payload as { ok?: unknown }).ok
      ? payload as LocalAutomationLauncherHealth
      : null
  } catch {
    return null
  }
}

function isTemplateErrorContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return normalized.includes('application/json')
    || normalized.includes('text/html')
    || normalized.includes('text/plain')
}

function readTemplateDownloadErrorMessage(rawText: string, status: number, path: string): string {
  const trimmed = String(rawText || '').trim()
  if (trimmed) {
    try {
      const payload = JSON.parse(trimmed) as unknown
      const apiMessage = readResponseMessage(payload, { status, path })
      if (apiMessage) {
        return apiMessage
      }
    } catch {
      // Fall through and show a short plain-text preview.
    }
  }

  if (status === 404) {
    return '当前模块的 Excel 模板未配置，或模板文件已经从 MinIO 删除，请联系管理员重新上传模板。'
  }

  if (status >= 500) {
    return '模板文件暂时无法下载，可能是 MinIO 文件缺失或后端存储连接异常，请联系管理员检查模板配置。'
  }

  const plainText = trimmed
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  return plainText
    ? `模板下载失败：${plainText}`
    : `模板下载失败（HTTP ${status || '未知'}）。`
}

function readTemplateDownloadFilename(response: Response, template: AutomationTemplate): string {
  const disposition = response.headers.get('content-disposition') || ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (asciiMatch?.[1]) {
    return asciiMatch[1].trim()
  }

  return template.originalFilename || `${template.templateKey || 'template'}.xlsx`
}

function readAutomationRunFileDownloadErrorMessage(rawText: string, status: number, path: string): string {
  const trimmed = String(rawText || '').trim()
  if (trimmed) {
    try {
      const payload = JSON.parse(trimmed) as unknown
      const apiMessage = readResponseMessage(payload, { status, path })
      if (apiMessage) {
        return apiMessage
      }
    } catch {
      // Fall through and show a short plain-text preview.
    }
  }

  if (status === 404) {
    return '执行文件不存在，或文件已经从 MinIO 删除，请联系管理员检查归档记录。'
  }

  if (status >= 500) {
    return '执行文件暂时无法下载，请联系管理员检查 MinIO 存储连接。'
  }

  const plainText = trimmed
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  return plainText
    ? `执行文件下载失败：${plainText}`
    : `执行文件下载失败（HTTP ${status || '未知'}）。`
}

function readAutomationRunFileDownloadFilename(response: Response, file: AutomationRunFileRecord): string {
  const disposition = response.headers.get('content-disposition') || ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (asciiMatch?.[1]) {
    return asciiMatch[1].trim()
  }

  return file.originalFilename || file.fileRole || 'automation-run-file'
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
  fallbackHelperVersion = '',
): string {
  const directVersion = String(health?.version || health?.helperVersion || '').trim()
  if (directVersion) return directVersion

  const configVersion = health?.config && typeof health.config === 'object'
    ? String((health.config as Record<string, unknown>).version || '').trim()
    : ''
  if (configVersion) return configVersion

  const fallbackVersion = String(fallbackHelperVersion || '').trim()
  if (fallbackVersion) return fallbackVersion

  return ''
}

export function getAutomationHelperUpdateMessage(
  health: LocalExecutorHealth | null | undefined,
  activeApp?: AutomationAppInfo | null,
  minimumRequiredVersion = minimumAutomationHelperVersion,
  fallbackHelperVersion = '',
): string {
  const requiredVersion = resolveAutomationHelperRequiredVersion(activeApp, minimumRequiredVersion)
  if (!requiredVersion) return ''

  const current = resolveLocalAutomationHelperVersion(health, activeApp, fallbackHelperVersion)
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
  body?: Record<string, unknown>,
): Promise<T> {
  const requestBody = body === undefined ? undefined : JSON.stringify(body)
  const response = await fetchWithTimeout(`${launcherBaseUrl}${pathname}`, {
    method,
    headers: requestBody ? { 'Content-Type': 'application/json' } : undefined,
    body: requestBody,
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
  timeoutMs = 5000,
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
  }, timeoutMs)
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
    return await window.fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}
