import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./ProcessHistoryResultsPage.vue', import.meta.url), 'utf8')
}

describe('ProcessHistoryResultsPage source', () => {
  it('loads only downloadable remote records and falls back to local cached history', () => {
    const source = readPageSource()

    expect(source).toContain('downloadableOnly: true')
    expect(source).toContain("backendTarget: 'remote'")
    expect(source).toContain('filterDownloadableProcessRecords(payload.records)')
    expect(source).toContain('filterLocalDownloadableProcessRecords')
    expect(source).toContain('mergeDownloadableProcessRecords')
    expect(source).toContain('personId: selectedHistoryModuleIds.value.length > 0 ? undefined : personId.value')
    expect(source).toContain('selectedHistoryModuleIds.value.length > 0 ? selectedHistoryModuleIds.value : undefined')
    expect(source).toContain('pagination.page === 1')
    expect(source).toContain('module.historyModuleIds')
  })

  it('keeps row download buttons enabled for listed downloadable records', () => {
    const source = readPageSource()

    expect(source).toContain(':disabled="downloadingRecordId === record.id"')
    expect(source).not.toContain(':disabled="!record.resultDownloadPath || downloadingRecordId === record.id"')
  })

  it('keeps the empty state visible when remote loading falls back to empty local history', () => {
    const source = readPageSource()

    expect(source).toContain('!records.length && (!errorMessage || usingLocalFallback)')
  })

  it('builds the history page title by language instead of spacing-sensitive concatenation', () => {
    const source = readPageSource()

    expect(source).toContain('{{ historyPageTitle }}')
    expect(source).toContain('const historyPageTitle = computed')
    expect(source).toContain('`${personLabel.value} History Results`')
    expect(source).toContain('`${personLabel.value} ${text(\'历史结果\')}`')
    expect(source).not.toContain("{{ personLabel }}{{ text(' 历史结果') }}")
  })
})
