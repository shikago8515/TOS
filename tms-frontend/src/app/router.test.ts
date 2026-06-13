import { beforeAll, describe, expect, it, vi } from 'vitest'

import JasonPdfReorderPage from '../pages/jason-pdf-reorder/JasonPdfReorderPage.vue'
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
  it('routes the Jason PDF reorder canonical path to its real page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/jason/pdf-reorder')

    expect(route?.name).toBe('jason-pdf-reorder')
    expect(route?.components?.default).toBe(JasonPdfReorderPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('redirects the legacy invoice PDF reorder route to the Jason canonical path', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/it-invoice-pdf-reorder')

    expect(route?.redirect).toBe('/jason/pdf-reorder')
  })

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
