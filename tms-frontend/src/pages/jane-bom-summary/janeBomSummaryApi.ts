import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface JaneBomSummaryProcessRequest {
  bomFiles: File[]
  packFile: File
}

export interface JaneBomSummaryProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  bom_count?: number
  row_count?: number
  logs?: string[]
}

export async function processJaneBomSummaryFiles(
  request: JaneBomSummaryProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JaneBomSummaryProcessResponse> {
  const formData = new FormData()

  request.bomFiles.forEach((file) => {
    formData.append('bom_files', file)
  })
  formData.append('pack_file', request.packFile)

  return postFormData<JaneBomSummaryProcessResponse>({
    path: '/api/jane-bom-summary/process',
    formData,
    onProgress,
  })
}

export async function downloadJaneBomSummaryResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/jane-bom-summary/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'jane_bom_summary.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
