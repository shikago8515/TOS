import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const excelProcessPages = [
  '../../pages/draft-packing-compare/DraftPackingComparePage.vue',
  '../../pages/eric/EricPage.vue',
  '../../pages/excel-template-mapper-test/ExcelTemplateMapperTestPage.vue',
  '../../pages/iplex-dual-table-compare/IplexDualTableComparePage.vue',
  '../../pages/jane/JanePage.vue',
  '../../pages/jane-bom-compare/JaneBomComparePage.vue',
  '../../pages/jane-bom-summary/JaneBomSummaryPage.vue',
  '../../pages/jane-outbound-compare/JaneOutboundComparePage.vue',
  '../../pages/jessca/JesscaPage.vue',
  '../../pages/sophia-tina/SophiaTinaPage.vue',
  '../../pages/tms-finance-internal-reconciliation/TmsFinanceInternalReconciliationPage.vue',
] as const

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('Excel process history toolbar actions', () => {
  it.each(excelProcessPages)('adds top toolbar history result download action to %s', (relativePath) => {
    const source = readSource(relativePath)

    expect(source).toContain("id: 'download-history-result'")
    expect(source).toContain('useProcessHistoryResultPageLink')
    expect(source).toContain('openHistoryResultPage')
    expect(source).not.toContain('downloadLatestHistoryResult')
    expect(source).not.toContain('latestHistoryResultRecord')
    expect(source).not.toContain('visible: hasProcessHistoryRecords.value')
  })
})
