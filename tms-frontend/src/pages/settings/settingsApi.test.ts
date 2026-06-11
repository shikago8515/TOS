import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import { getAppVersionInfo, getUpdateStatusSnapshot } from './settingsApi'

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
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/')
  })

  it('uses the synchronized fallback version when backend version cannot be read', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getAppVersionInfo()).resolves.toEqual({
      version: '0.9.8-beta.3.0',
      isPackaged: false,
    })
  })

  it('builds unsupported update status from the same fallback version', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getUpdateStatusSnapshot()).resolves.toMatchObject({
      status: 'unsupported',
      currentVersion: '0.9.8-beta.3.0',
      isPackaged: false,
    })
  })
})
