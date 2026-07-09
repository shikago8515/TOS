import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JasonResultSetExcelProcessResponse } from './jasonResultSetExcelApi'

export const jasonResultSetExcelModuleId = 'jason-result-set-excel'
export const jasonResultSetExcelModuleName = 'Jason / Result Set Excel'

export type JasonResultSetExcelDateFilterMode = 'range' | 'none'
export type JasonResultSetExcelOrderTypeFilter = 'bulk' | 'sample' | 'bulk_sample'

export interface JasonResultSetExcelDateRange {
  dateFrom: string
  dateTo: string
}

export interface JasonResultSetExcelOrderTypeOption {
  value: JasonResultSetExcelOrderTypeFilter
  label: string
}

export interface JasonResultSetExcelInputState {
  resultSetFileCount: number
  dateFilterLabel: string
  orderTypeLabel: string
}

export const jasonResultSetExcelOrderTypeOptions: JasonResultSetExcelOrderTypeOption[] = [
  { value: 'bulk', label: 'Bulk' },
  { value: 'sample', label: 'Sample' },
  { value: 'bulk_sample', label: 'Bulk + Sample' },
]

export const jasonResultSetExcelOrderTypeLabels: Record<JasonResultSetExcelOrderTypeFilter, string> = {
  bulk: 'BULK',
  sample: 'SAMPLE',
  bulk_sample: 'BULK, SAMPLE',
}

export function inferTargetDateRangeFromFilename(filename: string): JasonResultSetExcelDateRange {
  const match = /(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/.exec(filename)
  if (!match) {
    return { dateFrom: '', dateTo: '' }
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidDateParts(year, month, day)) {
    return { dateFrom: '', dateTo: '' }
  }

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const paddedMonth = String(nextMonth).padStart(2, '0')
  const lastDay = getDaysInMonth(nextYear, nextMonth)
  return {
    dateFrom: `${nextYear}-${paddedMonth}-01`,
    dateTo: `${nextYear}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function getDateFilterMode(
  dateFrom: string,
  dateTo: string,
): JasonResultSetExcelDateFilterMode {
  return dateFrom.trim() || dateTo.trim() ? 'range' : 'none'
}

export function isValidDateRangeSelection(dateFrom: string, dateTo: string): boolean {
  const normalizedDateFrom = dateFrom.trim()
  const normalizedDateTo = dateTo.trim()
  if (!normalizedDateFrom && !normalizedDateTo) {
    return true
  }
  if (!isValidDateValue(normalizedDateFrom) || !isValidDateValue(normalizedDateTo)) {
    return false
  }

  return normalizedDateFrom <= normalizedDateTo
}

export function buildDateFilterLabel(dateFrom: string, dateTo: string): string {
  const normalizedDateFrom = dateFrom.trim()
  const normalizedDateTo = dateTo.trim()
  if (!normalizedDateFrom && !normalizedDateTo) {
    return '全部日期'
  }
  if (!isValidDateRangeSelection(normalizedDateFrom, normalizedDateTo)) {
    return '日期范围未完整'
  }
  return `${normalizedDateFrom} TO ${normalizedDateTo}`
}

export function getOrderTypeLabel(orderTypeFilter: JasonResultSetExcelOrderTypeFilter): string {
  return jasonResultSetExcelOrderTypeLabels[orderTypeFilter]
}

export function buildJasonResultSetExcelSummary(
  response: JasonResultSetExcelProcessResponse,
  input: JasonResultSetExcelInputState,
): ProcessSummaryItem[] {
  const warnings = response.warnings ?? []
  return [
    {
      label: 'Result Set 文件',
      value: String(input.resultSetFileCount),
    },
    {
      label: '日期范围',
      value: response.date_filter_label || input.dateFilterLabel || '-',
    },
    {
      label: 'Order Type',
      value: response.order_type_label || input.orderTypeLabel || '-',
    },
    {
      label: '写入行数',
      value: String(response.written_row_count ?? 0),
    },
    {
      label: 'Not / Partial',
      value: `${response.not_shipped_row_count ?? 0} / ${response.partial_row_count ?? 0}`,
    },
    {
      label: 'Lookup 缺失',
      value: String(response.unknown_lookup_count ?? 0),
      note: warnings.length > 0 ? warnings.slice(0, 2).join('；') : undefined,
    },
    {
      label: '结果文件',
      value: response.output_file
        ? '已生成'
        : response.success
          ? '可下载'
          : '未生成',
    },
  ]
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false
  }
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function isValidDateValue(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  return isValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]))
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
