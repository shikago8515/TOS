import { describe, expect, it } from 'vitest'

import { buildTmsFinanceUploadFields } from './tmsFinanceUploadFields'

describe('tmsFinanceUploadFields', () => {
  const emptyFiles = {
    internalSourceFiles: [],
    reconciliationTargetFiles: [],
    iplixFiles: [],
    workSalesReferenceFiles: [],
  }

  it('allows legacy xls iPlix files and keeps the Work Sales reference optional', () => {
    const fields = buildTmsFinanceUploadFields('work-sales', emptyFiles)
    const iplixField = fields.find((field) => field.id === 'iplix')
    const referenceField = fields.find((field) => field.id === 'work-sales-reference')

    expect(iplixField?.accept).toBe('.xls,.xlsx,.xlsm')
    expect(iplixField?.acceptLabel).toBe('支持 .xls / .xlsx / .xlsm')
    expect(iplixField?.expectedCount).toBe(1)
    expect(referenceField?.required).toBe(false)
    expect(referenceField?.expectedCount).toBe(1)
  })

  it('keeps internal reconciliation target uploads on writable workbook formats only', () => {
    const fields = buildTmsFinanceUploadFields('internal-reconciliation', emptyFiles)
    const sourceField = fields.find((field) => field.id === 'internal-sources')
    const targetField = fields.find((field) => field.id === 'target')

    expect(sourceField?.accept).toBe('.xlsx,.xlsm')
    expect(targetField?.accept).toBe('.xlsx,.xlsm')
  })
})
