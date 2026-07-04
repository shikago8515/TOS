import { describe, expect, it } from 'vitest'

import {
  collectExecutorActiveRuns,
  extractExecutorRunProgress,
  getExecutorArtifacts,
  getExecutorArtifactDownloadUrls,
  isJsonRecord,
  readExecutorResponseText,
  safeParseExecutorJson,
} from './automationExecutorResponse'

describe('automationExecutorResponse', () => {
  it('parses only JSON object executor responses', () => {
    expect(safeParseExecutorJson('{"ok":true,"message":"done"}')).toEqual({
      ok: true,
      message: 'done',
    })
    expect(safeParseExecutorJson('')).toBeNull()
    expect(safeParseExecutorJson('not json')).toBeNull()
    expect(safeParseExecutorJson('[{"ok":true}]')).toBeNull()
    expect(safeParseExecutorJson('null')).toBeNull()
  })

  it('collects active executor run objects from health payloads', () => {
    const runs = collectExecutorActiveRuns({
      ok: true,
      activeRun: {
        action: 'run-shipping-file',
        moduleId: 'shipping-automation',
      },
      activeRuns: [
        null,
        { action: 'run-po-auto-download-file', inputMode: 'po-auto-download' },
        'bad-run',
      ],
    })

    expect(runs.map((run) => run.action)).toEqual([
      'run-shipping-file',
      'run-po-auto-download-file',
    ])
  })

  it('extracts executor progress from active run, last run, or direct payload progress', () => {
    expect(extractExecutorRunProgress({
      ok: true,
      activeRun: {
        progress: {
          phase: '下载中',
          completedCount: 2,
        },
      },
    })?.phase).toBe('下载中')

    expect(extractExecutorRunProgress({
      ok: true,
      lastRun: {
        progress: {
          message: 'last run',
          percent: 80,
        },
      },
    })?.message).toBe('last run')

    expect(extractExecutorRunProgress({
      progress: {
        activeInvoiceCount: 3,
      },
    })?.activeInvoiceCount).toBe(3)

    const packingProgress = extractExecutorRunProgress({
      activeRun: {
        progress: {
          totalGroupCount: 4,
          downloadedFilePaths: ['C:/downloads/a.pdf'],
          groupResults: [{ ok: true }, { ok: false }],
        },
      },
    })
    expect(packingProgress?.totalGroupCount).toBe(4)
    expect(packingProgress?.downloadedFilePaths).toEqual(['C:/downloads/a.pdf'])
    expect(packingProgress?.groupResults).toHaveLength(2)

    const ticketOwnerProgress = extractExecutorRunProgress({
      activeRun: {
        progress: {
          filteredTotalCount: 8,
          taskCenterTotalCount: 10,
          discoveredTaskCount: 7,
          currentTickets: ['TK-1', 'TK-2'],
        },
      },
    })
    expect(ticketOwnerProgress?.filteredTotalCount).toBe(8)
    expect(ticketOwnerProgress?.currentTickets).toEqual(['TK-1', 'TK-2'])
  })

  it('reads artifact download URLs without changing executor URL shapes', () => {
    const urls = getExecutorArtifactDownloadUrls({
      artifacts: {
        downloadUrls: {
          resultExcelUrl: '/artifacts/result.xlsx',
          resultJsonUrl: 'http://127.0.0.1:3003/artifacts/result.json',
          failedRowsExcelUrl: '/artifacts/failed.xlsx',
          cartonRangeCheckExcelUrl: '/artifacts/carton-range-check.xlsx',
          latestCartonRangeCheckExcelUrl: '/artifacts/latest-carton-range-check.xlsx',
        },
      },
    })

    expect(urls?.resultExcelUrl).toBe('/artifacts/result.xlsx')
    expect(urls?.resultJsonUrl).toBe('http://127.0.0.1:3003/artifacts/result.json')
    expect(urls?.failedRowsExcelUrl).toBe('/artifacts/failed.xlsx')
    expect(urls?.cartonRangeCheckExcelUrl).toBe('/artifacts/carton-range-check.xlsx')
    expect(urls?.latestCartonRangeCheckExcelUrl).toBe('/artifacts/latest-carton-range-check.xlsx')
    expect(getExecutorArtifacts({ artifacts: { resultExcelPath: 'C:/out/result.xlsx' } })?.resultExcelPath).toBe('C:/out/result.xlsx')
  })

  it('reads message and detail text from executor payloads', () => {
    expect(readExecutorResponseText({ message: 'primary message' })).toBe('primary message')
    expect(readExecutorResponseText({ detail: 'fallback detail' })).toBe('fallback detail')
    expect(readExecutorResponseText({ error: 'fallback error' })).toBe('fallback error')
    expect(readExecutorResponseText({ detail: ['not text'] })).toBe('')
  })

  it('exposes a shared JSON record guard for permissive executor payload narrowing', () => {
    expect(isJsonRecord({ ok: true })).toBe(true)
    expect(isJsonRecord(null)).toBe(false)
    expect(isJsonRecord([])).toBe(false)
  })
})
