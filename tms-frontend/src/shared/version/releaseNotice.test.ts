import { describe, expect, it } from 'vitest'

import { fallbackAppVersion } from './appVersion'
import releaseNotes from './releaseNotes.json'
import {
  buildReleaseNoticeState,
  markReleaseNoticeSeen,
  releaseNoticeStorageKey,
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
    expect(releaseNotes.added).toEqual([])
    expect(releaseNotes.improved).toEqual([
      '版本更新记录页本地 fallback 支持展示内置历史版本记录。',
    ])
    expect(releaseNotes.fixed).toEqual([
      '修复 Draft & Packing List 核对结果中 Goods Description 误带入 PDF 免责声明和页码的问题。',
      '修复版本更新记录页在浏览器模式且后端未启动时显示 Failed to fetch 的问题，改为展示本地版本说明。',
    ])
  })
})
