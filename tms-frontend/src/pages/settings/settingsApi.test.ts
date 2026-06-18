import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import {
  getAppVersionInfo,
  getBackendRuntimeVersion,
  getServerInstallerVersions,
  getUpdateStatusSnapshot,
} from './settingsApi'

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
    expect(fetchMock).toHaveBeenCalledWith('https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/installer-versions')
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
    expect(fetchMock).toHaveBeenCalledWith('https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/installer-versions')
  })

  it('getBackendRuntimeVersion falls back to fallbackAppVersion on error', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getBackendRuntimeVersion()).resolves.toBe(fallbackAppVersion)
  })

  it('reads server installer package versions from backend config', async () => {
    stubWindow()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        version: '0.9.8-beta.3.20',
        manifestUpdatedAt: '2026-06-18T02:00:00Z',
        packages: [
          {
            id: 'automation-helper',
            label: 'TOS Web Automation Helper',
            version: '0.9.8-beta.3.20',
            filename: 'TOS-Automation-Helper-Setup.0.9.8-beta.3.20.exe',
            downloadPath: '/api/system/config/automation-helper/download',
            bucket: 'tos-downloads',
            objectKey: 'automation-helper/TOS-Automation-Helper-Setup.exe',
            contentType: 'application/vnd.microsoft.portable-executable',
            fileSize: 90617,
            sha256: 'a'.repeat(64),
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const versions = await getServerInstallerVersions()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/installer-versions',
    )
    expect(versions.packages).toHaveLength(1)
    expect(versions.packages[0]).toMatchObject({
      id: 'automation-helper',
      version: '0.9.8-beta.3.20',
      filename: 'TOS-Automation-Helper-Setup.0.9.8-beta.3.20.exe',
    })
  })

  it('falls back to an empty installer version list when backend metadata is unavailable', async () => {
    stubWindow()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(getServerInstallerVersions()).resolves.toEqual({
      ok: false,
      version: fallbackAppVersion,
      manifestUpdatedAt: null,
      packages: [],
    })
  })
})
