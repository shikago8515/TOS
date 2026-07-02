import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const processPagesWithResultSummary = [
  '../../pages/draft-packing-compare/DraftPackingComparePage.vue',
  '../../pages/excel-template-mapper-test/ExcelTemplateMapperTestPage.vue',
  '../../pages/iplex-dual-table-compare/IplexDualTableComparePage.vue',
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

describe('process history archive warning source', () => {
  it.each(processPagesWithResultSummary)('%s passes archive warnings into ResultSummary', (path) => {
    const source = readPageSource(path)

    expect(source).toContain(':warnings="historyWarnings"')
    expect(source).toContain('const historyWarnings = ref<string[]>([])')
    expect(source).toContain('const historyMetadata = readProcessHistoryMetadata(metadata)')
    expect(source).toContain('historyWarnings.value = historyMetadata.historyWarnings ?? []')
  })
})
