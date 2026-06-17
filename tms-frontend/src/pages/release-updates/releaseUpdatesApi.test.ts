import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import { fetchReleaseUpdates } from './releaseUpdatesApi'

vi.mock('../../shared/api/backendClient', () => ({
  requestBackendJson: vi.fn(),
}))

describe('releaseUpdatesApi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(requestBackendJson).mockReset()
  })

  it('reads release records from the remote server backend first', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        ok: true,
        version: '0.9.8-beta.3.8',
        total: 1,
        records: [
          {
            id: 1,
            recordKey: 'git-remote',
            version: '0.9.8-beta.3.7',
            releaseDate: '2026-06-13',
            category: 'fixed',
            pageName: 'Release updates',
            pagePath: '/release-updates',
            title: 'Remote database record',
            description: 'Server database record',
            createdBy: 'git',
            createdAt: '',
            updatedAt: '',
          },
        ],
      })),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchReleaseUpdates(160)).resolves.toMatchObject({
      source: 'backend',
      version: '0.9.8-beta.3.8',
      records: [
        {
          version: '0.9.8-beta.3.7',
          title: 'Remote database record',
        },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ai.tomwell.net:56130/tos/desktop-api/api/release-updates?limit=160',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(requestBackendJson).not.toHaveBeenCalled()
  })

  it('keeps the backend runtime version separate from record history versions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('remote unavailable')))
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

  it('falls back to bundled release notes when remote and local backends are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('remote unavailable')))
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
    })
  })

  it('falls back to bundled release notes when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('remote unavailable')))
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
    })
    expect(payload.total).toBe(payload.records.length)
    expect(payload.records.length).toBeGreaterThan(2)
    expect(payload.records[0]).toMatchObject({
      version: fallbackAppVersion,
    })
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

  it('does not fall back to bundled release notes when the backend version is stale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('remote unavailable')))
    vi.mocked(requestBackendJson).mockRejectedValue(
      new Error(`当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 ${fallbackAppVersion}，请重启本地后端。`),
    )

    await expect(fetchReleaseUpdates(160)).rejects.toThrow('当前后端版本未更新')
  })

  it('applies the requested limit to bundled history records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('remote unavailable')))
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(3)

    expect(payload.source).toBe('bundled')
    expect(payload.records).toHaveLength(3)
    expect(payload.total).toBe(3)
  })
})
