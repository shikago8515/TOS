import { beforeAll, describe, expect, it, vi } from 'vitest'

import DraftPackingComparePage from '../pages/draft-packing-compare/DraftPackingComparePage.vue'
import IplexDualTableComparePage from '../pages/iplex-dual-table-compare/IplexDualTableComparePage.vue'
import InfornexusAutoAddPage from '../pages/infornexus-auto-add/InfornexusAutoAddPage.vue'
import JasonPdfReorderPage from '../pages/jason-pdf-reorder/JasonPdfReorderPage.vue'
import JaneInfornexusPage from '../pages/jane-infornexus/JaneInfornexusPage.vue'
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import ReleaseUpdatesPage from '../pages/release-updates/ReleaseUpdatesPage.vue'
import PoAutoDownloadPage from '../pages/po-auto-download/PoAutoDownloadPage.vue'
import ShippingAutomationPage from '../pages/shipping-automation/ShippingAutomationPage.vue'
import TcInvAutomationPage from '../pages/tc-inv-automation/TcInvAutomationPage.vue'
import WebAutomationPage from '../pages/web-automation/WebAutomationPage.vue'
import XinlongtaiShippingAutomationPage from '../pages/xinlongtai-shipping-automation/XinlongtaiShippingAutomationPage.vue'

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
  }, 30_000)

  it('redirects the legacy invoice PDF reorder route to the Jason canonical path', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/it-invoice-pdf-reorder')

    expect(route?.redirect).toBe('/jason/pdf-reorder')
  }, 30_000)

  it('routes PDF compare through its existing canonical path', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/draft-packing-compare')

    expect(route?.name).toBe('draft-packing-compare')
    expect(route?.meta.title).toBe('产地证核对')
    expect(route?.components?.default).toBe(DraftPackingComparePage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes the web automation hub to its real page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/web-automation')

    expect(route?.name).toBe('web-automation')
    expect(route?.components?.default).toBe(WebAutomationPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('does not expose the removed external Infornexus sub-app page', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/infornexus')

    expect(route).toBeUndefined()
  })

  it('routes PO auto download to its standalone scenario page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/web-automation/scenarios/po-auto-download')

    expect(route?.name).toBe('web-automation-scenario-po-auto-download')
    expect(route?.components?.default).toBe(PoAutoDownloadPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes shipping automation to its standalone scenario page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/web-automation/scenarios/shipping-automation')

    expect(route?.name).toBe('web-automation-scenario-shipping-automation')
    expect(route?.components?.default).toBe(ShippingAutomationPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes iPlex dual table compare to its real page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/iplex/dual-table-compare')

    expect(route?.name).toBe('iplex-dual-table-compare')
    expect(route?.components?.default).toBe(IplexDualTableComparePage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes Jane Infornexus to its real page component', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/jane-infornexus')

    expect(route?.name).toBe('jane-infornexus')
    expect(route?.components?.default).toBe(JaneInfornexusPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes Eric Infornexus directly to the auto-add workspace page', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/eric-infornexus')

    expect(route?.name).toBe('eric-infornexus')
    expect(route?.components?.default).toBe(InfornexusAutoAddPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('redirects the removed Jessica Infornexus route to Eric Infornexus', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/jessica-infornexus')

    expect(route?.redirect).toBe('/eric-infornexus')
  })

  it('redirects the removed browser plugins route to Eric Infornexus', async () => {
    const { router } = await import('./router')
    const route = router.getRoutes().find((entry) => entry.path === '/browser-plugins')

    expect(route?.redirect).toBe('/eric-infornexus')
  })

  it('routes Xinlongtai shipping automation to its standalone scenario page component', async () => {
    const { router } = await import('./router')
    const route = router
      .getRoutes()
      .find((entry) => entry.path === '/web-automation/scenarios/xinlongtai-shipping-automation')

    expect(route?.name).toBe('web-automation-scenario-xinlongtai-shipping-automation')
    expect(route?.components?.default).toBe(XinlongtaiShippingAutomationPage)
    expect(route?.components?.default).not.toBe(RoutePlaceholder)
  })

  it('routes TC INV automation to its standalone scenario page component', async () => {
    const { router } = await import('./router')
    const route = router
      .getRoutes()
      .find((entry) => entry.path === '/web-automation/scenarios/tc-inv-automation')

    expect(route?.name).toBe('web-automation-scenario-tc-inv-automation')
    expect(route?.components?.default).toBe(TcInvAutomationPage)
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
