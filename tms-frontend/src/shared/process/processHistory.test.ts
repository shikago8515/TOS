import { describe, expect, it, vi } from 'vitest'

import {
  appendModuleHistory,
  buildProcessHistoryResultDownloadUrl,
  fetchPersistedProcessHistoryRecordPage,
  fetchPersistedProcessHistoryRecords,
  findLatestDownloadableHistoryRecord,
  loadModuleHistory,
  readProcessHistoryMetadata,
} from './processHistory'

describe('processHistory', () => {
  it('maps backend snake_case process history fields for local records', () => {
    const metadata = readProcessHistoryMetadata({
      history_id: 'server-history-2',
      result_download_path: '/api/process-history/files/84/download',
      result_download_backend_target: 'remote',
      history_warnings: ['历史结果未保存。'],
      result_file: {
        id: 84,
        filename: 'server-result.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 512,
        sha256: 'd'.repeat(64),
        downloadPath: '/api/process-history/files/84/download',
      },
    })

    expect(metadata).toEqual({
      id: 'server-history-2',
      resultDownloadPath: '/api/process-history/files/84/download',
      resultDownloadBackendTarget: 'remote',
      historyWarnings: ['历史结果未保存。'],
      resultFile: {
        id: 84,
        filename: 'server-result.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 512,
        sha256: 'd'.repeat(64),
        downloadPath: '/api/process-history/files/84/download',
      },
    })
  })

  it('ignores legacy string result_file values when reading backend metadata', () => {
    const metadata = readProcessHistoryMetadata({
      history_id: 'server-history-3',
      result_download_path: '/api/process-history/files/85/download',
      result_file: 'legacy-result.xlsx',
    })

    expect(metadata).toEqual({
      id: 'server-history-3',
      resultDownloadPath: '/api/process-history/files/85/download',
    })
  })

  it('keeps backend history id and result download metadata in local history', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    })

    try {
      const records = appendModuleHistory({
        id: 'server-history-1',
        moduleId: 'jane',
        moduleName: 'Jane',
        status: 'success',
        durationMs: 1200,
        message: 'completed',
        inputFiles: ['source.xlsx'],
        outputFile: 'result.xlsx',
        resultDownloadPath: '/api/process-history/files/42/download',
        resultDownloadBackendTarget: 'remote',
        historyWarnings: ['历史结果已归档。'],
        resultFile: {
          id: 42,
          filename: 'result.xlsx',
          downloadPath: '/api/process-history/files/42/download',
        },
        summary: [],
      })

      expect(records[0].id).toBe('server-history-1')
      expect(records[0].resultDownloadPath).toBe('/api/process-history/files/42/download')
      expect(records[0].resultDownloadBackendTarget).toBe('remote')
      expect(records[0].historyWarnings).toEqual(['历史结果已归档。'])
      expect(records[0].resultFile?.id).toBe(42)
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('normalizes dirty localStorage process history records before returning them', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    })
    storage.set('tos.process-history.jane', JSON.stringify([
      {
        id: 'dirty-local-1',
        moduleId: 'jane',
        moduleName: 'Jane',
        status: 'success',
        durationMs: 1200,
        message: 'completed',
        inputFiles: ['source.xlsx', { filename: 'bad-object.xlsx' }, 123],
        outputFile: {
          filename: 'object-result.xlsx',
          downloadPath: '/api/process-history/files/51/download',
        },
        summary: [
          { label: 'Rows', value: '10', note: 'ok' },
          { label: 'Dropped', value: 0 },
          'bad-summary',
        ],
        resultFile: {
          id: 51,
          filename: 'archived-result.xlsx',
          fileSize: 2048,
          downloadPath: '/api/process-history/files/51/download',
        },
        createdAt: '2026-07-03T08:00:00.000Z',
      },
      {
        id: 'dirty-local-2',
        moduleId: 'jane',
        moduleName: 'Jane',
        status: 'success',
        durationMs: 800,
        message: 'completed',
        inputFiles: null,
        outputFile: ['array-result.xlsx'],
        summary: null,
        resultFile: ['not-a-result-file'],
        createdAt: '2026-07-03T08:01:00.000Z',
      },
    ]))

    try {
      const records = loadModuleHistory('jane')

      expect(records).toHaveLength(2)
      expect(records[0].outputFile).toBe('object-result.xlsx')
      expect(records[0].inputFiles).toEqual(['source.xlsx'])
      expect(records[0].summary).toEqual([{ label: 'Rows', value: '10', note: 'ok' }])
      expect(records[0].resultFile).toEqual({
        id: 51,
        filename: 'archived-result.xlsx',
        fileSize: 2048,
        downloadPath: '/api/process-history/files/51/download',
      })
      expect(records[1].outputFile ?? '').toBe('')
      expect(records[1].inputFiles).toEqual([])
      expect(records[1].summary).toEqual([])
      expect(records[1].resultFile).toBeUndefined()
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('can read persisted process history from the remote backend when requested', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    const requests: Array<{ method: string; url: string }> = []
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        method: String(init?.method || 'GET'),
        url: String(input),
      })
      return new Response(JSON.stringify({
        records: [{
          id: 'remote-process-1',
          moduleId: 'jane',
          moduleName: 'Jane',
          status: 'success',
          durationMs: 1200,
          message: 'completed',
          inputFiles: ['source.xlsx'],
          summary: [],
          createdAt: '2026-06-30T03:30:00.000Z',
        }],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch

    try {
      const records = await fetchPersistedProcessHistoryRecords({
        moduleIds: ['jane'],
        page: 1,
        pageSize: 1,
        backendTarget: 'remote',
      })

      expect(records).toHaveLength(1)
      expect(requests).toHaveLength(1)
      expect(requests[0]).toEqual({
        method: 'GET',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/records?moduleIds=jane&page=1&limit=1',
      })
    } finally {
      globalThis.fetch = originalFetch
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('normalizes dirty persisted process history records from the backend', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })
    globalThis.fetch = (async () => new Response(JSON.stringify({
      records: [
        {
          id: 'dirty-remote-1',
          moduleId: 'jane',
          moduleName: 'Jane',
          status: 'success',
          durationMs: 1200,
          message: 'completed',
          inputFiles: ['remote-source.xlsx', { filename: 'bad-object.xlsx' }],
          outputFile: {
            filename: 'remote-object-result.xlsx',
            downloadPath: '/api/process-history/files/61/download',
          },
          summary: [
            { label: 'Rows', value: '20' },
            { label: 'Invalid', value: 1 },
          ],
          resultFile: {
            id: 61,
            filename: 'remote-archive.xlsx',
            downloadPath: '/api/process-history/files/61/download',
          },
          createdAt: '2026-07-03T08:02:00.000Z',
        },
        {
          id: 'dirty-remote-2',
          moduleId: 'jane',
          moduleName: 'Jane',
          status: 'success',
          durationMs: 600,
          message: 'completed',
          inputFiles: undefined,
          outputFile: ['array-result.xlsx'],
          summary: undefined,
          resultFile: { filename: 'missing-id.xlsx' },
          createdAt: '2026-07-03T08:03:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 2,
        total: 2,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })) as typeof fetch

    try {
      const result = await fetchPersistedProcessHistoryRecordPage({
        moduleIds: ['jane'],
        page: 1,
        pageSize: 2,
        backendTarget: 'remote',
      })

      expect(result.records).toHaveLength(2)
      expect(result.records[0].outputFile).toBe('remote-object-result.xlsx')
      expect(result.records[0].inputFiles).toEqual(['remote-source.xlsx'])
      expect(result.records[0].summary).toEqual([{ label: 'Rows', value: '20' }])
      expect(result.records[0].resultFile?.filename).toBe('remote-archive.xlsx')
      expect(result.records[1].outputFile ?? '').toBe('')
      expect(result.records[1].inputFiles).toEqual([])
      expect(result.records[1].summary).toEqual([])
      expect(result.records[1].resultFile).toBeUndefined()
      expect(result.pagination.total).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('serializes personal history filters for downloadable records', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    const requests: Array<{ method: string; url: string }> = []
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        method: String(init?.method || 'GET'),
        url: String(input),
      })
      return new Response(JSON.stringify({
        records: [{
          id: 'remote-process-1',
          personId: 'jane',
          moduleId: 'jane-bom-compare',
          moduleName: 'Jane PRODUCTION Compare',
          status: 'success',
          durationMs: 1200,
          message: 'completed',
          inputFiles: ['source.xlsx'],
          resultDownloadPath: '/api/process-history/files/42/download',
          summary: [],
          createdAt: '2026-06-30T03:30:00.000Z',
        }],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch

    try {
      const records = await fetchPersistedProcessHistoryRecords({
        personId: 'jane',
        moduleIds: ['jane-bom-compare'],
        createdFrom: '2026-06-01T00:00:00.000Z',
        createdTo: '2026-07-01T00:00:00.000Z',
        downloadableOnly: true,
        page: 2,
        pageSize: 30,
        backendTarget: 'remote',
      })

      expect(records).toHaveLength(1)
      expect(records[0].personId).toBe('jane')
      expect(requests[0]).toEqual({
        method: 'GET',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/records?moduleIds=jane-bom-compare&personId=jane&createdFrom=2026-06-01T00%3A00%3A00.000Z&createdTo=2026-07-01T00%3A00%3A00.000Z&downloadableOnly=true&page=2&limit=30',
      })
    } finally {
      globalThis.fetch = originalFetch
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('finds the latest downloadable process history record', () => {
    const downloadable = {
      id: 'history-2',
      moduleId: 'jane',
      moduleName: 'Jane',
      status: 'success' as const,
      durationMs: 100,
      message: 'completed',
      inputFiles: [],
      outputFile: 'result.xlsx',
      resultDownloadPath: '/api/process-history/files/42/download',
      summary: [],
      createdAt: '2026-06-30T03:30:00.000Z',
    }

    expect(findLatestDownloadableHistoryRecord([
      {
        id: 'history-1',
        moduleId: 'jane',
        moduleName: 'Jane',
        status: 'success',
        durationMs: 100,
        message: 'completed',
        inputFiles: [],
        outputFile: 'legacy-result.xlsx',
        summary: [],
        createdAt: '2026-06-30T03:29:00.000Z',
      },
      downloadable,
    ])).toBe(downloadable)
  })

  it('builds remote backend URLs for persisted history result downloads', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })

    try {
      await expect(buildProcessHistoryResultDownloadUrl({
        id: 'history-2',
        moduleId: 'jane',
        moduleName: 'Jane',
        status: 'success',
        durationMs: 100,
        message: 'completed',
        inputFiles: [],
        outputFile: 'result.xlsx',
        resultDownloadPath: '/api/process-history/files/42/download',
        resultDownloadBackendTarget: 'remote',
        summary: [],
        createdAt: '2026-06-30T03:30:00.000Z',
      })).resolves.toBe(
        'https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/files/42/download',
      )
    } finally {
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })
})
