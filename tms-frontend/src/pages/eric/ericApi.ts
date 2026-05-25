import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface EricProcessRequest {
  excelFile: File
}

export interface EricReconcileRequest {
  packFile: File
  yticFile: File
}

export interface EricProcessResponse {
  success: boolean
  message: string
  logs?: string[]
  row_count?: number
  output_file?: string
  difference_count?: number
  po_difference_count?: number
  size_check_count?: number
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

export async function reconcileEricFiles(
  request: EricReconcileRequest,
  onProgress: (percentage: number) => void,
): Promise<EricProcessResponse> {
  const formData = new FormData()

  formData.append('pack_file', request.packFile)
  formData.append('ytic_file', request.yticFile)

  return postFormData<EricProcessResponse>({
    path: '/api/eric/reconcile',
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
  anchor.download = 'eric_reconciliation.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
