import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import { getAppVersionInfo, getBackendRuntimeVersion, getUpdateStatusSnapshot } from './settingsApi'

function stubWindow(electronAPI?: Partial<ElectronApi>): void {
  vi.stubGlobal('window', { electronAPI })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('settingsApi', () => {
  it('uses Electron app version when the bridge is available', async () => {
    const getAppVersion = vi.fn().mockResolvedValue({
      version: '0.9.8-beta.3.0',
      isPackaged: true,
    })
    stubWindow({ getAppVersion })

    await expect(getAppVersionInfo()).resolves.toEqual({
      version: '0.9.8-beta.3.0',
      isPackaged: true,
    })
    expect(getAppVersion).toHaveBeenCalledTimes(1)
  })

  it('reads backend version in browser/server mode', async () => {
    stubWindow()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '0.9.8-beta.3.0' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAppVersionInfo()).resolves.toEqual({
      version: '0.9.8-beta.3.0',
      isPackaged: false,
    })
    expect(fetchMock).toHaveBeenCalledWith('https://ai.tomwell.net:56130/tos/desktop-api/')
  })

  it('uses the synchronized fallback version when backend version cannot be read', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getAppVersionInfo()).resolves.toEqual({
      version: fallbackAppVersion,
      isPackaged: false,
    })
  })

  it('builds browser/server update status without desktop update source or error', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const status = await getUpdateStatusSnapshot()

    expect(status).toMatchObject({
      status: 'unsupported',
      currentVersion: fallbackAppVersion,
      isPackaged: false,
      feedUrl: '',
      feedUrlSource: 'none',
      error: '',
    })
    expect(status.updateAvailable).toBe(false)
    expect(status.updateInfo).toBeNull()
    expect(status.manualDownload).toBeNull()
  })

  it('getBackendRuntimeVersion always fetches from backend regardless of Electron bridge', async () => {
    stubWindow()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '0.9.8-beta.3.15' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBackendRuntimeVersion()).resolves.toBe('0.9.8-beta.3.15')
    expect(fetchMock).toHaveBeenCalledWith('https://ai.tomwell.net:56130/tos/desktop-api/')
  })

  it('getBackendRuntimeVersion falls back to fallbackAppVersion on error', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getBackendRuntimeVersion()).resolves.toBe(fallbackAppVersion)
  })
})
