import { describe, expect, it } from 'vitest'

import {
  getLocalizedModuleTitle,
  getModuleById,
  tosModules,
  tosNavGroups,
} from './moduleCatalog'

describe('moduleCatalog', () => {
  it.each([
    ['it', 'Jason'],
    ['finance-excel', 'Lucia'],
  ])('labels the %s group as %s in the sidebar', (groupId, expectedLabel) => {
    const group = tosNavGroups.find((entry) => entry.id === groupId)

    expect(group?.label).toBe(expectedLabel)
    expect(group?.labelEn).toBe(expectedLabel)
  })

  it('uses Jason as the invoice PDF reorder page title prefix', () => {
    const invoiceModule = tosModules.find((entry) => entry.id === 'it-invoice-pdf-reorder')

    expect(invoiceModule?.title.startsWith('Jason / ')).toBe(true)
    expect(invoiceModule?.title.startsWith('IT / ')).toBe(false)
  })

  it('uses full module titles for page breadcrumbs in both languages', () => {
    const invoiceModule = getModuleById('it-invoice-pdf-reorder')
    const internalReconciliationModule = getModuleById('tms-finance-internal-reconciliation')
    const workSalesModule = getModuleById('tms-finance-work-sales')

    expect(getLocalizedModuleTitle(invoiceModule, 'zh-CN')).toBe('Jason / 发票 PDF 重排序')
    expect(getLocalizedModuleTitle(invoiceModule, 'en-US')).toBe('Jason / Invoice PDF Reorder')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'zh-CN')).toBe('内销对账表数据提取')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'en-US')).toBe(
      'Internal Reconciliation Data Extraction',
    )
    expect(getLocalizedModuleTitle(workSalesModule, 'zh-CN')).toBe('Work Sales 数据追加')
    expect(getLocalizedModuleTitle(workSalesModule, 'en-US')).toBe('Work Sales Data Append')
    expect(getLocalizedModuleTitle(workSalesModule, 'en-US')).not.toBe(workSalesModule.navLabelEn)
  })

  it('defines English full titles for every module', () => {
    for (const module of tosModules) {
      expect(module.titleEn).toBeTruthy()
      expect(module.titleEn).not.toMatch(/[\u4e00-\u9fff]/)
      expect(getLocalizedModuleTitle(module, 'en-US')).toBe(module.titleEn)
    }
  })
})
