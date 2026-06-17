import { describe, expect, it } from 'vitest'

import { buildTmsFinanceWorkSalesSummary } from './tmsFinanceWorkSalesModel'

describe('tmsFinanceWorkSalesModel', () => {
  it('summarizes written Sales and Purchase rows from BULK Sales processing', () => {
    const summary = buildTmsFinanceWorkSalesSummary({
      success: true,
      message: 'done',
      source_row_count: 8,
      sales_written_count: 8,
      purchase_written_count: 8,
      cleared_sales_count: 2,
      cleared_purchase_count: 2,
      diagnostic_count: 1,
      output_file: 'result.xlsx',
    })

    expect(summary).toContainEqual({ label: '源行', value: '8' })
    expect(summary).toContainEqual({ label: '写入行', value: '16' })
    expect(summary).toContainEqual({ label: 'Sales 写入', value: '8' })
    expect(summary).toContainEqual({ label: 'Purchase 写入', value: '8' })
    expect(summary).toContainEqual({ label: '清空旧行', value: '4' })
    expect(summary).toContainEqual({ label: '诊断项', value: '1' })
    expect(summary).toContainEqual({ label: '结果文件', value: '已生成' })
  })
})
