import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface EricProcessRequest {
  excelFile: File
}

export interface EricProcessResponse {
  success: boolean
  message: string
  logs?: string[]
  row_count?: number
  output_file?: string
}

export async function processEricFile(
  request: EricProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<EricProcessResponse> {
  const formData = new FormData()

  formData.append('excel_file', request.excelFile)

  return postFormData<EricProcessResponse>({
    path: '/api/eric/process',
    formData,
    onProgress,
  })
}

export async function downloadEricResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/eric/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'eric_final_data.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
