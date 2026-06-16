import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import {
  buildBackendDownloadUrl,
  getBackendBaseUrl,
  readErrorMessage,
  readResponseMessage,
  requestBackendJson,
} from './backendClient'

function stubWindow(electronAPI?: Partial<ElectronApi>, pathname = '/'): void {
  vi.stubGlobal('window', { electronAPI, location: { pathname } })
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

  it('uses the server backend URL in local browser mode', async () => {
    stubWindow()

    await expect(getBackendBaseUrl()).resolves.toBe('https://ai.tomwell.net:56130/tos/desktop-api')
  })

  it('uses the same-origin TOS desktop API backend when the browser app is served under /tos', async () => {
    stubWindow(undefined, '/tos/release-updates')

    await expect(getBackendBaseUrl()).resolves.toBe('/tos/desktop-api')
  })

  it('returns fallback text for non-Error failures', () => {
    expect(readErrorMessage('network failed', 'fallback message')).toBe(
      'fallback message',
    )
  })

  it('formats FastAPI validation details', () => {
    expect(
      readResponseMessage({
        detail: [
          {
            loc: ['body', 'price_files'],
            msg: 'Field required',
          },
        ],
      }),
    ).toBe('缺少必传字段 price_files')
  })

  it('turns FastAPI API 404 into an actionable backend compatibility message', () => {
    expect(
      readResponseMessage(
        { detail: 'Not Found' },
        { status: 404, path: '/api/draft-packing-compare/process' },
      ),
    ).toBe('当前后端版本缺少此接口，请重启 TOS 或等待后端切换完成')
  })

  it('turns fetch network failures into a localized backend connection message', async () => {
    stubWindow()
    const path = '/api/release-updates?limit=160'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(
      requestBackendJson({ path }),
    ).rejects.toThrow('无法连接后端服务')
  })
})
