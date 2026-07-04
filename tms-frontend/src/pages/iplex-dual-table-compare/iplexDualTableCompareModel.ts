import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type {
  IplexDualTableCompareProcessRequest,
  IplexDualTableCompareProcessResponse,
  IplexDualTableComparePreviewRow,
  IplexDualTableHeader,
  IplexDualTableInspectionResponse,
} from './iplexDualTableCompareApi'

export const iplexDualTableCompareModuleId = 'iplex-dual-table-compare'
export const iplexDualTableCompareModuleName = '数据核对'

export interface IplexDualTableBusinessSelection {
  poFile: File
  rcFile: File
  poSheetName: string
  rcSheetName: string
  poHeaderRow: number
  rcHeaderRow: number
  poKeyColumn: number
  rcKeyColumn: number
  poFourDigitColumn: number
  rcFourDigitColumn: number
  poTwoDigitColumn: number
  rcTwoDigitColumn: number
}

export interface IplexDualTableAutoSelection {
  poFile: File
  rcFile: File
  poInspection: IplexDualTableInspectionResponse
  rcInspection: IplexDualTableInspectionResponse
}

export function buildIplexDualTableCompareSummary(
  response: IplexDualTableCompareProcessResponse,
): ProcessSummaryItem[] {
  return [
    {
      label: '目标表输出行数',
      value: String(response.main_row_count ?? '-'),
    },
    {
      label: '汇总表查找行数',
      value: String(response.lookup_row_count ?? '-'),
    },
    {
      label: '匹配行数',
      value: String(response.matched_count ?? '-'),
    },
    {
      label: '未匹配行数',
      value: String(response.unmatched_count ?? '-'),
    },
    {
      label: '4位小数差异',
      value: String(response.four_digit_mismatch_count ?? '-'),
    },
    {
      label: '2位小数差异',
      value: String(response.two_digit_mismatch_count ?? '-'),
    },
    {
      label: '结果文件',
      value: response.output_file ? '已生成' : response.success ? '可下载' : '未生成',
    },
  ]
}

export function buildAutoIplexDualTableCompareProcessRequest(
  selection: IplexDualTableAutoSelection,
): IplexDualTableCompareProcessRequest {
  const poSheet = selection.poInspection.selected_sheet
  const rcSheet = selection.rcInspection.selected_sheet

  return buildIplexDualTableCompareProcessRequest({
    poFile: selection.poFile,
    rcFile: selection.rcFile,
    poSheetName: poSheet.name,
    rcSheetName: rcSheet.name,
    poHeaderRow: poSheet.header_row,
    rcHeaderRow: rcSheet.header_row,
    poKeyColumn: findRequiredSuggestedColumn(poSheet.headers, 'PO #', {
      fieldLabel: '汇总表 Key 列',
      preferredLetter: 'A',
    }),
    rcKeyColumn: findRequiredSuggestedColumn(rcSheet.headers, 'BUYER ORDER NO.', {
      fieldLabel: '目标表 Key 列',
      preferredLetter: 'C',
    }),
    poFourDigitColumn: findRequiredSuggestedColumn(poSheet.headers, 'Adjustment_per_unit', {
      fieldLabel: '汇总表 4位数值列',
      preferredLetter: 'AE',
    }),
    rcFourDigitColumn: findRequiredSuggestedColumn(rcSheet.headers, 'SHAS PRICE PER UNIT', {
      fieldLabel: '目标表 4位数值列',
      preferredLetter: 'G',
    }),
    poTwoDigitColumn: findRequiredSuggestedColumn(poSheet.headers, 'Total Adjustment Amount', {
      fieldLabel: '汇总表 2位数值列',
      preferredLetter: 'AF',
      preferLast: true,
    }),
    rcTwoDigitColumn: findRequiredSuggestedColumn(rcSheet.headers, 'TOTAL ADJUSTMENT', {
      fieldLabel: '目标表 2位数值列',
      preferredLetter: 'J',
    }),
  })
}

export function buildIplexDualTableCompareProcessRequest(
  selection: IplexDualTableBusinessSelection,
): IplexDualTableCompareProcessRequest {
  return {
    mainFile: selection.rcFile,
    lookupFile: selection.poFile,
    config: {
      main_sheet_name: selection.rcSheetName,
      lookup_sheet_name: selection.poSheetName,
      main_header_row: selection.rcHeaderRow,
      lookup_header_row: selection.poHeaderRow,
      main_key_column: selection.rcKeyColumn,
      lookup_key_column: selection.poKeyColumn,
      four_digit_main_column: selection.rcFourDigitColumn,
      four_digit_lookup_column: selection.poFourDigitColumn,
      two_digit_main_column: selection.rcTwoDigitColumn,
      two_digit_lookup_column: selection.poTwoDigitColumn,
      four_digit_result_header: 'SHAS PRICE PER UNIT 差值',
      two_digit_result_header: 'TOTAL ADJUSTMENT 差值',
    },
  }
}

export function getIplexDualTablePreviewRows(
  response: IplexDualTableCompareProcessResponse,
): IplexDualTableComparePreviewRow[] {
  return response.preview_rows ?? []
}

interface SuggestedColumnOptions {
  preferredLetter?: string
  preferLast?: boolean
}

interface RequiredSuggestedColumnOptions extends SuggestedColumnOptions {
  fieldLabel: string
}

export function findSuggestedColumn(
  headers: readonly Pick<IplexDualTableHeader, 'index' | 'label' | 'letter'>[],
  expectedLabel: string,
  options: SuggestedColumnOptions = {},
): number {
  const normalizedExpected = normalizeHeaderLabel(expectedLabel)
  const matchedHeaders = headers.filter((entry) => normalizeHeaderLabel(entry.label) === normalizedExpected)
  const preferredLetter = options.preferredLetter?.trim().toUpperCase()
  const preferredHeader = preferredLetter
    ? matchedHeaders.find((entry) => entry.letter.toUpperCase() === preferredLetter)
    : undefined
  const header =
    preferredHeader ??
    (options.preferLast ? matchedHeaders[matchedHeaders.length - 1] : matchedHeaders[0])

  return header?.index ?? 0
}

function findRequiredSuggestedColumn(
  headers: readonly Pick<IplexDualTableHeader, 'index' | 'label' | 'letter'>[],
  expectedLabel: string,
  options: RequiredSuggestedColumnOptions,
): number {
  const column = findSuggestedColumn(headers, expectedLabel, options)
  if (column > 0) {
    return column
  }

  const preferred = options.preferredLetter ? `${options.preferredLetter} / ` : ''
  throw new Error(`${options.fieldLabel}：未找到 ${preferred}${expectedLabel}`)
}

function normalizeHeaderLabel(label: string): string {
  return label.trim().toLowerCase()
}
