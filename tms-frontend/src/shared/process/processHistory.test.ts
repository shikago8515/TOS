import { describe, expect, it, vi } from 'vitest'

import { fetchPersistedProcessHistoryRecords } from './processHistory'

describe('processHistory', () => {
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
})
