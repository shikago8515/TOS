import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface JaneOutboundCompareProcessRequest {
  outboundFile: File
  tmsFile: File
}

export interface JaneOutboundCompareProcessResponse {
  success: boolean
  message: string
  error?: string
  result_file?: string
  output_file?: string
  checked_row_count?: number
  matched_row_count?: number
  missing_tms_row_count?: number
  missing_outbound_row_count?: number
  difference_cell_count?: number
  issue_count?: number
  logs?: string[]
}

export async function processJaneOutboundCompareFiles(
  request: JaneOutboundCompareProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JaneOutboundCompareProcessResponse> {
  const formData = new FormData()

  formData.append('outbound_file', request.outboundFile)
  formData.append('tms_file', request.tmsFile)

  return postFormData<JaneOutboundCompareProcessResponse>({
    path: '/api/jane-outbound-compare/process',
    formData,
    onProgress,
  })
}

export async function downloadJaneOutboundCompareResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/jane-outbound-compare/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'jane_outbound_compare.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
