import { describe, expect, it } from 'vitest'

import {
  getLocalizedModuleTitle,
  getModuleById,
  getModulesByGroup,
  tosModules,
  tosNavGroups,
} from './moduleCatalog'

describe('moduleCatalog', () => {
  it.each([
    ['jason', 'Jason'],
    ['finance-excel', 'Lucia'],
  ])('labels the %s group as %s in the sidebar', (groupId, expectedLabel) => {
    const group = tosNavGroups.find((entry) => entry.id === groupId)

    expect(group?.label).toBe(expectedLabel)
    expect(group?.labelEn).toBe(expectedLabel)
  })

  it('uses Jason as the invoice PDF reorder page title prefix', () => {
    const invoiceModule = tosModules.find((entry) => entry.id === 'jason-pdf-reorder')

    expect(invoiceModule?.title.startsWith('Jason / ')).toBe(true)
    expect(invoiceModule?.title.startsWith('IT / ')).toBe(false)
  })

  it('exposes Jason PDF reorder through the canonical route', () => {
    const invoiceModule = getModuleById('jason-pdf-reorder')

    expect(invoiceModule).toMatchObject({
      group: 'jason',
      path: '/jason/pdf-reorder',
      routeName: 'jason-pdf-reorder',
      navLabel: '发票 PDF 重排序',
    })
  })

  it('exposes PO auto download as a Jason sidebar entry', () => {
    const poAutoDownloadModule = getModuleById('po-auto-download')
    const jasonModules = getModulesByGroup('jason')
    const moduleIds = jasonModules.map((module) => module.id)

    expect(poAutoDownloadModule).toMatchObject({
      group: 'jason',
      path: '/web-automation/scenarios/po-auto-download',
      routeName: 'web-automation-scenario-po-auto-download',
      navLabel: 'Invoice 自动下载',
    })
    expect(moduleIds).toContain('po-auto-download')
    expect(moduleIds.indexOf('po-auto-download')).toBeGreaterThan(moduleIds.indexOf('jason-pdf-reorder'))
  })

  it('shows Draft & Packing List compare directly under Jessica after reconciliation', () => {
    const draftPackingModule = getModuleById('draft-packing-compare')
    const jessicaModules = getModulesByGroup('jessica')
    const legacyPdfModules = getModulesByGroup('pdf-data-compare')
    const moduleIds = jessicaModules.map((module) => module.id)

    expect(draftPackingModule).toMatchObject({
      group: 'jessica',
      path: '/draft-packing-compare',
      routeName: 'draft-packing-compare',
    })
    expect(moduleIds).toContain('draft-packing-compare')
    expect(legacyPdfModules.map((module) => module.id)).not.toContain('draft-packing-compare')
    expect(moduleIds.indexOf('draft-packing-compare')).toBeGreaterThan(moduleIds.indexOf('jessca'))
  })

  it('uses full module titles for page breadcrumbs in both languages', () => {
    const invoiceModule = getModuleById('jason-pdf-reorder')
    const internalReconciliationModule = getModuleById('tms-finance-internal-reconciliation')
    const workSalesModule = getModuleById('tms-finance-work-sales')

    expect(getLocalizedModuleTitle(invoiceModule, 'zh-CN')).toBe('Jason / 发票 PDF 重排序')
    expect(getLocalizedModuleTitle(invoiceModule, 'en-US')).toBe('Jason / Invoice PDF Reorder')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'zh-CN')).toBe('内销对账表数据提取')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'en-US')).toBe(
      'Internal Reconciliation Data Extraction',
    )
    expect(getLocalizedModuleTitle(workSalesModule, 'zh-CN')).toBe('Work Sales 数据写入')
    expect(getLocalizedModuleTitle(workSalesModule, 'en-US')).toBe('Work Sales Data Fill')
    expect(getLocalizedModuleTitle(workSalesModule, 'en-US')).not.toBe(workSalesModule.navLabelEn)
  })

  it('defines English full titles for every module', () => {
    for (const module of tosModules) {
      expect(module.titleEn).toBeTruthy()
      expect(module.titleEn).not.toMatch(/[\u4e00-\u9fff]/)
      expect(getLocalizedModuleTitle(module, 'en-US')).toBe(module.titleEn)
    }
  })

  it('does not keep hidden placeholder modules in the catalog', () => {
    const stages: string[] = tosModules.map((module) => module.stage)

    expect(stages).not.toContain('placeholder')
  })

  it('exposes the web automation hub as a visible validation module', () => {
    const webAutomationModule = tosModules.find((module) => module.id === 'web-automation')

    expect(webAutomationModule).toMatchObject({
      path: '/web-automation',
      routeName: 'web-automation',
      group: 'general-tools',
      category: 'browser-automation',
      stage: 'validation',
    })
  })
})
