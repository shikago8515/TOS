import { describe, expect, it } from 'vitest'

import {
  buildJasonResultSetExcelSummary,
  inferTargetMonthFromFilename,
  jasonResultSetExcelModuleId,
} from './jasonResultSetExcelModel'

describe('jasonResultSetExcelModel', () => {
  it('uses the Jason process history module id', () => {
    expect(jasonResultSetExcelModuleId).toBe('jason-result-set-excel')
  })

  it('infers the next month from the To ERIC export date in filename', () => {
    expect(inferTargetMonthFromFilename('To ERIC 1l8-Bulk adidas RD_2026-06-30-0530.xlsx'))
      .toBe('2026-07')
    expect(inferTargetMonthFromFilename('result-set_2026_12_31.xlsx')).toBe('2027-01')
    expect(inferTargetMonthFromFilename('result-set.xlsx')).toBe('')
  })

  it('builds summary items from backend counts and warnings', () => {
    const summary = buildJasonResultSetExcelSummary(
      {
        success: true,
        message: 'ok',
        output_file: 'jason_result.xlsx',
        target_month: '2026-07',
        written_row_count: 60,
        not_shipped_row_count: 59,
        partial_row_count: 1,
        unknown_lookup_count: 2,
        warnings: ['missing lookup'],
      },
      {
        resultSetFileCount: 1,
        targetMonth: '2026-07',
      },
    )

    expect(summary.map((item) => item.value)).toEqual([
      '1',
      '2026-07',
      '60',
      '59 / 1',
      '2',
      '已生成',
    ])
    expect(summary[4]?.note).toContain('missing lookup')
  })
})
