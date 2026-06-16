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

  it('falls back to bundled release notes without calling a hard-coded server endpoint', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))
    const fetchMock = vi.fn().mockRejectedValue(new Error('unexpected direct fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const payload = await fetchReleaseUpdates(160)

    expect(payload).toMatchObject({
      ok: true,
      source: 'bundled',
      version: fallbackAppVersion,
    })
    expect(fetchMock).not.toHaveBeenCalled()
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
    expect(payload.records[0]).toMatchObject({
      version: fallbackAppVersion,
      pagePath: '/settings',
    })
    expect(payload.records.map((record) => record.version)).toEqual(
      expect.arrayContaining([
        fallbackAppVersion,
        '0.9.8-beta.3.10',
        '0.9.8-beta.3.9',
        '0.9.8-beta.3.1',
      ]),
    )
  })

  it('applies the requested limit to bundled history records', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('Failed to fetch'))

    const payload = await fetchReleaseUpdates(3)

    expect(payload.source).toBe('bundled')
    expect(payload.records).toHaveLength(3)
    expect(payload.total).toBe(3)
  })
})
