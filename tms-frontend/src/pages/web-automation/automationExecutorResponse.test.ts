import { describe, expect, it } from 'vitest'

import {
  collectExecutorActiveRuns,
  extractExecutorRunProgress,
  getExecutorArtifactDownloadUrls,
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
  })

  it('reads artifact download URLs without changing executor URL shapes', () => {
    const urls = getExecutorArtifactDownloadUrls({
      artifacts: {
        downloadUrls: {
          resultExcelUrl: '/artifacts/result.xlsx',
          resultJsonUrl: 'http://127.0.0.1:3003/artifacts/result.json',
          failedRowsExcelUrl: '/artifacts/failed.xlsx',
        },
      },
    })

    expect(urls?.resultExcelUrl).toBe('/artifacts/result.xlsx')
    expect(urls?.resultJsonUrl).toBe('http://127.0.0.1:3003/artifacts/result.json')
    expect(urls?.failedRowsExcelUrl).toBe('/artifacts/failed.xlsx')
  })

  it('reads message and detail text from executor payloads', () => {
    expect(readExecutorResponseText({ message: 'primary message' })).toBe('primary message')
    expect(readExecutorResponseText({ detail: 'fallback detail' })).toBe('fallback detail')
    expect(readExecutorResponseText({ detail: ['not text'] })).toBe('')
  })
})
