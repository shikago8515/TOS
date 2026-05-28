import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface JaneBomCompareProcessRequest {
  productionFile: File
  bomFiles: File[]
}

export interface JaneBomCompareProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  bom_count?: number
  bom_material_row_count?: number
  checked_row_count?: number
  mismatch_cell_count?: number
  missing_row_count?: number
  no_bom_key_count?: number
  logs?: string[]
}

export async function processJaneBomCompareFiles(
  request: JaneBomCompareProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JaneBomCompareProcessResponse> {
  const formData = new FormData()

  formData.append('production_file', request.productionFile)
  request.bomFiles.forEach((file) => {
    formData.append('bom_files', file)
  })

  return postFormData<JaneBomCompareProcessResponse>({
    path: '/api/jane-bom-compare/process',
    formData,
    onProgress,
  })
}

export async function downloadJaneBomCompareResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/jane-bom-compare/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'jane_bom_compare.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
