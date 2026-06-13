import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestBackendJson } from '../../shared/api/backendClient'
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
      version: '0.9.8-beta.3.8',
      records: [
        {
          version: '0.9.8-beta.3.7',
          title: '旧记录',
        },
      ],
    })
  })
})
