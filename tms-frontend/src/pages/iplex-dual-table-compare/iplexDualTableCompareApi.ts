import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface IplexDualTableHeader {
  index: number
  letter: string
  label: string
  sample_value: string
}

export interface IplexDualTableSheetSummary {
  name: string
  max_row: number
  max_column: number
}

export interface IplexDualTableSelectedSheet {
  name: string
  header_row: number
  max_row: number
  max_column: number
  data_row_count: number
  headers: IplexDualTableHeader[]
}

export interface IplexDualTableInspectionResponse {
  sheets: IplexDualTableSheetSummary[]
  selected_sheet: IplexDualTableSelectedSheet
}

export interface InspectIplexDualTableWorkbookRequest {
  file: File
  sheetName?: string
  headerRow: number
}

export interface IplexDualTableCompareConfig {
  main_sheet_name: string
  lookup_sheet_name: string
  main_header_row: number
  lookup_header_row: number
  main_key_column: number
  lookup_key_column: number
  four_digit_main_column: number
  four_digit_lookup_column: number
  two_digit_main_column: number
  two_digit_lookup_column: number
  four_digit_result_header?: string
  two_digit_result_header?: string
}

export interface IplexDualTableCompareProcessRequest {
  mainFile: File
  lookupFile: File
  config: IplexDualTableCompareConfig
}

export interface IplexDualTableComparePreviewMetric {
  main_value: string
  lookup_value: string
  difference: string
}

export interface IplexDualTableComparePreviewRow {
  row_number: number
  key: string
  status: '不一致' | '未匹配'
  four_digit: IplexDualTableComparePreviewMetric
  two_digit: IplexDualTableComparePreviewMetric
}

export interface IplexDualTableCompareProcessResponse {
  success: boolean
  message: string
  output_file?: string
  main_row_count?: number
  lookup_row_count?: number
  matched_count?: number
  unmatched_count?: number
  four_digit_mismatch_count?: number
  two_digit_mismatch_count?: number
  preview_rows?: IplexDualTableComparePreviewRow[]
  logs?: string[]
}

export async function inspectIplexDualTableWorkbook(
  request: InspectIplexDualTableWorkbookRequest,
): Promise<IplexDualTableInspectionResponse> {
  const formData = new FormData()

  formData.append('excel_file', request.file)
  formData.append('header_row', String(request.headerRow))
  if (request.sheetName) {
    formData.append('sheet_name', request.sheetName)
  }

  return postFormData<IplexDualTableInspectionResponse>({
    path: '/api/iplex/dual-table-compare/inspect',
    formData,
  })
}

export async function processIplexDualTableCompareFiles(
  request: IplexDualTableCompareProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<IplexDualTableCompareProcessResponse> {
  const formData = new FormData()

  formData.append('main_file', request.mainFile)
  formData.append('lookup_file', request.lookupFile)
  formData.append('config_json', JSON.stringify(request.config))

  return postFormData<IplexDualTableCompareProcessResponse>({
    path: '/api/iplex/dual-table-compare/process',
    formData,
    onProgress,
  })
}

export async function downloadIplexDualTableCompareResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/iplex/dual-table-compare/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'iplex_dual_table_compare.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
