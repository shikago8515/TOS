export interface UploadRequestOptions {
  path: string
  formData: FormData
  onProgress?: (percentage: number) => void
}

export async function getBackendBaseUrl(): Promise<string> {
  const backendUrl = await window.electronAPI?.getBackendUrl()

  if (backendUrl) {
    return backendUrl.replace(/\/$/, '')
  }

  return ''
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
          reject(new Error(readResponseMessage(data) || `HTTP ${request.status}`))
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

function readResponseMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
  }

  return undefined
}
