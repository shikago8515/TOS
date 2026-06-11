import { describe, expect, it } from 'vitest'

import { buildTmsFinanceWorkSalesSummary } from './tmsFinanceWorkSalesModel'

describe('tmsFinanceWorkSalesModel', () => {
  it('summarizes appended Sales and Purchase rows from BULK Sales processing', () => {
    const summary = buildTmsFinanceWorkSalesSummary({
      success: true,
      message: 'done',
      source_row_count: 8,
      sales_appended_count: 8,
      purchase_appended_count: 8,
      duplicate_count: 0,
      diagnostic_count: 1,
      output_file: 'result.xlsx',
    })

    expect(summary).toContainEqual({ label: '源行', value: '8' })
    expect(summary).toContainEqual({ label: '追加行', value: '16' })
    expect(summary).toContainEqual({ label: 'Sales 追加', value: '8' })
    expect(summary).toContainEqual({ label: 'Purchase 追加', value: '8' })
    expect(summary).toContainEqual({ label: '重复跳过', value: '0' })
    expect(summary).toContainEqual({ label: '诊断项', value: '1' })
    expect(summary).toContainEqual({ label: '结果文件', value: '已生成' })
  })
})
