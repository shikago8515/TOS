import { describe, expect, it, vi } from 'vitest'

import {
  appendModuleHistory,
  buildProcessHistoryResultDownloadUrl,
  fetchPersistedProcessHistoryRecords,
  findLatestDownloadableHistoryRecord,
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
