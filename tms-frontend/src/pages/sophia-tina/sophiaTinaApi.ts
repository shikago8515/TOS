import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface SophiaTinaProcessRequest {
  tmsFiles: File[]
  articleFiles: File[]
  priceFiles: File[]
  packFiles: File[]
}

export interface SophiaTinaProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  working_count?: number
  result_count?: number
  diagnostics_count?: number
  logs?: string[]
}

export async function processSophiaTinaFiles(
  request: SophiaTinaProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<SophiaTinaProcessResponse> {
  const formData = new FormData()

  request.tmsFiles.forEach((file) => {
    formData.append('tms_files', file)
  })
  request.articleFiles.forEach((file) => {
    formData.append('article_files', file)
  })
  request.priceFiles.forEach((file) => {
    formData.append('price_files', file)
  })
  request.packFiles.forEach((file) => {
    formData.append('pack_files', file)
  })

  return postFormData<SophiaTinaProcessResponse>({
    path: '/api/sophia-tina/process',
    formData,
    onProgress,
  })
}

export async function downloadSophiaTinaResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/sophia-tina/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'sophia_tina_result.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
