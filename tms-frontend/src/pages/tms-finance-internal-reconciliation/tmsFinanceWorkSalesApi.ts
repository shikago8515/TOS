import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface TmsFinanceWorkSalesRequest {
  bulkSalesFile: File
  turnoverFile: File
}

export interface TmsFinanceWorkSalesTotals {
  sales_written_count?: number
  purchase_written_count?: number
  cleared_sales_count?: number
  cleared_purchase_count?: number
  sales_appended_rows?: number
  purchase_appended_rows?: number
  duplicate_rows?: number
}

export interface TmsFinanceWorkSalesSourceSummary {
  source_rows?: number
  sales_rows?: number
  purchase_rows?: number
  sales_written_rows?: number
  purchase_written_rows?: number
  cleared_sales_rows?: number
  cleared_purchase_rows?: number
  duplicate_rows?: number
}

export interface TmsFinanceWorkSalesResponse {
  success: boolean
  message: string
  error?: string
  output_file?: string
  result_file?: string
  source_row_count?: number
  extracted_count?: number
  sales_written_count?: number
  purchase_written_count?: number
  cleared_sales_count?: number
  cleared_purchase_count?: number
  sales_appended_count?: number
  purchase_appended_count?: number
  duplicate_count?: number
  diagnostic_count?: number
  totals?: TmsFinanceWorkSalesTotals
  source_summary?: TmsFinanceWorkSalesSourceSummary
  logs?: string[]
}

export async function processTmsFinanceWorkSalesFiles(
  request: TmsFinanceWorkSalesRequest,
  onProgress: (percentage: number) => void,
): Promise<TmsFinanceWorkSalesResponse> {
  const formData = new FormData()

  formData.append('bulk_sales_file', request.bulkSalesFile)
  formData.append('turnover_file', request.turnoverFile)

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
