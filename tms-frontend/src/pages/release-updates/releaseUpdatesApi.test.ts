import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import { fetchReleaseUpdates } from './releaseUpdatesApi'

vi.mock('../../shared/api/backendClient', () => ({
  requestBackendJson: vi.fn(),
}))

describe('releaseUpdatesApi', () => {
  beforeEach(() => {
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
          pageName: '版本更新记录',
          pagePath: '/release-updates',
          title: '旧记录',
          description: '旧数据库记录',
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
          title: '旧记录',
        },
      ],
    })
  })

  it('falls back to bundled release notes when the backend cannot be reached', async () => {
    vi.mocked(requestBackendJson).mockRejectedValue(new Error('无法连接后端服务'))

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
      pagePath: '/draft-packing-compare',
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
