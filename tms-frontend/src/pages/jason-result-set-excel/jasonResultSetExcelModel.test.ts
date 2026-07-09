import { describe, expect, it } from 'vitest'

import {
  buildJasonResultSetExcelSummary,
  buildDateFilterLabel,
  inferTargetDateRangeFromFilename,
  isValidDateRangeSelection,
  jasonResultSetExcelModuleId,
} from './jasonResultSetExcelModel'

describe('jasonResultSetExcelModel', () => {
  it('uses the Jason process history module id', () => {
    expect(jasonResultSetExcelModuleId).toBe('jason-result-set-excel')
  })

  it('infers the next full-month date range from the To ERIC export date in filename', () => {
    expect(inferTargetDateRangeFromFilename('To ERIC 1l8-Bulk adidas RD_2026-06-30-0530.xlsx'))
      .toEqual({
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      })
    expect(inferTargetDateRangeFromFilename('result-set_2026_12_31.xlsx')).toEqual({
      dateFrom: '2027-01-01',
      dateTo: '2027-01-31',
    })
    expect(inferTargetDateRangeFromFilename('result-set.xlsx')).toEqual({
      dateFrom: '',
      dateTo: '',
    })
  })

  it('validates date range selection as optional but rejects partial or reversed ranges', () => {
    expect(isValidDateRangeSelection('', '')).toBe(true)
    expect(isValidDateRangeSelection('2026-07-01', '2026-07-31')).toBe(true)
    expect(isValidDateRangeSelection('2026-07-01', '')).toBe(false)
    expect(isValidDateRangeSelection('', '2026-07-31')).toBe(false)
    expect(isValidDateRangeSelection('2026-08-01', '2026-07-31')).toBe(false)
  })

  it('builds a readable date filter label for range and empty filters', () => {
    expect(buildDateFilterLabel('2026-07-01', '2026-07-31')).toBe('2026-07-01 TO 2026-07-31')
    expect(buildDateFilterLabel('', '')).toBe('全部日期')
  })

  it('builds summary items from backend counts, filters, and warnings', () => {
    const summary = buildJasonResultSetExcelSummary(
      {
        success: true,
        message: 'ok',
        output_file: 'jason_result.xlsx',
        date_filter_label: '2026-07-01 TO 2026-07-31',
        order_type_label: 'BULK',
        written_row_count: 60,
        not_shipped_row_count: 59,
        partial_row_count: 1,
        unknown_lookup_count: 2,
        warnings: ['missing lookup'],
      },
      {
        resultSetFileCount: 1,
        dateFilterLabel: '2026-07-01 TO 2026-07-31',
        orderTypeLabel: 'BULK',
      },
    )

    expect(summary.map((item) => item.value)).toEqual([
      '1',
      '2026-07-01 TO 2026-07-31',
      'BULK',
      '60',
      '59 / 1',
      '2',
      '已生成',
    ])
    expect(summary[5]?.note).toContain('missing lookup')
  })
})
