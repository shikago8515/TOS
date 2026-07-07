import { describe, expect, it } from 'vitest'

import {
  getLocalizedModuleTitle,
  getModuleById,
  getModulesByGroup,
  getNavParentsByGroup,
  tosModuleCategoryLabels,
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

  it('groups Jessica browser automation entries by business menu parent', () => {
    const shippingModule = getModuleById('shipping-automation')
    const xinlongtaiModule = getModuleById('xinlongtai-shipping-automation')
    const tcInvModule = getModuleById('tc-inv-automation')
    const poAutoDownloadModule = getModuleById('po-auto-download')
    const packingListAutoDownloadModule = getModuleById('packing-list-auto-download')
    const jessicaNavParents = getNavParentsByGroup('jessica')
    const jessicaModules = getModulesByGroup('jessica')
    const jasonModules = getModulesByGroup('jason')
    const jessicaModuleIds = jessicaModules.map((module) => module.id)
    const jasonModuleIds = jasonModules.map((module) => module.id)

    expect(jessicaNavParents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'jessica-infornexus-automation',
          label: 'Infornexus自动化',
          category: 'browser-automation',
        }),
        expect.objectContaining({
          id: 'jessica-packing-list-auto-download',
          label: 'Packing list 自动下载',
          category: 'browser-automation',
        }),
      ]),
    )
    expect(shippingModule).toMatchObject({
      group: 'jessica',
      path: '/web-automation/scenarios/shipping-automation',
      routeName: 'web-automation-scenario-shipping-automation',
      title: 'Jessica / VENT',
      navLabel: 'VENT',
      category: 'browser-automation',
      navParentId: 'jessica-infornexus-automation',
    })
    expect(xinlongtaiModule).toMatchObject({
      group: 'jessica',
      path: '/web-automation/scenarios/xinlongtai-shipping-automation',
      routeName: 'web-automation-scenario-xinlongtai-shipping-automation',
      title: 'Jessica / YUEN TAI+XO',
      navLabel: 'YUEN TAI+XO',
      category: 'browser-automation',
      navParentId: 'jessica-infornexus-automation',
    })
    expect(poAutoDownloadModule).toMatchObject({
      group: 'jessica',
      path: '/web-automation/scenarios/po-auto-download',
      routeName: 'web-automation-scenario-po-auto-download',
      title: 'Jessica / Invoice 下载',
      navLabel: 'Invoice 下载',
      category: 'browser-automation',
      navParentId: 'jessica-packing-list-auto-download',
    })
    expect(tcInvModule).toMatchObject({
      group: 'jessica',
      path: '/web-automation/scenarios/tc-inv-automation',
      routeName: 'web-automation-scenario-tc-inv-automation',
      title: 'Jessica / VENT+YUEN TAI-Trade Card INV amount',
      navLabel: 'VENT+YUEN TAI-Trade Card INV amount',
      category: 'browser-automation',
      navParentId: 'jessica-infornexus-automation',
    })
    expect(packingListAutoDownloadModule).toMatchObject({
      group: 'jessica',
      path: '/web-automation/scenarios/packing-list-auto-download',
      routeName: 'web-automation-scenario-packing-list-auto-download',
      title: 'Jessica / Packing List 下载',
      navLabel: 'Packing List 下载',
      category: 'browser-automation',
      navParentId: 'jessica-packing-list-auto-download',
    })
    expect(jessicaModuleIds).toEqual(
      expect.arrayContaining([
        'shipping-automation',
        'xinlongtai-shipping-automation',
        'tc-inv-automation',
        'po-auto-download',
        'packing-list-auto-download',
      ]),
    )
    expect(jasonModuleIds).not.toContain('po-auto-download')
    expect(jessicaModuleIds.indexOf('shipping-automation')).toBeGreaterThan(
      jessicaModuleIds.indexOf('draft-packing-compare'),
    )
    expect(jessicaModuleIds.indexOf('xinlongtai-shipping-automation')).toBeGreaterThan(
      jessicaModuleIds.indexOf('shipping-automation'),
    )
    expect(jessicaModuleIds.indexOf('po-auto-download')).toBeGreaterThan(
      jessicaModuleIds.indexOf('tc-inv-automation'),
    )
    expect(jessicaModuleIds.indexOf('packing-list-auto-download')).toBeGreaterThan(
      jessicaModuleIds.indexOf('po-auto-download'),
    )
    expect(jessicaModuleIds.indexOf('tc-inv-automation')).toBeGreaterThan(
      jessicaModuleIds.indexOf('xinlongtai-shipping-automation'),
    )
  })

  it('shows origin certificate compare directly under Jessica after reconciliation', () => {
    const draftPackingModule = getModuleById('draft-packing-compare')
    const jessicaModules = getModulesByGroup('jessica')
    const legacyPdfModules = getModulesByGroup('pdf-data-compare')
    const moduleIds = jessicaModules.map((module) => module.id)

    expect(draftPackingModule).toMatchObject({
      group: 'jessica',
      path: '/draft-packing-compare',
      routeName: 'draft-packing-compare',
      title: '产地证核对',
      navLabel: '产地证核对',
      navLabelEn: 'Certificate of Origin Compare',
    })
    expect(moduleIds).toContain('draft-packing-compare')
    expect(legacyPdfModules.map((module) => module.id)).not.toContain('draft-packing-compare')
    expect(moduleIds.indexOf('draft-packing-compare')).toBeGreaterThan(moduleIds.indexOf('jessca'))
  })

  it('labels Jessca invoice compare under Excel processing in the sidebar', () => {
    const jesscaModule = getModuleById('jessca')

    expect(tosModuleCategoryLabels.reconciliation).toMatchObject({
      label: 'Excel处理',
      labelEn: 'Excel Processing',
    })
    expect(jesscaModule).toMatchObject({
      navLabel: 'Invoice 核对',
      navLabelEn: 'Invoice Compare',
    })
  })

  it('uses full module titles for page breadcrumbs in both languages', () => {
    const invoiceModule = getModuleById('jason-pdf-reorder')
    const internalReconciliationModule = getModuleById('tms-finance-internal-reconciliation')
    const workSalesModule = getModuleById('tms-finance-work-sales')
    const iplexModule = getModuleById('iplex-dual-table-compare')
    const ericModule = getModuleById('eric')
    const jesscaModule = getModuleById('jessca')
    const draftPackingModule = getModuleById('draft-packing-compare')

    expect(getLocalizedModuleTitle(invoiceModule, 'zh-CN')).toBe('Jason / 发票 PDF 重排序')
    expect(getLocalizedModuleTitle(invoiceModule, 'en-US')).toBe('Jason / Invoice PDF Reorder')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'zh-CN')).toBe('内销对账单数据写入')
    expect(getLocalizedModuleTitle(internalReconciliationModule, 'en-US')).toBe(
      'Internal Reconciliation Data Fill',
    )
    expect(internalReconciliationModule.navLabel).toBe('内销对账单数据写入')
    expect(internalReconciliationModule.navLabelEn).toBe('Internal Reconciliation Data Fill')
    expect(getLocalizedModuleTitle(workSalesModule, 'zh-CN')).toBe('Turnover数据写入')
    expect(getLocalizedModuleTitle(workSalesModule, 'en-US')).toBe('Turnover Data Fill')
    expect(workSalesModule.navLabel).toBe('Turnover数据写入')
    expect(workSalesModule.navLabelEn).toBe('Turnover Data Fill')
    expect(getLocalizedModuleTitle(iplexModule, 'zh-CN')).toBe('数据核对')
    expect(getLocalizedModuleTitle(iplexModule, 'en-US')).toBe('Data Compare')
    expect(getLocalizedModuleTitle(ericModule, 'zh-CN')).toBe('数据处理')
    expect(getLocalizedModuleTitle(ericModule, 'en-US')).toBe('Data Processing')
    expect(getLocalizedModuleTitle(jesscaModule, 'zh-CN')).toBe('Invoice 核对')
    expect(getLocalizedModuleTitle(jesscaModule, 'en-US')).toBe('Invoice Compare')
    expect(getLocalizedModuleTitle(draftPackingModule, 'zh-CN')).toBe('产地证核对')
    expect(getLocalizedModuleTitle(draftPackingModule, 'en-US')).toBe(
      'Certificate of Origin Compare',
    )
  })

  it('exposes iPlex dual table compare under Eric Excel tools', () => {
    const iplexModule = getModuleById('iplex-dual-table-compare')
    const ericModules = getModulesByGroup('eric')
    const luciaModules = getModulesByGroup('finance-excel')
    const ericModuleIds = ericModules.map((module) => module.id)
    const luciaModuleIds = luciaModules.map((module) => module.id)

    expect(iplexModule).toMatchObject({
      group: 'eric',
      path: '/iplex/dual-table-compare',
      routeName: 'iplex-dual-table-compare',
      title: '数据核对',
      titleEn: 'Data Compare',
      navLabel: '数据核对',
      navLabelEn: 'Data Compare',
      category: 'excel',
      stage: 'validation',
    })
    expect(ericModuleIds).toContain('iplex-dual-table-compare')
    expect(luciaModuleIds).not.toContain('iplex-dual-table-compare')
    expect(ericModuleIds.indexOf('iplex-dual-table-compare')).toBeGreaterThan(
      ericModuleIds.indexOf('eric'),
    )
  })

  it('keeps released Bulk under Jane and moves auto-add under Eric Infornexus', () => {
    const janeInfornexusModule = getModuleById('jane-infornexus')
    const ericInfornexusModule = getModuleById('eric-infornexus')
    const janeModules = getModulesByGroup('jane')
    const jessicaModules = getModulesByGroup('jessica')
    const ericModules = getModulesByGroup('eric')
    const moduleIds = tosModules.map((module) => String(module.id))
    const janeModuleIds = janeModules.map((module) => module.id)
    const jessicaModuleIds = jessicaModules.map((module) => module.id)
    const ericModuleIds = ericModules.map((module) => module.id)

    expect(janeInfornexusModule).toMatchObject({
      group: 'jane',
      path: '/jane-infornexus',
      routeName: 'jane-infornexus',
      title: 'Jane / Infornexus',
      titleEn: 'Jane / Infornexus',
      navLabel: 'Infornexus',
      navLabelEn: 'Infornexus',
      category: 'browser-automation',
      stage: 'production',
    })
    expect(janeModuleIds).toContain('jane-infornexus')
    expect(janeModuleIds.indexOf('jane-infornexus')).toBeGreaterThan(janeModuleIds.indexOf('jane-sap'))
    expect(ericInfornexusModule).toMatchObject({
      group: 'eric',
      path: '/eric-infornexus',
      routeName: 'eric-infornexus',
      title: 'Eric / Infornexus',
      titleEn: 'Eric / Infornexus',
      navLabel: 'Infornexus',
      navLabelEn: 'Infornexus',
      category: 'browser-automation',
      stage: 'production',
    })
    expect(ericModuleIds).toContain('eric-infornexus')
    expect(ericModuleIds.indexOf('eric-infornexus')).toBeGreaterThan(
      ericModuleIds.indexOf('iplex-dual-table-compare'),
    )
    expect(moduleIds).not.toContain('jessica-infornexus')
    expect(ericModuleIds).not.toContain('jessica-infornexus')
    expect(jessicaModuleIds).not.toContain('jessica-infornexus')
    expect(jessicaModuleIds).not.toContain('eric-infornexus')
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
    const moduleIds = tosModules.map((module) => String(module.id))

    expect(webAutomationModule).toMatchObject({
      path: '/web-automation',
      routeName: 'web-automation',
      group: 'general-tools',
      category: 'browser-automation',
      stage: 'validation',
    })
    expect(moduleIds).not.toContain('browser-plugins')
    expect(moduleIds).not.toContain('infornexus')
  })

  it('exposes automation run records and template management under general tools', () => {
    const runModule = tosModules.find((module) => module.id === 'automation-runs')
    const templateModule = tosModules.find((module) => module.id === 'automation-templates')
    const generalToolIds = getModulesByGroup('general-tools').map((module) => module.id)

    expect(runModule).toMatchObject({
      path: '/automation-runs',
      routeName: 'automation-runs',
      category: 'system',
      stage: 'production',
    })
    expect(templateModule).toMatchObject({
      path: '/automation-templates',
      routeName: 'automation-templates',
      category: 'system',
      stage: 'production',
    })
    expect(generalToolIds).toEqual(expect.arrayContaining(['automation-runs', 'automation-templates']))
  })

  it('exposes the generic Excel template mapper as a validation tool under general tools', () => {
    const mapperModule = getModuleById('excel-template-mapper-test')
    const generalToolIds = getModulesByGroup('general-tools').map((module) => module.id)

    expect(mapperModule).toMatchObject({
      path: '/excel-template-mapper-test',
      routeName: 'excel-template-mapper-test',
      title: '通用 Excel 映射测试',
      titleEn: 'Generic Excel Mapper Test',
      navLabel: '通用 Excel 映射测试',
      navLabelEn: 'Generic Excel Mapper',
      group: 'general-tools',
      category: 'excel',
      stage: 'validation',
      order: 75,
    })
    expect(generalToolIds).toContain('excel-template-mapper-test')
    expect(generalToolIds.indexOf('excel-template-mapper-test')).toBeGreaterThan(
      generalToolIds.indexOf('web-automation'),
    )
    expect(generalToolIds.indexOf('excel-template-mapper-test')).toBeLessThan(
      generalToolIds.indexOf('adidas-materials'),
    )
  })
})
