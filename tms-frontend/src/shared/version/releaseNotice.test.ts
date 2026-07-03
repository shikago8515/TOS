import { describe, expect, it } from 'vitest'

import { fallbackAppVersion } from './appVersion'
import releaseNotes from './releaseNotes.json'
import {
  buildReleaseNoticeGroups,
  buildReleaseNoticeState,
  buildReleaseNoticeStateFromServerOrStorage,
  markReleaseNoticeSeen,
  releaseNoticeSeenKeyStorageKey,
  releaseNoticeStorageKey,
  type LatestReleaseAnnouncementResponse,
  type ReleaseNotes,
  type StorageLike,
} from './releaseNotice'

class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const currentVersion = fallbackAppVersion

function createNotes(overrides: Partial<ReleaseNotes> = {}): ReleaseNotes {
  return {
    version: currentVersion,
    added: ['TMS 财务追加结果统计，显示追加行、重复跳过、相似已追加、Sales/Purchase 追加数量。'],
    improved: ['Work Sales 调整为 BULK Sales 导出表 + TURNOVER 目标表的追加流程。'],
    fixed: ['修复 TMS 财务追加时重复识别、格式复制、公式平移和小计范围更新不稳定的问题。'],
    ...overrides,
  }
}

describe('releaseNotice', () => {
  it('shows the current release notes when the version has not been seen', () => {
    const state = buildReleaseNoticeState({
      currentVersion,
      releaseNotes: createNotes(),
      seenVersion: null,
    })

    expect(state.visible).toBe(true)
    expect(state.releaseNotes?.version).toBe(currentVersion)
  })

  it('does not show again after the current version is marked as seen', () => {
    const storage = new MemoryStorage()
    markReleaseNoticeSeen(storage, currentVersion)

    expect(storage.getItem(releaseNoticeStorageKey)).toBe(currentVersion)
    expect(
      buildReleaseNoticeState({
        currentVersion,
        releaseNotes: createNotes(),
        seenVersion: storage.getItem(releaseNoticeStorageKey),
      }).visible,
    ).toBe(false)
  })

  it('shows again when the stored seen version is older than the current version', () => {
    const state = buildReleaseNoticeState({
      currentVersion,
      releaseNotes: createNotes(),
      seenVersion: '0.9.8-beta.3.0',
    })

    expect(state.visible).toBe(true)
  })

  it('does not show when release notes are empty', () => {
    const state = buildReleaseNoticeState({
      currentVersion,
      releaseNotes: createNotes({ added: [], improved: [], fixed: [] }),
      seenVersion: null,
    })

    expect(state.visible).toBe(false)
  })

  it('does not show when the current release notes disable popup display', () => {
    const state = buildReleaseNoticeState({
      currentVersion,
      releaseNotes: createNotes({ showPopup: false }),
      seenNoticeKey: null,
      seenVersion: null,
    })

    expect(state.visible).toBe(false)
    expect(state.releaseNotes).toBeNull()
  })

  it('uses noticeId instead of version as the seen key for batched popups', () => {
    const storage = new MemoryStorage()
    const releaseNotes = createNotes({
      noticeId: '2026-06-18-batch',
      showPopup: true,
    })

    const firstState = buildReleaseNoticeState({
      currentVersion,
      releaseNotes,
      seenNoticeKey: null,
      seenVersion: currentVersion,
    })
    expect(firstState.visible).toBe(true)

    markReleaseNoticeSeen(storage, currentVersion, releaseNotes)
    expect(storage.getItem(releaseNoticeSeenKeyStorageKey)).toBe('2026-06-18-batch')
    expect(storage.getItem(releaseNoticeStorageKey)).toBe(currentVersion)

    const secondState = buildReleaseNoticeState({
      currentVersion: '0.9.8-beta.3.99',
      releaseNotes: { ...releaseNotes, version: '0.9.8-beta.3.99' },
      seenNoticeKey: storage.getItem(releaseNoticeSeenKeyStorageKey),
      seenVersion: storage.getItem(releaseNoticeStorageKey),
    })
    expect(secondState.visible).toBe(false)
  })

  it('prefers the latest server release announcement over bundled notes', async () => {
    const storage = new MemoryStorage()
    const state = await buildReleaseNoticeStateFromServerOrStorage({
      storage,
      fallbackReleaseNotes: createNotes({ noticeId: 'local-notice' }),
      fetchLatestAnnouncement: async (): Promise<LatestReleaseAnnouncementResponse> => ({
        ok: true,
        version: currentVersion,
        announcement: {
          noticeId: 'server-notice',
          version: currentVersion,
          releaseDate: '2026-06-29',
          showPopup: true,
          level: 'feature',
          title: 'Server announcement',
          groups: [
            { title: 'Server', icon: 'sparkles', items: ['server driven popup'] },
          ],
        },
      }),
    })

    expect(state.visible).toBe(true)
    expect(state.releaseNotes?.noticeId).toBe('server-notice')
    expect(buildReleaseNoticeGroups(state.releaseNotes as ReleaseNotes)).toEqual([
      { key: 'announcement-0', title: 'Server', icon: 'sparkles', items: ['server driven popup'] },
    ])
  })

  it('does not show the same server noticeId twice', async () => {
    const storage = new MemoryStorage()
    storage.setItem(releaseNoticeSeenKeyStorageKey, 'server-notice')

    const state = await buildReleaseNoticeStateFromServerOrStorage({
      storage,
      fetchLatestAnnouncement: async (): Promise<LatestReleaseAnnouncementResponse> => ({
        ok: true,
        announcement: {
          noticeId: 'server-notice',
          version: currentVersion,
          releaseDate: '2026-06-29',
          showPopup: true,
          level: 'feature',
          title: 'Server announcement',
          groups: [
            { title: 'Server', icon: 'sparkles', items: ['server driven popup'] },
          ],
        },
      }),
    })

    expect(state.visible).toBe(false)
    expect(state.releaseNotes).toBeNull()
  })

  it('does not fall back to bundled notes when the server returns no announcement', async () => {
    const state = await buildReleaseNoticeStateFromServerOrStorage({
      storage: new MemoryStorage(),
      fallbackReleaseNotes: createNotes({ noticeId: 'local-notice', showPopup: true }),
      fetchLatestAnnouncement: async (): Promise<LatestReleaseAnnouncementResponse> => ({
        ok: true,
        announcement: null,
      }),
    })

    expect(state.visible).toBe(false)
    expect(state.releaseNotes).toBeNull()
  })

  it('falls back to bundled release notes when the server announcement request fails', async () => {
    const state = await buildReleaseNoticeStateFromServerOrStorage({
      storage: new MemoryStorage(),
      fallbackReleaseNotes: createNotes({ noticeId: 'local-fallback', showPopup: true }),
      fetchLatestAnnouncement: async (): Promise<LatestReleaseAnnouncementResponse> => {
        throw new Error('network unavailable')
      },
    })

    expect(state.visible).toBe(true)
    expect(state.releaseNotes?.noticeId).toBe('local-fallback')
  })

  it('builds release notice groups by module when module notes exist', () => {
    const groups = buildReleaseNoticeGroups(createNotes({
      modules: [
        {
          name: 'iPlex 双表核对',
          fixed: ['总计行不再写公式。'],
        },
        {
          name: 'Work Sales',
          improved: ['合并导出流程。'],
        },
      ],
    }))

    expect(groups).toEqual([
      {
        key: 'module-0',
        title: 'iPlex 双表核对',
        icon: 'sparkles',
        items: ['修复：总计行不再写公式。'],
      },
      {
        key: 'module-1',
        title: 'Work Sales',
        icon: 'sparkles',
        items: ['优化：合并导出流程。'],
      },
    ])
  })

  it('does not show when release notes are not for the current version', () => {
    const state = buildReleaseNoticeState({
      currentVersion,
      releaseNotes: createNotes({ version: '0.9.8-beta.3.0' }),
      seenVersion: null,
    })

    expect(state.visible).toBe(false)
  })

  it('keeps bundled release notes synchronized with the fallback app version', () => {
    expect(releaseNotes.version).toBe(fallbackAppVersion)
  })

  it('keeps bundled release notes scoped to the current version changes', () => {
    const bundledReleaseNotes = releaseNotes as ReleaseNotes

    expect(bundledReleaseNotes.version).toBe(currentVersion)
    expect(typeof bundledReleaseNotes.showPopup).toBe('boolean')
    const bundledReleaseNoteItems = [
      ...bundledReleaseNotes.added,
      ...bundledReleaseNotes.improved,
      ...bundledReleaseNotes.fixed,
    ]
    expect(bundledReleaseNoteItems.length).toBeGreaterThan(0)
    for (const module of bundledReleaseNotes.modules ?? []) {
      expect(module.name).toBeTruthy()
      expect([
        ...(module.added || []),
        ...(module.improved || []),
        ...(module.fixed || []),
      ].length).toBeGreaterThan(0)
    }
  })

})
