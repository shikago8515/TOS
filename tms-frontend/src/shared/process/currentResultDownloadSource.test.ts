import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const currentResultPages = [
  '../../pages/draft-packing-compare/DraftPackingComparePage.vue',
  '../../pages/excel-template-mapper-test/ExcelTemplateMapperTestPage.vue',
  '../../pages/iplex-dual-table-compare/IplexDualTableComparePage.vue',
  '../../pages/jason-result-set-excel/JasonResultSetExcelPage.vue',
  '../../pages/jane/JanePage.vue',
  '../../pages/jane-bom-compare/JaneBomComparePage.vue',
  '../../pages/jane-bom-summary/JaneBomSummaryPage.vue',
  '../../pages/jane-outbound-compare/JaneOutboundComparePage.vue',
  '../../pages/jessca/JesscaPage.vue',
  '../../pages/sophia-tina/SophiaTinaPage.vue',
  '../../pages/tms-finance-internal-reconciliation/TmsFinanceInternalReconciliationPage.vue',
]

function readPageSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('current result download source', () => {
  it.each(currentResultPages)('%s uses the shared current-result download helper', (path) => {
    const source = readPageSource(path)

    expect(source).toContain('downloadCurrentProcessResult')
    expect(source).toContain('currentResultDownload')
    expect(source).toContain('resultDownloadPath')
  })
})
