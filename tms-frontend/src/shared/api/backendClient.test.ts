import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../../types/electronApi'
import { fallbackAppVersion } from '../version/appVersion'
import {
  buildNonJsonResponseMessage,
  buildBackendDownloadUrl,
  getBackendBaseUrl,
  isBackendVersionMismatchMessage,
  postFormData,
  readErrorMessage,
  readResponseMessage,
  requestBackendJson,
} from './backendClient'

function stubWindow(electronAPI?: Partial<ElectronApi>, pathname = '/'): void {
  vi.stubGlobal('window', { electronAPI, location: { pathname } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

  it('uses the local backend URL in dev browser mode by default', async () => {
    stubWindow()

    await expect(getBackendBaseUrl()).resolves.toBe('http://127.0.0.1:8000')
  })

  it('prefers the configured backend URL in browser mode', async () => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://127.0.0.1:9000/')
    stubWindow()

    await expect(getBackendBaseUrl()).resolves.toBe('http://127.0.0.1:9000')
  })

  it('uses the public server backend URL in production browser mode by default', async () => {
    vi.stubEnv('DEV', false)
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
    ).rejects.toThrow('无法连接后端服务，请确认本地后端已启动并已重启到当前版本')
  })

  it('turns non-JSON backend responses into an actionable message', async () => {
    expect(
      buildNonJsonResponseMessage({
        status: 500,
        path: '/api/run-shipping-file',
        preview: '<html>executor crashed</html>',
      }),
    ).toContain('接口返回内容不是系统可识别的 JSON（HTTP 500，接口：/api/run-shipping-file）')
  })

  it('turns malformed successful JSON responses into an actionable backend response message', async () => {
    stubWindow()
    const path = '/api/automation/credentials/po-auto-download'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('null{"ok":true}'),
    }))

    await expect(
      requestBackendJson({ method: 'PUT', path, body: { username: 'user', password: 'test-password' } }),
    ).rejects.toThrow(`接口返回内容不是系统可识别的 JSON（HTTP 200，接口：${path}）`)
    await expect(
      requestBackendJson({ method: 'PUT', path, body: { username: 'user', password: 'test-password' } }),
    ).rejects.not.toThrow(/JSON\.parse|unexpected non-whitespace/i)
  })

  it('reports status and path when an error response is not JSON', async () => {
    stubWindow()
    const path = '/api/automation/credentials/po-auto-download'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('upstream temporarily unavailable'),
    }))

    await expect(
      requestBackendJson({ method: 'PUT', path, body: { username: 'user', password: 'test-password' } }),
    ).rejects.toThrow(`接口返回内容不是系统可识别的 JSON（HTTP 500，接口：${path}）`)
  })

  it('stops JSON requests when a required local backend version is stale', async () => {
    stubWindow({
      getBackendUrl: vi.fn().mockResolvedValue('http://127.0.0.1:8000/'),
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"version":"0.9.8-beta.3.17"}'),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestBackendJson({ path: '/api/release-updates?limit=160', requireRuntimeVersion: true }),
    ).rejects.toThrow(
      `当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 ${fallbackAppVersion}，请重启本地后端。`,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/',
      { method: 'GET' },
    )
  })

  it('stops form uploads before XMLHttpRequest when a required local backend version is stale', async () => {
    stubWindow({
      getBackendUrl: vi.fn().mockResolvedValue('http://127.0.0.1:8000/'),
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"version":"0.9.8-beta.3.17"}'),
    })
    const xhrMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('XMLHttpRequest', xhrMock)

    await expect(
      postFormData({
        path: '/api/tms-finance/work-sales/process',
        formData: new FormData(),
        requireRuntimeVersion: true,
      }),
    ).rejects.toThrow(
      `当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 ${fallbackAppVersion}，请重启本地后端。`,
    )
    expect(xhrMock).not.toHaveBeenCalled()
  })

  it('identifies backend version mismatch messages', () => {
    expect(
      isBackendVersionMismatchMessage(
        `当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 ${fallbackAppVersion}，请重启本地后端。`,
      ),
    ).toBe(true)
    expect(isBackendVersionMismatchMessage('处理失败，请重试')).toBe(false)
  })
})
