import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface TmsFinanceWorkSalesRequest {
  iplixFile: File
  referenceFile?: File
}

export interface TmsFinanceWorkSalesTotals {
  sales_unit_price_total?: number
  purchase_unit_price_total?: number
}

export interface TmsFinanceWorkSalesSourceSummary {
  sales_rows?: number
  purchase_rows?: number
  reference_rows?: number
}

export interface TmsFinanceWorkSalesResponse {
  success: boolean
  message: string
  error?: string
  output_file?: string
  result_file?: string
  extracted_count?: number
  matched_reference_count?: number
  missing_reference_count?: number
  diagnostic_count?: number
  month_label?: string
  totals?: TmsFinanceWorkSalesTotals
  source_summary?: TmsFinanceWorkSalesSourceSummary
  logs?: string[]
}

export async function processTmsFinanceWorkSalesFiles(
  request: TmsFinanceWorkSalesRequest,
  onProgress: (percentage: number) => void,
): Promise<TmsFinanceWorkSalesResponse> {
  const formData = new FormData()

  formData.append('iplix_file', request.iplixFile)
  if (request.referenceFile) {
    formData.append('reference_file', request.referenceFile)
  }

  return postFormData<TmsFinanceWorkSalesResponse>({
    path: '/api/tms-finance/work-sales/process',
    formData,
    onProgress,
  })
}

export async function downloadTmsFinanceWorkSalesResult(
  filename: string,
): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/tms-finance/work-sales/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'tms_finance_work_sales.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
