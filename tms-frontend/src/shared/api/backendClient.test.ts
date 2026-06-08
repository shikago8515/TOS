import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import {
  buildBackendDownloadUrl,
  getBackendBaseUrl,
  readErrorMessage,
} from './backendClient'

function stubWindow(electronAPI?: Partial<ElectronApi>): void {
  vi.stubGlobal('window', { electronAPI })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('backendClient', () => {
  it('prefers the Electron-started backend URL', async () => {
    const startBackendServer = vi.fn().mockResolvedValue({
      success: true,
      url: 'http://127.0.0.1:8123/',
    })
    const getBackendUrl = vi.fn()
    stubWindow({ startBackendServer, getBackendUrl })

    await expect(getBackendBaseUrl()).resolves.toBe('http://127.0.0.1:8123')
    expect(getBackendUrl).not.toHaveBeenCalled()
  })

  it('builds download URLs from the configured backend base URL', async () => {
    stubWindow({
      getBackendUrl: vi.fn().mockResolvedValue('http://127.0.0.1:8000/'),
    })

    await expect(
      buildBackendDownloadUrl('/api/jane/download/result.xlsx'),
    ).resolves.toBe('http://127.0.0.1:8000/api/jane/download/result.xlsx')
  })

  it('returns fallback text for non-Error failures', () => {
    expect(readErrorMessage('network failed', '无法连接后端服务')).toBe('无法连接后端服务')
  })
})
