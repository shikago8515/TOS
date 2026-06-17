import { describe, expect, it } from 'vitest'

import { buildTmsFinanceUploadFields } from './tmsFinanceUploadFields'

describe('tmsFinanceUploadFields', () => {
  const emptyFiles = {
    internalSourceFiles: [],
    reconciliationTargetFiles: [],
    workSalesBulkSalesFiles: [],
    workSalesTurnoverFiles: [],
  }

  it('requires BULK Sales and TURNOVER files for Work Sales fill', () => {
    const fields = buildTmsFinanceUploadFields('work-sales', emptyFiles)
    const bulkSalesField = fields.find((field) => field.id === 'work-sales-bulk-sales')
    const turnoverField = fields.find((field) => field.id === 'work-sales-turnover')

    expect(fields).toHaveLength(2)
    expect(bulkSalesField?.label).toBe('BULK Sales 导出表')
    expect(bulkSalesField?.hint).toContain('写入')
    expect(bulkSalesField?.accept).toBe('.xls,.xlsx,.xlsm')
    expect(bulkSalesField?.acceptLabel).toBe('支持 .xls / .xlsx / .xlsm')
    expect(bulkSalesField?.expectedCount).toBe(1)
    expect(bulkSalesField?.required).not.toBe(false)
    expect(turnoverField?.label).toBe('TURNOVER 目标表')
    expect(turnoverField?.hint).toContain('重建')
    expect(turnoverField?.accept).toBe('.xlsx,.xlsm')
    expect(turnoverField?.acceptLabel).toBe('支持 .xlsx / .xlsm')
    expect(turnoverField?.expectedCount).toBe(1)
    expect(turnoverField?.required).not.toBe(false)
  })

  it('keeps internal reconciliation target uploads on writable workbook formats only', () => {
    const fields = buildTmsFinanceUploadFields('internal-reconciliation', emptyFiles)
    const sourceField = fields.find((field) => field.id === 'internal-sources')
    const targetField = fields.find((field) => field.id === 'target')

    expect(sourceField?.accept).toBe('.xlsx,.xlsm')
    expect(targetField?.accept).toBe('.xlsx,.xlsm')
    expect(sourceField?.hint).toContain('追加')
    expect(targetField?.hint).toContain('追加')
  })
})
