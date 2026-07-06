import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JasonResultSetExcelProcessResponse } from './jasonResultSetExcelApi'

export const jasonResultSetExcelModuleId = 'jason-result-set-excel'
export const jasonResultSetExcelModuleName = 'Jason / Result Set Excel'

export interface JasonResultSetExcelInputState {
  resultSetFileCount: number
  targetMonth: string
}

export function inferTargetMonthFromFilename(filename: string): string {
  const match = /(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/.exec(filename)
  if (!match) {
    return ''
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidDateParts(year, month, day)) {
    return ''
  }

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

export function isValidTargetMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) {
    return false
  }

  const month = Number(match[2])
  return month >= 1 && month <= 12
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
      label: '目标月份',
      value: response.target_month || input.targetMonth || '-',
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
