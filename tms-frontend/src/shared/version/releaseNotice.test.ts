import { describe, expect, it } from 'vitest'

import { fallbackAppVersion } from './appVersion'
import releaseNotes from './releaseNotes.json'
import {
  buildReleaseNoticeGroups,
  buildReleaseNoticeState,
  markReleaseNoticeSeen,
  releaseNoticeSeenKeyStorageKey,
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
    expect(releaseNotes.added).toEqual([
      '新龙泰 Shipping 自动化新增账号档案管理，可保存多个 Infor Nexus 登录账号、按名称切换，并在下拉列表中删除账号记录。',
      'Jessica 对账核对支持可选上传 Packing List PDF，并在同一个结果 Excel 中追加箱单核对结果。',
    ])
    expect(releaseNotes.improved).toEqual([
      '设置页区分本机运行版本和服务器安装包版本，桌面端检查更新改为读取服务器安装包清单。',
      '完整安装包、轻量安装包和自动化助手安装包均按当前版本号重新打包，便于用户确认下载到最新版。',
      '保留原发票文件 + 参考表文件两表核对流程；上传 PDF 时额外核对发票号、日期、PO、Article、Style/Working No 和 QTY。',
    ])
    expect(releaseNotes.fixed).toEqual([
      '万代 Shipping 固定选择 Assign Equipment ID，新龙泰 Shipping 固定选择 Remove/Change Equipment ID。',
      '账号和密码中的 @@ 原样保存、回显和提交，不再被自动替换。',
      '自动化账号密码、模板和运行记录接口不再被全局版本检查拦截，Infor Nexus 登录失败和 Access Code 页面会给出中文弹窗提示。',
    ])
    expect(releaseNotes.showPopup).toBe(false)
    expect(releaseNotes.modules.map((module) => module.name)).toEqual([
      '新龙泰 / 万代 Shipping 自动化',
      '系统设置 / 安装包下载',
      'Jessica / 对账核对',
    ])
  })
})
