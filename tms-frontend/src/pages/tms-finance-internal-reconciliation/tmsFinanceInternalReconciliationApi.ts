import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface TmsFinanceInternalReconciliationRequest {
  sourceFiles: File[]
  targetFile: File
}

export interface TmsFinanceInternalReconciliationTotals {
  quantity?: number
  purchase_amount?: number
  sales_amount_with_tax?: number
}

export interface TmsFinanceInternalReconciliationSourceSummary {
  sample_rows?: number
  book_rows?: number
  bulk_rows?: number
  source_rows?: number
  source_files?: number
}

export interface TmsFinanceInternalReconciliationResponse {
  success: boolean
  message: string
  error?: string
  output_file?: string
  result_file?: string
  updated_count?: number
  source_row_count?: number
  target_row_count?: number
  excluded_rows?: number[]
  excluded_columns?: number[]
  appended_count?: number
  skipped_count?: number
  duplicate_count?: number
  diagnostic_count?: number
  totals?: TmsFinanceInternalReconciliationTotals
  source_summary?: TmsFinanceInternalReconciliationSourceSummary
  logs?: string[]
}

export async function processTmsFinanceInternalReconciliationFiles(
  request: TmsFinanceInternalReconciliationRequest,
  onProgress: (percentage: number) => void,
): Promise<TmsFinanceInternalReconciliationResponse> {
  const formData = new FormData()

  request.sourceFiles.forEach((sourceFile) => {
    formData.append('source_files', sourceFile)
  })
  formData.append('target_file', request.targetFile)

  return postFormData<TmsFinanceInternalReconciliationResponse>({
    path: '/api/tms-finance/internal-reconciliation/process',
    formData,
    onProgress,
  })
}

export async function downloadTmsFinanceInternalReconciliationResult(
  filename: string,
): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/tms-finance/internal-reconciliation/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'tms_finance_internal_reconciliation.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
