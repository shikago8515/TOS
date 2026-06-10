import { describe, expect, it } from 'vitest'

import { buildTmsFinanceInternalReconciliationSummary } from './tmsFinanceInternalReconciliationModel'

describe('tmsFinanceInternalReconciliationModel', () => {
  it('summarizes source rows, backfilled rows and exclusion diagnostics', () => {
    const summary = buildTmsFinanceInternalReconciliationSummary({
      success: true,
      message: 'done',
      updated_count: 22,
      source_row_count: 22,
      target_row_count: 207,
      excluded_rows: [203],
      excluded_columns: [9, 22],
      diagnostic_count: 1,
      output_file: 'result.xlsx',
      source_summary: {
        sample_rows: 14,
        book_rows: 8,
        source_rows: 22,
        source_files: 2,
      },
      totals: {
        quantity: 442,
        purchase_amount: 1380.86,
        sales_amount_with_tax: 14599.67,
      },
    })

    expect(summary).toContainEqual({ label: '来源提取行', value: '22' })
    expect(summary).toContainEqual({ label: 'Sample 行', value: '14' })
    expect(summary).toContainEqual({ label: 'Book 行', value: '8' })
    expect(summary).toContainEqual({ label: '回填行', value: '22' })
    expect(summary).toContainEqual({ label: '目标处理行', value: '207' })
    expect(summary).toContainEqual({ label: '排除行', value: '203' })
    expect(summary).toContainEqual({ label: '排除列', value: '9, 22' })
    expect(summary.map((item) => item.label)).not.toContain('新增行')
  })
})
