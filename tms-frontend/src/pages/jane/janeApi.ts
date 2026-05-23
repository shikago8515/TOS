import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface JaneProcessRequest {
  tmsFile: File
  countryFile: File
  workingFilters: string
}

export interface JaneProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  working_count?: number
  logs?: string[]
}

export async function processJaneFiles(
  request: JaneProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JaneProcessResponse> {
  const formData = new FormData()

  formData.append('tms_file', request.tmsFile)
  formData.append('country_file', request.countryFile)

  if (request.workingFilters.trim()) {
    formData.append('working_filters', request.workingFilters)
  }

  return postFormData<JaneProcessResponse>({
    path: '/api/jane/process',
    formData,
    onProgress,
  })
}

export async function downloadJaneResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/jane/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'jane_result.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
