import { fallbackAppVersion } from '../version/appVersion'

export interface UploadRequestOptions {
  path: string
  formData: FormData
  onProgress?: (percentage: number) => void
  requireRuntimeVersion?: boolean
  backendTarget?: BackendTarget
}

export interface JsonRequestOptions {
  method?: string
  path: string
  body?: unknown
  requireRuntimeVersion?: boolean
  timeoutMs?: number
  backendTarget?: BackendTarget
}

export type BackendTarget = 'default' | 'local' | 'remote'

export interface ResponseMessageContext {
  status?: number
  path?: string
}

const backendApiNotFoundMessage = '当前后端版本缺少此接口，请重启 TOS 或等待后端切换完成'
const backendConnectionErrorMessage = '无法连接后端服务，请确认本地后端已启动并已重启到当前版本。'
const backendVersionMismatchPrefix = '当前后端版本未更新'
const localDevBackendUrl = 'http://127.0.0.1:8000'
const remoteBackendUrl = 'https://ai.tomwell.net:56130/tos/desktop-api'

let backendStartPromise: Promise<string | undefined> | null = null

export async function getBackendBaseUrl(
  backendTarget: BackendTarget = 'default',
  path = '',
): Promise<string> {
  if (backendTarget === 'remote') {
    return readRemoteBrowserBackendUrl()
  }

  if (backendTarget === 'local') {
    return getLocalBackendBaseUrl()
  }

  const startedBackendUrl = await ensureBackendReady()

  if (startedBackendUrl) {
    return startedBackendUrl.replace(/\/$/, '')
  }

  const backendUrl = await window.electronAPI?.getBackendUrl()

  if (backendUrl) {
    return backendUrl.replace(/\/$/, '')
  }

  return readDefaultBrowserBackendUrl(path)
}

async function getLocalBackendBaseUrl(): Promise<string> {
  const startedBackendUrl = await ensureBackendReady()

  if (startedBackendUrl) {
    return startedBackendUrl.replace(/\/$/, '')
  }

  const backendUrl = await window.electronAPI?.getBackendUrl()

  if (backendUrl) {
    return backendUrl.replace(/\/$/, '')
  }

  return readLocalBrowserBackendUrl()
}

function readDefaultBrowserBackendUrl(path: string): string {
  const configuredUrl = import.meta.env.VITE_BACKEND_URL

  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '')
  }

  if (isHybridBackendRoutingMode()) {
    return shouldUseRemoteBackendByDefault(path)
      ? readRemoteBrowserBackendUrl()
      : readLocalBrowserBackendUrl()
  }

  if (window.location?.pathname?.startsWith('/tos')) {
    return '/tos/desktop-api'
  }

  return readLocalBrowserBackendUrl()
}

function readLocalBrowserBackendUrl(): string {
  const configuredUrl = import.meta.env.VITE_LOCAL_BACKEND_URL

  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '')
  }

  return localDevBackendUrl
}

function readRemoteBrowserBackendUrl(): string {
  const configuredRemoteUrl = import.meta.env.VITE_REMOTE_BACKEND_URL

  if (typeof configuredRemoteUrl === 'string' && configuredRemoteUrl.trim()) {
    return configuredRemoteUrl.trim().replace(/\/$/, '')
  }

  const configuredUrl = import.meta.env.VITE_BACKEND_URL

  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '')
  }

  if (window.location?.pathname?.startsWith('/tos')) {
    return '/tos/desktop-api'
  }

  return remoteBackendUrl
}

function isHybridBackendRoutingMode(): boolean {
  return String(import.meta.env.VITE_BACKEND_ROUTING_MODE || '').trim().toLowerCase() === 'hybrid'
}

function shouldUseRemoteBackendByDefault(path: string): boolean {
  const normalizedPath = normalizeApiPath(path)
  return normalizedPath === '/api/release-updates'
    || normalizedPath.startsWith('/api/release-updates/')
    || normalizedPath === '/api/automation/templates'
    || normalizedPath.startsWith('/api/automation/templates/')
    || normalizedPath === '/api/process-history/records'
    || normalizedPath.startsWith('/api/process-history/records/')
    || normalizedPath.startsWith('/api/process-history/files/')
}

function normalizeApiPath(path: string): string {
  const [pathname] = String(path || '').split('?')
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

async function ensureBackendReady(): Promise<string | undefined> {
  if (!window.electronAPI?.startBackendServer) {
    return undefined
  }

  backendStartPromise ??= window.electronAPI
    .startBackendServer()
    .then((result) => {
      if (!result.success) {
        throw new Error(result.error || '无法启动后端服务')
      }

      return result.url
    })
    .finally(() => {
      backendStartPromise = null
    })

  return backendStartPromise
}

export async function postFormData<TResponse>({
  path,
  formData,
  onProgress,
  requireRuntimeVersion = false,
  backendTarget = 'default',
}: UploadRequestOptions): Promise<TResponse> {
  const baseUrl = await getBackendBaseUrl(backendTarget, path)
  if (requireRuntimeVersion) {
    await ensureBackendRuntimeVersion(baseUrl)
  }
  const url = buildBackendUrl(baseUrl, path)

  return new Promise<TResponse>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open('POST', url)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    request.onload = () => {
      const text = request.responseText || '{}'

      try {
        const data = parseJsonResponse<TResponse>(text, { status: request.status, path })

        if (request.status >= 200 && request.status < 300) {
          resolve(data)
        } else {
          reject(new Error(readResponseMessage(data, { status: request.status, path }) || `HTTP ${request.status}`))
        }
      } catch (error) {
        reject(error)
      }
    }

    request.onerror = () => {
      reject(new Error(backendConnectionErrorMessage))
    }

    request.send(formData)
  })
}

export async function buildBackendDownloadUrl(
  path: string,
  backendTarget: BackendTarget = 'default',
): Promise<string> {
  const baseUrl = await getBackendBaseUrl(backendTarget, path)
  return buildBackendUrl(baseUrl, path)
}

export async function downloadUrlAsFile(
  url: string,
  fallbackFilename = 'download',
): Promise<void> {
  let response: Response
  try {
    response = await fetch(url, { method: 'GET' })
  } catch (_error) {
    throw new Error('无法连接安装包下载服务，请确认本地后端已启动，或服务器网络可访问。')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(readDownloadResponseMessage(text, {
      status: response.status,
      path: readUrlPath(url),
    }))
  }

  const blob = await response.blob()
  if (blob.size <= 0) {
    throw new Error('安装包下载失败：服务器返回的文件内容为空，请重新打包并上传安装包。')
  }

  const filename = readDownloadFilename(response.headers.get('content-disposition'))
    || fallbackFilename
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.rel = 'noopener'
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500)
}

export async function requestBackendJson<TResponse>({
  method = 'GET',
  path,
  body,
  requireRuntimeVersion = false,
  timeoutMs = 20000,
  backendTarget = 'default',
}: JsonRequestOptions): Promise<TResponse> {
  const baseUrl = await getBackendBaseUrl(backendTarget, path)
  if (requireRuntimeVersion) {
    await ensureBackendRuntimeVersion(baseUrl)
  }
  const headers: Record<string, string> = {}
  let requestBody: string | undefined

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  let response: Response
  const controller = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? new AbortController()
    : undefined
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : undefined
  try {
    const requestInit: RequestInit = {
      method,
      headers,
      body: requestBody,
    }
    if (controller) {
      requestInit.signal = controller.signal
    }
    response = await fetch(buildBackendUrl(baseUrl, path), requestInit)
  } catch (_error) {
    throw new Error(backendConnectionErrorMessage)
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId)
    }
  }
  const text = await response.text()
  const data = parseJsonResponse<TResponse>(text, { status: response.status, path })

  if (!response.ok) {
    throw new Error(readResponseMessage(data, { status: response.status, path }) || `HTTP ${response.status}`)
  }

  return data
}

export async function ensureBackendRuntimeVersion(baseUrl?: string): Promise<void> {
  const backendBaseUrl = baseUrl ?? await getBackendBaseUrl()

  if (isRemoteServerBackend(backendBaseUrl)) {
    return
  }

  const backendVersion = await readBackendRuntimeVersion(backendBaseUrl)
  const frontendVersion = normalizeVersion(fallbackAppVersion)

  if (!backendVersion || backendVersion === frontendVersion) {
    return
  }

  throw new Error(buildBackendVersionMismatchMessage(backendVersion, frontendVersion))
}

export function buildBackendVersionMismatchMessage(
  backendVersion: string,
  frontendVersion = fallbackAppVersion,
): string {
  return `${backendVersionMismatchPrefix}：后端为 ${backendVersion}，前端为 ${frontendVersion}，请重启本地后端。`
}

export function isBackendVersionMismatchMessage(message: string): boolean {
  return message.includes(backendVersionMismatchPrefix)
}

export function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function buildNonJsonResponseMessage(
  context: ResponseMessageContext & { preview?: string } = {},
): string {
  const statusText = context.status ? `HTTP ${context.status}` : '无状态码'
  const pathText = context.path ? `，接口：${context.path}` : ''
  const preview = String(context.preview || '').replace(/\s+/g, ' ').trim().slice(0, 160)

  return `接口返回内容不是系统可识别的 JSON（${statusText}${pathText}）。可能是后端/执行器返回了 HTML 错误页、空响应，或服务已退出。请重启本机后端或自动化执行器后重试${preview ? `。响应开头：${preview}` : '。'}`
}

export function readResponseMessage(
  data: unknown,
  context: ResponseMessageContext = {},
): string | undefined {
  if (isApiNotFound(data, context)) {
    return backendApiNotFoundMessage
  }

  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) => formatValidationDetail(entry))
        .filter((entry): entry is string => Boolean(entry))

      return messages.length > 0 ? messages.join('；') : undefined
    }
  }

  return undefined
}

function isApiNotFound(data: unknown, context: ResponseMessageContext): boolean {
  if (context.status !== 404 || !context.path?.startsWith('/api/')) {
    return false
  }

  if (!data || typeof data !== 'object' || !('detail' in data)) {
    return false
  }

  return (data as { detail?: unknown }).detail === 'Not Found'
}

function parseJsonResponse<TResponse>(text: string, context: ResponseMessageContext = {}): TResponse {
  if (!text) {
    return {} as TResponse
  }

  try {
    return JSON.parse(text) as TResponse
  } catch (_error) {
    throw new Error(buildNonJsonResponseMessage({ ...context, preview: text }))
  }
}

function buildBackendUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl.replace(/\/$/, '')}${normalizedPath}`
}

function readDownloadResponseMessage(text: string, context: ResponseMessageContext): string {
  const trimmed = String(text || '').trim()
  if (trimmed) {
    try {
      const data = JSON.parse(trimmed) as unknown
      const message = readResponseMessage(data, context)
      if (message) {
        return message
      }
    } catch (_error) {
      const preview = trimmed.replace(/\s+/g, ' ').slice(0, 120)
      return `安装包下载失败（HTTP ${context.status || '未知'}）：服务器返回了无法识别的内容。${preview ? `响应开头：${preview}` : ''}`
    }
  }

  if (context.status === 404) {
    return '安装包下载失败：服务器还没有上传对应安装包，请先完成打包并上传到 MinIO 后再下载。'
  }

  return `安装包下载失败（HTTP ${context.status || '未知'}），请稍后重试或检查服务器发布状态。`
}

function readDownloadFilename(contentDisposition: string | null): string {
  const header = String(contentDisposition || '')
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''))
    } catch (_error) {
      return encodedMatch[1].trim().replace(/^"|"$/g, '')
    }
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(header)
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim()
  }

  const plainMatch = /filename=([^;]+)/i.exec(header)
  return plainMatch?.[1]?.trim().replace(/^"|"$/g, '') || ''
}

function readUrlPath(url: string): string {
  try {
    return new URL(url, window.location?.href || 'http://127.0.0.1').pathname
  } catch (_error) {
    return url
  }
}

async function readBackendRuntimeVersion(baseUrl: string): Promise<string | undefined> {
  let response: Response
  const runtimeVersionPath = isRemoteServerBackend(baseUrl)
    ? '/api/system/config/installer-versions'
    : '/'

  try {
    response = await fetch(buildBackendUrl(baseUrl, runtimeVersionPath), { method: 'GET' })
  } catch (_error) {
    throw new Error(backendConnectionErrorMessage)
  }

  if (!response.ok) {
    return undefined
  }

  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    const payload = JSON.parse(text) as { version?: unknown }
    return typeof payload.version === 'string'
      ? normalizeVersion(payload.version)
      : undefined
  } catch (_error) {
    return undefined
  }
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function isRemoteServerBackend(baseUrl: string): boolean {
  const normalized = String(baseUrl || '').trim().replace(/\/$/, '').toLowerCase()
  return normalized === '/tos/desktop-api'
    || normalized === remoteBackendUrl.toLowerCase()
    || normalized.endsWith('/tos/desktop-api')
}

function formatValidationDetail(entry: unknown): string | undefined {
  if (!entry || typeof entry !== 'object') {
    return undefined
  }

  const detail = entry as { loc?: unknown; msg?: unknown }
  const fieldPath = Array.isArray(detail.loc)
    ? detail.loc
        .map((part) => String(part))
        .filter((part) => part !== 'body')
        .join('.')
    : ''
  const message = typeof detail.msg === 'string' ? detail.msg : ''

  if (message === 'Field required' && fieldPath) {
    return `缺少必传字段 ${fieldPath}`
  }

  if (fieldPath && message) {
    return `${fieldPath}: ${message}`
  }

  return message || fieldPath || undefined
}
