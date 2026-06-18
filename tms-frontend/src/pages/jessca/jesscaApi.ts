import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface JesscaProcessRequest {
  invoiceFiles: File[]
  referenceFile: File
  packingFile?: File
}

export interface JesscaProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  invoice_count?: number
  total_items?: number
  matches?: Record<string, number>
  diagnostics?: Record<string, number>
  packing_count?: number
  packing_matched_count?: number
  packing_issue_count?: number
}

export async function processJesscaFiles(
  request: JesscaProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JesscaProcessResponse> {
  const formData = new FormData()

  request.invoiceFiles.forEach((file) => {
    formData.append('invoices', file)
  })
  formData.append('reference_file', request.referenceFile)
  if (request.packingFile) {
    formData.append('packing_file', request.packingFile)
  }

  return postFormData<JesscaProcessResponse>({
    path: '/api/jessca/process',
    formData,
    onProgress,
  })
}

export async function downloadJesscaResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/jessca/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'jessca_result.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
