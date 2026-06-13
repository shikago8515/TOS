import { beforeAll, describe, expect, it, vi } from 'vitest'

import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import ReleaseUpdatesPage from '../pages/release-updates/ReleaseUpdatesPage.vue'
import WebAutomationPage from '../pages/web-automation/WebAutomationPage.vue'

beforeAll(() => {
  vi.stubGlobal('location', {
    protocol: 'http:',
    host: '127.0.0.1:5174',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
  })
  vi.stubGlobal('history', {
    length: 1,
    state: null,
    replaceState: vi.fn(),
    pushState: vi.fn(),
    go: vi.fn(),
  })
  vi.stubGlobal('document', {
    querySelector: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('window', {
    location: globalThis.location,
    history: globalThis.history,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

describe('router', () => {
  it('routes the web automation hub to its real page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/web-automation')

    expect(route?.name).toBe('web-automation')
    expect(route?.components?.default).toBe(WebAutomationPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes release updates to its standalone page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/release-updates')

    expect(route?.name).toBe('release-updates')
    expect(route?.components?.default).toBe(ReleaseUpdatesPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })
})
