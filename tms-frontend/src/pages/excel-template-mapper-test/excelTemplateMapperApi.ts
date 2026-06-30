import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface ExcelTemplateMapperHeader {
  index: number
  letter: string
  label: string
  sample_value: string
}

export interface ExcelTemplateMapperSheetSummary {
  name: string
  max_row: number
  max_column: number
}

export interface ExcelTemplateMapperSampleRow {
  row_number: number
  values: string[]
}

export interface ExcelTemplateMapperSelectedSheet {
  name: string
  header_row: number
  max_row: number
  max_column: number
  data_row_count: number
  headers: ExcelTemplateMapperHeader[]
  sample_rows: ExcelTemplateMapperSampleRow[]
}

export interface ExcelTemplateMapperInspectionResponse {
  sheets: ExcelTemplateMapperSheetSummary[]
  selected_sheet: ExcelTemplateMapperSelectedSheet
}

export interface InspectExcelTemplateMapperWorkbookRequest {
  file?: File
  templateId?: number
  sheetName?: string
  headerRow: number
}

export interface ExcelTemplateMapperFieldMappingConfig {
  target_column: number
  source_column: number
  target_header?: string
  source_header?: string
  required?: boolean
}

export interface ExcelTemplateMapperProcessConfig {
  source_sheet_name: string
  template_sheet_name: string
  source_header_row: number
  source_data_start_row: number
  template_header_row: number
  template_data_start_row: number
  mappings: ExcelTemplateMapperFieldMappingConfig[]
}

export interface ExcelTemplateMapperProcessRequest {
  sourceFile: File
  templateFile?: File | null
  templateId?: number | null
  config: ExcelTemplateMapperProcessConfig
}

export interface ExcelTemplateMapperProcessResponse {
  success: boolean
  message: string
  output_file?: string
  source_row_count?: number
  written_row_count?: number
  mapped_field_count?: number
  unmapped_required_fields?: string[]
}

export async function inspectExcelTemplateMapperWorkbook(
  request: InspectExcelTemplateMapperWorkbookRequest,
): Promise<ExcelTemplateMapperInspectionResponse> {
  const formData = new FormData()
  if (request.file) {
    formData.append('excel_file', request.file)
  }
  if (request.templateId) {
    formData.append('template_id', String(request.templateId))
  }
  formData.append('header_row', String(request.headerRow))
  if (request.sheetName) {
    formData.append('sheet_name', request.sheetName)
  }

  return postFormData<ExcelTemplateMapperInspectionResponse>({
    path: '/api/excel-template-mapper/inspect',
    formData,
  })
}

export async function processExcelTemplateMapperFiles(
  request: ExcelTemplateMapperProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<ExcelTemplateMapperProcessResponse> {
  const formData = new FormData()
  formData.append('source_file', request.sourceFile)
  if (request.templateFile) {
    formData.append('template_file', request.templateFile)
  }
  if (request.templateId) {
    formData.append('template_id', String(request.templateId))
  }
  formData.append('config_json', JSON.stringify(request.config))

  return postFormData<ExcelTemplateMapperProcessResponse>({
    path: '/api/excel-template-mapper/process',
    formData,
    onProgress,
  })
}

export async function downloadExcelTemplateMapperResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/excel-template-mapper/download/${encodeURIComponent(filename)}`,
  )
  if (typeof document === 'undefined') {
    return
  }

  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = filename || 'excel_template_mapper_result.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
