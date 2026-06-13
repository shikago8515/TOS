export interface UploadRequestOptions {
  path: string
  formData: FormData
  onProgress?: (percentage: number) => void
}

export interface ResponseMessageContext {
  status?: number
  path?: string
}

const backendApiNotFoundMessage = '当前后端版本缺少此接口，请重启 TOS 或等待后端切换完成'

let backendStartPromise: Promise<string | undefined> | null = null

export async function getBackendBaseUrl(): Promise<string> {
  const startedBackendUrl = await ensureBackendReady()

  if (startedBackendUrl) {
    return startedBackendUrl.replace(/\/$/, '')
  }

  const backendUrl = await window.electronAPI?.getBackendUrl()

  if (backendUrl) {
    return backendUrl.replace(/\/$/, '')
  }

  return import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
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
}: UploadRequestOptions): Promise<TResponse> {
  const baseUrl = await getBackendBaseUrl()
  const url = `${baseUrl}${path}`

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
        const data = JSON.parse(text) as TResponse

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
      reject(new Error('无法连接后端服务'))
    }

    request.send(formData)
  })
}

export async function buildBackendDownloadUrl(path: string): Promise<string> {
  const baseUrl = await getBackendBaseUrl()
  return `${baseUrl}${path}`
}

export function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
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
