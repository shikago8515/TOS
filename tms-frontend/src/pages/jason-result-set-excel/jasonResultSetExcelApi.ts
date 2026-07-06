import { postFormData } from '../../shared/api/backendClient'

export interface JasonResultSetExcelProcessRequest {
  resultSetFile: File
  targetMonth: string
}

export interface JasonResultSetExcelProcessResponse {
  success: boolean
  message: string
  error?: string
  output_file?: string
  target_month?: string
  written_row_count?: number
  not_shipped_row_count?: number
  partial_row_count?: number
  unknown_lookup_count?: number
  warnings?: string[]
  request_id?: string
  history_id?: string
  result_file_id?: number | null
  result_download_path?: string
  result_download_backend_target?: 'default' | 'local' | 'remote'
  result_file?: {
    id: number
    filename: string
    contentType?: string
    fileSize?: number
    sha256?: string
    downloadPath: string
  } | null
  history_warnings?: string[]
}

export async function processJasonResultSetExcel(
  request: JasonResultSetExcelProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<JasonResultSetExcelProcessResponse> {
  const formData = new FormData()
  formData.append('result_set_file', request.resultSetFile)
  formData.append('target_month', request.targetMonth.trim())

  return postFormData<JasonResultSetExcelProcessResponse>({
    path: '/api/jason/result-set-excel/process',
    formData,
    onProgress,
  })
}
