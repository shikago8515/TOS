import { describe, expect, it } from 'vitest'

import type { AutomationAppInfo } from '../../types/electronApi'
import {
  formatAutomationLauncherErrorMessage,
  getAutomationHelperUpdateMessage,
  minimumAutomationHelperVersion,
  openInfornexusAutoAddSearchPage,
} from './webAutomationApi'

const compatibleHelperVersion = '0.9.8-beta.3.19'

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
      requiredHelperVersion: '0.9.8-beta.3.27',
    }))

    expect(message).toContain(compatibleHelperVersion)
    expect(message).toContain('0.9.8-beta.3.27')
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
