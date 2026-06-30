import type { ProcessSummaryItem } from '../../shared/process/processHistory'

export const excelTemplateMapperModuleId = 'excel-template-mapper-test'
export const excelTemplateMapperModuleName = '通用 Excel 映射测试'
export const excelTemplateMapperStorageKey = 'tos.excelTemplateMapperTest.mapping.v1'

export interface ExcelTemplateMapperHeader {
  index: number
  letter: string
  label: string
  sample_value: string
}

export interface ExcelTemplateMapperFieldMapping {
  targetColumn: number
  targetHeader: string
  sourceColumn: number
  sourceHeader: string
  required: boolean
}

export function normalizeExcelFieldLabel(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export function buildAutoFieldMappings(
  sourceHeaders: readonly ExcelTemplateMapperHeader[],
  templateHeaders: readonly ExcelTemplateMapperHeader[],
): ExcelTemplateMapperFieldMapping[] {
  return templateHeaders.map((templateHeader) => {
    const exactMatch = sourceHeaders.find((sourceHeader) => sourceHeader.label === templateHeader.label)
    const normalizedTemplateLabel = normalizeExcelFieldLabel(templateHeader.label)
    const normalizedMatch = sourceHeaders.find(
      (sourceHeader) => normalizeExcelFieldLabel(sourceHeader.label) === normalizedTemplateLabel,
    )
    const sourceHeader = exactMatch ?? normalizedMatch

    return {
      targetColumn: templateHeader.index,
      targetHeader: templateHeader.label,
      sourceColumn: sourceHeader?.index ?? 0,
      sourceHeader: sourceHeader?.label ?? '',
      required: true,
    }
  })
}

export function toBackendFieldMappings(mappings: readonly ExcelTemplateMapperFieldMapping[]) {
  return mappings.map((mapping) => ({
    target_column: mapping.targetColumn,
    source_column: mapping.sourceColumn,
    target_header: mapping.targetHeader,
    source_header: mapping.sourceHeader,
    required: mapping.required,
  }))
}

export function buildExcelTemplateMapperSummary(response: {
  source_row_count?: number
  written_row_count?: number
  mapped_field_count?: number
  output_file?: string
}): ProcessSummaryItem[] {
  return [
    {
      label: '源数据行数',
      value: String(response.source_row_count ?? '-'),
    },
    {
      label: '写入行数',
      value: String(response.written_row_count ?? '-'),
    },
    {
      label: '映射字段数',
      value: String(response.mapped_field_count ?? '-'),
    },
    {
      label: '结果文件',
      value: response.output_file ? '已生成' : '未生成',
    },
  ]
}
