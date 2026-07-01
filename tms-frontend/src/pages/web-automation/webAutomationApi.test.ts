import { describe, expect, it, vi } from 'vitest'

import type { AutomationAppInfo } from '../../types/electronApi'
import {
  createAutomationRunRecord,
  createPackingListAutoDownloadAttempt,
  createPackingListAutoDownloadBatch,
  downloadAutomationRunFile,
  fetchLatestPackingListAutoDownloadBatch,
  fetchAutomationRuns,
  finishAutomationRunRecord,
  formatAutomationLauncherErrorMessage,
  getAutomationHelperUpdateMessage,
  isLocalExecutorBusy,
  launchAutomationConsole,
  minimumAutomationHelperVersion,
  openInfornexusAutoAddSearchPage,
  probeLocalAutomationLauncherHealthPayload,
  probeLocalExecutorHealth,
  syncLocalAutomationModules,
} from './webAutomationApi'

const compatibleHelperVersion = '0.9.8-beta.3.32'

describe('webAutomationApi', () => {
  it('opens the Infornexus auto-add search page through the local executor', async () => {
    const requests: Array<{
      body: Record<string, unknown>
      headers: Record<string, string>
      method: string
      url: string
    }> = []
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        headers: init?.headers as Record<string, string>,
        method: String(init?.method || 'GET'),
        url: String(input),
      })
      return new Response(JSON.stringify({
        ok: true,
        loginSuccess: true,
        searchOpened: true,
        manualSessionId: 'manual-session-1',
        autoAddSearchUrl: 'https://network.infornexus.com/en/trade/Search.jsp#searchResults',
        finalUrl: 'https://network.infornexus.com/en/trade/Search.jsp#searchResults',
        title: 'Infor Nexus Search',
        message: 'Infor Nexus auto-add search page opened successfully.',
        generatedAt: '2026-06-25T00:00:00.000Z',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof window.fetch
    const mockWindow = {
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      fetch: mockFetch,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    } as unknown as Pick<Window, 'clearTimeout' | 'fetch' | 'setTimeout'>
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    try {
      const result = await openInfornexusAutoAddSearchPage({
        baseUrl: 'http://127.0.0.1:3003/',
        headless: false,
        password: 'secret',
        token: 'local-token',
        username: 'user@example.com',
      })

      expect(result.searchOpened).toBe(true)
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: 'http://127.0.0.1:3003/api/open-infornexus-auto-add-search',
      })
      expect(requests[0].headers['Content-Type']).toBe('application/json')
      expect(requests[0].headers['X-Executor-Token']).toBe('local-token')
      expect(requests[0].body).toEqual({
        headless: false,
        password: 'secret',
        token: 'local-token',
        username: 'user@example.com',
      })
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('formats missing local automation app errors for users', () => {
    expect(formatAutomationLauncherErrorMessage(
      'Unknown automation app: shipping-automation-demo',
      'shipping-automation-demo',
    )).toContain('本机自动化助手版本过旧或安装不完整')
    expect(formatAutomationLauncherErrorMessage(
      'Unknown automation app: shipping-automation-demo',
      'shipping-automation-demo',
    )).toContain('Shipping 执行器')
  })

  it('formats launcher proxy connection resets for stop/restart cases', () => {
    const message = formatAutomationLauncherErrorMessage('Automation app proxy failed: read ECONNRESET')

    expect(message).toContain('执行器连接已中断')
    expect(message).toContain('重新启动执行器')
    expect(message).not.toContain('ECONNRESET')
  })

  it('does not require the helper to match a newer TOS app version', () => {
    const activeApp = createAutomationApp({
      version: '0.9.8-beta.3.28',
    })

    expect(minimumAutomationHelperVersion).toBe(compatibleHelperVersion)
    expect(getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: compatibleHelperVersion,
    }, activeApp)).toBe('')
  })

  it('prompts when the helper is below the default minimum feature version', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: '0.9.8-beta.3.18',
    }, createAutomationApp())

    expect(message).toContain('0.9.8-beta.3.18')
    expect(message).toContain(compatibleHelperVersion)
  })

  it('does not use the automation app version as the helper version fallback', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
    }, createAutomationApp({
      version: '0.9.8-beta.3.28',
    }))

    expect(message).toContain(compatibleHelperVersion)
  })

  it('uses the launcher helper version when executor health omits it', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
    }, createAutomationApp({
      version: '0.9.8-beta.3.28',
    }), compatibleHelperVersion, compatibleHelperVersion)

    expect(message).toBe('')
  })

  it('still warns when the launcher helper version fallback is too old', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
    }, createAutomationApp(), compatibleHelperVersion, '0.9.8-beta.3.18')

    expect(message).toContain('0.9.8-beta.3.18')
    expect(message).toContain(compatibleHelperVersion)
  })

  it('uses an app-specific helper requirement when present', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: compatibleHelperVersion,
    }, createAutomationApp({
      requiredHelperVersion: '0.9.8-beta.3.33',
    }))

    expect(message).toContain(compatibleHelperVersion)
    expect(message).toContain('0.9.8-beta.3.33')
  })

  it('passes forceUpdate to the desktop automation launcher', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const launchAutomationApp = vi.fn().mockResolvedValue({ success: true, url: 'http://127.0.0.1:3002' })
    const recordDiagnosticEvent = vi.fn().mockResolvedValue({ success: true })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        electronAPI: {
          launchAutomationApp,
          recordDiagnosticEvent,
        },
      },
    })

    try {
      const result = await launchAutomationConsole('microsoft-login-n8n-demo', { forceUpdate: true })

      expect(result.success).toBe(true)
      expect(launchAutomationApp).toHaveBeenCalledWith('microsoft-login-n8n-demo', { forceUpdate: true })
      expect(recordDiagnosticEvent).toHaveBeenCalled()
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('defaults automation launcher starts to force module update', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const launchAutomationApp = vi.fn().mockResolvedValue({ success: true, url: 'http://127.0.0.1:3002' })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        electronAPI: {
          launchAutomationApp,
          recordDiagnosticEvent: vi.fn().mockResolvedValue({ success: true }),
        },
      },
    })

    try {
      await launchAutomationConsole('shipping-automation-demo')

      expect(launchAutomationApp).toHaveBeenCalledWith('shipping-automation-demo', { forceUpdate: true })
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('detects local executor busy states', () => {
    expect(isLocalExecutorBusy(null)).toBe(false)
    expect(isLocalExecutorBusy({ ok: true, activeRunCount: 1 })).toBe(true)
    expect(isLocalExecutorBusy({ ok: true, busy: true })).toBe(true)
    expect(isLocalExecutorBusy({ ok: true, activeRuns: [{}] })).toBe(true)
  })

  it('allows slow local executor health probes before marking it disconnected', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const requests: string[] = []
    const timeouts: number[] = []
    const mockFetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({
        ok: true,
        helperVersion: compatibleHelperVersion,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof window.fetch
    const mockWindow = {
      clearTimeout: vi.fn(),
      fetch: mockFetch,
      setTimeout: vi.fn((_handler: TimerHandler, timeout?: number) => {
        timeouts.push(Number(timeout))
        return 1
      }),
    } as unknown as Pick<Window, 'clearTimeout' | 'fetch' | 'setTimeout'>
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    try {
      const health = await probeLocalExecutorHealth('http://127.0.0.1:3210/api/apps/shipping-automation-demo/proxy')

      expect(health.ok).toBe(true)
      expect(requests).toEqual([
        'http://127.0.0.1:3210/api/apps/shipping-automation-demo/proxy/api/health',
        'http://127.0.0.1:3210/api/apps/shipping-automation-demo/proxy/health',
      ])
      expect(timeouts).toEqual([2500, 2500])
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('keeps launcher health probes quick without using the executor timeout', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const requests: string[] = []
    const timeouts: number[] = []
    const mockFetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({
        ok: true,
        helperVersion: compatibleHelperVersion,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof window.fetch
    const mockWindow = {
      clearTimeout: vi.fn(),
      fetch: mockFetch,
      setTimeout: vi.fn((_handler: TimerHandler, timeout?: number) => {
        timeouts.push(Number(timeout))
        return 1
      }),
    } as unknown as Pick<Window, 'clearTimeout' | 'fetch' | 'setTimeout'>
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    try {
      const health = await probeLocalAutomationLauncherHealthPayload()

      expect(health?.ok).toBe(true)
      expect(requests).toEqual(['http://127.0.0.1:3210/health'])
      expect(timeouts).toEqual([1200])
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('requests local automation module hot update through the launcher', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const requests: Array<{ body: Record<string, unknown>; method: string; url: string }> = []
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({
          ok: true,
          helperVersion: compatibleHelperVersion,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      requests.push({
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        method: String(init?.method || 'GET'),
        url,
      })
      return new Response(JSON.stringify({
        ok: true,
        checked: 3,
        installed: 1,
        upToDate: 2,
        pendingRestart: 0,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof window.fetch
    const mockWindow = {
      clearTimeout: vi.fn(),
      fetch: mockFetch,
      setTimeout: vi.fn(() => 1),
    } as unknown as Pick<Window, 'clearTimeout' | 'fetch' | 'setTimeout'>
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    try {
      const result = await syncLocalAutomationModules()

      expect(result.installed).toBe(1)
      expect(requests).toEqual([{
        body: { forceUpdate: true },
        method: 'POST',
        url: 'http://127.0.0.1:3210/api/modules/sync-all',
      }])
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('creates an automation run record without requiring a source Excel file', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalXMLHttpRequest = globalThis.XMLHttpRequest
    const requests: Array<{ method: string; url: string; fields: Record<string, string>; hasSourceFile: boolean }> = []
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })
    class MockXMLHttpRequest {
      status = 200
      responseText = JSON.stringify({
        run: {
          runId: 'run-ticket-1',
          automationId: 'ticket-owner-statistics',
          moduleId: 'ticket-owner-statistics',
          runName: '统计 ticket 归属 自动化',
          status: 'running',
          message: 'started',
        },
      })
      upload = { onprogress: null as null | ((event: ProgressEvent) => void) }
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      private method = ''
      private url = ''

      open(method: string, url: string): void {
        this.method = method
        this.url = url
      }

      send(formData: FormData): void {
        const fields: Record<string, string> = {}
        let hasSourceFile = false
        for (const [key, value] of formData.entries()) {
          if (key === 'source_file') {
            hasSourceFile = true
          } else {
            fields[key] = String(value)
          }
        }
        requests.push({ method: this.method, url: this.url, fields, hasSourceFile })
        this.onload?.()
      }
    }
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest

    try {
      const run = await createAutomationRunRecord('ticket-owner-statistics', null, '统计 ticket 归属 自动化')

      expect(run?.runId).toBe('run-ticket-1')
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: 'http://127.0.0.1:8000/api/automation/runs',
        fields: {
          automation_id: 'ticket-owner-statistics',
          module_id: 'ticket-owner-statistics',
          run_name: '统计 ticket 归属 自动化',
          message: 'started',
        },
        hasSourceFile: false,
      })
    } finally {
      globalThis.XMLHttpRequest = originalXMLHttpRequest
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('creates packing-list auto-download batches through the remote backend in hybrid mode', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalXMLHttpRequest = globalThis.XMLHttpRequest
    const requests: Array<{
      fields: Record<string, string>
      hasSourceFile: boolean
      method: string
      url: string
    }> = []
    vi.stubEnv('VITE_BACKEND_ROUTING_MODE', 'hybrid')
    vi.stubEnv('VITE_REMOTE_BACKEND_URL', 'https://ai.tomwell.net:56130/tos/desktop-api/')
    vi.stubEnv('VITE_LOCAL_BACKEND_URL', 'http://127.0.0.1:8000/')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })

    class MockXMLHttpRequest {
      status = 200
      responseText = JSON.stringify({
        batch: {
          batchId: 'plad-1',
          bucket: 'tos-packing-list-auto-download',
          objectPrefix: 'packing-list-auto-download/2026-07-01/plad-1',
          sourceFile: {
            bucket: 'tos-packing-list-auto-download',
            downloadPath: '/api/automation/packing-list-auto-download/batches/plad-1/source/download',
          },
        },
      })
      upload = { onprogress: null as null | ((event: ProgressEvent) => void) }
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      private method = ''
      private url = ''

      open(method: string, url: string): void {
        this.method = method
        this.url = url
      }

      send(formData: FormData): void {
        const fields: Record<string, string> = {}
        let hasSourceFile = false
        for (const [key, value] of formData.entries()) {
          if (key === 'source_file') {
            hasSourceFile = true
          } else {
            fields[key] = String(value)
          }
        }
        requests.push({ method: this.method, url: this.url, fields, hasSourceFile })
        this.onload?.()
      }
    }
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest

    try {
      const sourceFile = new File(['excel'], 'packing-list.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const batch = await createPackingListAutoDownloadBatch({
        runId: 'run-plad',
        batchName: 'packing list batch',
        sourceFile,
      })

      expect(batch.batchId).toBe('plad-1')
      expect(batch.bucket).toBe('tos-packing-list-auto-download')
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/automation/packing-list-auto-download/batches',
        fields: {
          run_id: 'run-plad',
          batch_name: 'packing list batch',
        },
        hasSourceFile: true,
      })
    } finally {
      globalThis.XMLHttpRequest = originalXMLHttpRequest
      vi.unstubAllEnvs()
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  it('reads and creates packing-list resume attempts through the remote backend in hybrid mode', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    const requests: Array<{ method: string; url: string; body: any }> = []
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
      const url = String(input)
      requests.push({
        method: String(init?.method || 'GET'),
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      if (url.endsWith('/latest')) {
        return new Response(JSON.stringify({
          batch: { batchId: 'plad-1', resumable: true },
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      return new Response(JSON.stringify({
        attempt: { attemptId: 'pla-1', batchId: 'plad-1', mode: 'continue' },
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch

    try {
      const latest = await fetchLatestPackingListAutoDownloadBatch()
      const attempt = await createPackingListAutoDownloadAttempt('plad-1', {
        runId: 'run-plad',
        mode: 'continue',
      })

      expect(latest?.batchId).toBe('plad-1')
      expect(attempt.attemptId).toBe('pla-1')
      expect(requests).toEqual([{
        method: 'GET',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/automation/packing-list-auto-download/batches/latest',
        body: null,
      }, {
        method: 'POST',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/automation/packing-list-auto-download/batches/plad-1/attempts',
        body: {
          runId: 'run-plad',
          mode: 'continue',
        },
      }])
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

  it('returns persisted MinIO run files when finishing a run record', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    const requests: Array<{ method: string; url: string; body: any }> = []
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
        body: JSON.parse(String(init?.body || '{}')),
      })
      return new Response(JSON.stringify({
        run: { runId: 'run-ticket-1', status: 'success' },
        files: [{
          id: 172,
          runId: 'run-ticket-1',
          fileRole: 'result_excel',
          bucket: 'tos-run-files',
          objectKey: 'automation/runs/run-ticket-1/result.xlsx',
          originalFilename: 'Ticket ownership.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileSize: 1024,
          sha256: 'abc123',
          createdAt: '2026-06-29T00:00:00.000Z',
          downloadPath: '/api/automation/run-files/172/download',
        }],
        warnings: [],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch

    try {
      const payload = await finishAutomationRunRecord('run-ticket-1', 'success', 'done', { ok: true }, [{
        url: 'http://127.0.0.1:3002/artifacts/result.xlsx',
        fileRole: 'result_excel',
        fileName: 'Ticket ownership.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }])

      expect(payload.files).toHaveLength(1)
      expect(payload.files[0].downloadPath).toBe('/api/automation/run-files/172/download')
      expect(requests).toHaveLength(1)
      expect(requests[0].method).toBe('PATCH')
      expect(requests[0].url).toBe('http://127.0.0.1:8000/api/automation/runs/run-ticket-1')
      expect(requests[0].body.resultFiles).toEqual([{
        url: 'http://127.0.0.1:3002/artifacts/result.xlsx',
        fileRole: 'result_excel',
        fileName: 'Ticket ownership.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }])
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

  it('can read automation runs from the remote backend when requested', async () => {
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
        runs: [{ runId: 'remote-run-1', automationId: 'shipping-automation', moduleId: 'shipping-automation' }],
        pagination: { page: 1, pageSize: 1, total: 1 },
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch

    try {
      const payload = await fetchAutomationRuns({
        page: 1,
        pageSize: 1,
        backendTarget: 'remote',
      })

      expect(payload.runs).toHaveLength(1)
      expect(requests).toHaveLength(1)
      expect(requests[0]).toEqual({
        method: 'GET',
        url: 'https://ai.tomwell.net:56130/tos/desktop-api/api/automation/runs?page=1&pageSize=1',
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

  it('surfaces run file download errors from the backend response', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalFetch = globalThis.fetch
    const requests: string[] = []
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { pathname: '/' },
      },
    })
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({
        detail: '执行文件暂时无法下载，请联系管理员检查 MinIO 存储连接。',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      })
    }) as typeof fetch

    try {
      await expect(downloadAutomationRunFile({
        bucket: 'tos-run-files',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        downloadPath: '/api/automation/run-files/172/download',
        fileRole: 'result_excel',
        fileSize: 100,
        id: 172,
        objectKey: 'runs/result.xlsx',
        originalFilename: 'result.xlsx',
        runId: 'run-1',
        sha256: 'abc123',
        createdAt: '2026-06-26T00:00:00.000Z',
      })).rejects.toThrow('执行文件暂时无法下载，请联系管理员检查 MinIO 存储连接。')
      expect(requests).toHaveLength(1)
      expect(requests[0]).toContain('/api/automation/run-files/172/download')
    } finally {
      globalThis.fetch = originalFetch
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })
})

function createAutomationApp(overrides: Partial<AutomationAppInfo> = {}): AutomationAppInfo {
  return {
    id: 'shipping-automation-demo',
    name: 'Shipping Automation Demo',
    description: 'Bundled shipping executor.',
    provider: 'Playwright',
    category: 'web automation',
    version: '0.9.8-beta.3.28',
    available: true,
    running: false,
    port: 3003,
    url: 'http://127.0.0.1:3003',
    ...overrides,
  }
}
