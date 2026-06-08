import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import { launchAdidasMaterialsCollector } from './adidasMaterialsApi'

function stubWindow(electronAPI?: Partial<ElectronApi>): void {
  const body = {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  }
  vi.stubGlobal('window', {
    electronAPI,
    setTimeout,
    clearTimeout,
  })
  vi.stubGlobal('document', {
    body,
    createElement: vi.fn(() => ({
      href: '',
      style: {},
      click: vi.fn(),
    })),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adidasMaterialsApi', () => {
  it('uses the Electron collector bridge when available', async () => {
    const launchAdidasMaterialCollector = vi.fn().mockResolvedValue({
      success: true,
      alreadyOpen: true,
    })
    const recordDiagnosticEvent = vi.fn().mockResolvedValue({ success: true })
    stubWindow({ launchAdidasMaterialCollector, recordDiagnosticEvent })

    await expect(launchAdidasMaterialsCollector()).resolves.toMatchObject({
      success: true,
      alreadyOpen: true,
    })
    expect(launchAdidasMaterialCollector).toHaveBeenCalledOnce()
    expect(recordDiagnosticEvent).toHaveBeenCalledWith(expect.objectContaining({
      module: 'adidas 材料',
      action: 'launch-start',
    }))
  })

  it('uses the local launcher endpoint from a normal web page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        mode: 'external-browser',
        browser: 'Microsoft Edge',
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    stubWindow()

    await expect(launchAdidasMaterialsCollector()).resolves.toMatchObject({
      success: true,
      mode: 'external-browser',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3210/health',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3210/api/adidas-materials/start',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not fall back to a protocol launch when the local launcher is outdated', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    stubWindow()

    await expect(launchAdidasMaterialsCollector()).rejects.toThrow('本机后台启动器版本过旧')
  })

  it('boots the local launcher before starting the external browser from a web page', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        mode: 'external-browser',
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    stubWindow()

    await expect(launchAdidasMaterialsCollector()).resolves.toMatchObject({
      success: true,
      mode: 'external-browser',
    })
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:3210/api/adidas-materials/start',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
