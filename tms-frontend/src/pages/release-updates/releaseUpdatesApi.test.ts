import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import { fetchReleaseUpdates, readBundledReleaseUpdates, readCachedReleaseUpdates } from './releaseUpdatesApi'

vi.mock('../../shared/api/backendClient', () => ({
  requestBackendJson: vi.fn(),
}))

describe('releaseUpdatesApi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(requestBackendJson).mockReset()
  })

  it('reads release records through the remote backend target', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(requestBackendJson).mockResolvedValue({
      ok: true,
      version: '0.9.8-beta.3.8',
      total: 238,
      records: [
        {
          id: 1,
          recordKey: 'git-local',
          version: '0.9.8-beta.3.7',
          releaseDate: '2026-06-13',
          category: 'fixed',
          pageName: 'Release updates',
          pagePath: '/release-updates',
          title: 'Local backend record',
          description: 'Local Python backend record',
          createdBy: 'git',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    await expect(fetchReleaseUpdates(160)).resolves.toMatchObject({
      source: 'backend',
      version: '0.9.8-beta.3.8',
      total: 238,
      records: [
        {
          version: '0.9.8-beta.3.7',
          title: 'Local backend record',
        },
      ],
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(requestBackendJson).toHaveBeenCalledWith({
      path: '/api/release-updates?limit=160',
      backendTarget: 'remote',
      timeoutMs: 6000,
    })
  })

  it('keeps the backend runtime version separate from record history versions', async () => {
    vi.mocked(requestBackendJson).mockResolvedValue({
      ok: true,
      version: '0.9.8-beta.3.8',
      total: 1,
      records: [
        {
          id: 1,
          recordKey: 'git-old',
          version: '0.9.8-beta.3.7',
          releaseDate: '2026-06-13',
          category: 'fixed',
          pageName: 'Release updates',
          pagePath: '/release-updates',
          title: 'Old record',
          description: 'Old database record',
          createdBy: 'git',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    await expect(fetchReleaseUpdates(160)).resolves.toMatchObject({
      source: 'backend',
      version: '0.9.8-beta.3.8',
      records: [
        {
          version: '0.9.8-beta.3.7',
          title: 'Old record',
        },
      ],
    })
  })

  it('falls back to bundled release notes when the backend is unavailable', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
    })
  })

  it('falls back to bundled release notes when the backend cannot be reached', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
    })
    expect(payload.total).toBe(payload.records.length)
    expect(payload.records.length).toBeGreaterThan(2)
    expect(payload.records.some((record) => record.version === fallbackAppVersion)).toBe(true)
    expect(payload.records.some((record) => record.pagePath === '/release-updates')).toBe(true)
    expect(payload.records.map((record) => record.version)).toEqual(
      expect.arrayContaining([
        fallbackAppVersion,
        '0.9.8-beta.3.10',
        '0.9.8-beta.3.9',
        '0.9.8-beta.3.1',
      ]),
    )
  })

  it('prepends the current release notes when bundled history lags behind the app version', async () => {
    vi.resetModules()
    vi.doMock('../../shared/version/appVersion', () => ({
      fallbackAppVersion: '9.9.9-beta.1',
    }))
    vi.doMock('../../shared/version/releaseNotes.json', () => ({
      default: {
        version: '9.9.9-beta.1',
        date: '2026-07-03',
        added: [],
        improved: ['Current fallback release'],
        fixed: [],
      },
    }))
    vi.doMock('../../shared/version/releaseHistory.json', () => ({
      default: [
        {
          recordKey: 'builtin-9.9.9-beta.0-fixed-old',
          version: '9.9.9-beta.0',
          releaseDate: '2026-07-02',
          category: 'fixed',
          pageName: 'Old history',
          pagePath: '/old-history',
          title: 'Old fallback release',
          description: 'Old fallback release record',
        },
      ],
    }))

    try {
      const backendClient = await import('../../shared/api/backendClient')
      vi.mocked(backendClient.requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))
      const api = await import('./releaseUpdatesApi')

      const payload = await api.fetchReleaseUpdates(2)

      expect(payload).toMatchObject({
        source: 'bundled',
        version: '9.9.9-beta.1',
        total: 2,
      })
      expect(payload.records[0]).toMatchObject({
        version: '9.9.9-beta.1',
        category: 'improved',
        pagePath: '/release-updates',
        title: 'Current fallback release',
      })
      expect(payload.records[1]).toMatchObject({
        version: '9.9.9-beta.0',
        title: 'Old fallback release',
      })
    } finally {
      vi.doUnmock('../../shared/version/appVersion')
      vi.doUnmock('../../shared/version/releaseNotes.json')
      vi.doUnmock('../../shared/version/releaseHistory.json')
      vi.resetModules()
    }
  })

  it('does not fall back to bundled release notes when the backend version is stale', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(
      new Error(`当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 ${fallbackAppVersion}，请重启本地后端。`),
    )

    await expect(fetchReleaseUpdates(160)).rejects.toThrow('当前后端版本未更新')
  })

  it('applies the requested limit to bundled history records', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(3)

    expect(payload.source).toBe('bundled')
    expect(payload.records).toHaveLength(3)
    expect(payload.total).toBe(3)
  })

  it('can provide bundled records synchronously for the first paint', () => {
    const payload = readBundledReleaseUpdates(3)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
      total: 3,
    })
    expect(payload.records).toHaveLength(3)
  })

  it('caches successful backend records for the next first paint', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.mocked(requestBackendJson).mockResolvedValue({
      ok: true,
      version: '0.9.8-beta.3.28',
      total: 238,
      records: [
        {
          id: 1,
          recordKey: 'local-latest',
          version: '0.9.8-beta.3.28',
          releaseDate: '2026-06-26',
          category: 'fixed',
          pageName: 'System Log',
          pagePath: '/release-updates',
          title: 'Local latest record',
          description: 'Loaded from local Python backend',
          createdBy: 'git',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    await fetchReleaseUpdates(160)
    const cachedPayload = readCachedReleaseUpdates(160)

    expect(cachedPayload).toMatchObject({
      source: 'cache',
      version: '0.9.8-beta.3.28',
      total: 238,
      records: [
        {
          recordKey: 'local-latest',
          title: 'Local latest record',
        },
      ],
    })
  })

  it('falls back to cached records before bundled records when backends are unavailable', async () => {
    const storage = createStorageMock()
    storage.setItem('tos.releaseUpdates.cache.v1', JSON.stringify({
      ok: true,
      version: '0.9.8-beta.3.28',
      total: 9,
      records: [
        {
          id: 2,
          recordKey: 'cached-latest',
          version: '0.9.8-beta.3.28',
          releaseDate: '2026-06-26',
          category: 'improved',
          pageName: 'System Log',
          pagePath: '/release-updates',
          title: 'Cached latest record',
          description: 'Loaded from local cache',
          createdBy: 'cache',
          createdAt: '',
          updatedAt: '',
        },
      ],
    }))
    vi.stubGlobal('localStorage', storage)
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      source: 'cache',
      total: 9,
      records: [
        {
          recordKey: 'cached-latest',
          title: 'Cached latest record',
        },
      ],
    })
  })

  it('keeps the cached total when slicing cached records for first paint', () => {
    const storage = createStorageMock()
    storage.setItem('tos.releaseUpdates.cache.v1', JSON.stringify({
      ok: true,
      version: '0.9.8-beta.3.28',
      total: 12,
      records: [
        buildCachedRecord(1),
        buildCachedRecord(2),
        buildCachedRecord(3),
      ],
    }))
    vi.stubGlobal('localStorage', storage)

    const payload = readCachedReleaseUpdates(2)

    expect(payload.source).toBe('cache')
    expect(payload.records).toHaveLength(2)
    expect(payload.total).toBe(12)
  })
})

function buildCachedRecord(id: number) {
  return {
    id,
    recordKey: `cached-${id}`,
    version: '0.9.8-beta.3.28',
    releaseDate: '2026-06-26',
    category: 'improved',
    pageName: 'System Log',
    pagePath: '/release-updates',
    title: `Cached record ${id}`,
    description: 'Loaded from local cache',
    createdBy: 'cache',
    createdAt: '',
    updatedAt: '',
  }
}

function createStorageMock(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
  }
}
