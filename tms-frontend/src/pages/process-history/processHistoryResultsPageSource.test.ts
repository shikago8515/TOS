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
    expect(source).toContain('loadModuleHistory(module.id)')
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
})
