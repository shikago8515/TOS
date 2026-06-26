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
      '新增自动化执行档案页面和各自动化页面的执行记录抽屉，可查看执行批次、结果文件、失败原因和归档下载。',
      '新增 Excel 模板中心，可集中维护每个自动化页面使用的模板文件并同步到页面下载入口。',
      '新增自动化模块热更新链路，小助手和桌面端可按服务器 manifest 自动下载、校验并缓存 Shipping、Invoice、TC INV 等自动化模块包。',
      '新增浏览器自动化模块边界规范，明确后续自动化按业务页面拆分模块，避免新流程继续堆进单个 server.mjs。',
    ])
    expect(releaseNotes.improved).toEqual([
      'TC INV 自动化支持按 Excel 中的 Invoice# 顺序批量循环处理，已处于 Preview 的发票会直接记录完成，查不到的发票会记录失败后继续下一张。',
      'TC INV 自动化缩短 Infor Nexus 页面稳定等待和 Invoice 查询无结果等待时间，并对登录页连接重置增加重试。',
      '自动化模块发布支持在服务器直接构建 zip 并上传 MinIO，后续修复可通过模块包下发，减少用户反复重装小助手。',
      'Excel 模板中心改为先勾选模板再操作，顶部只显示当前选中模板的下载、替换、保存和停用操作，减少误点和重复按钮。',
      '模板停用改为统一确认弹窗，支持取消 / 确认，不再使用浏览器原生确认框。',
      '浏览器自动化执行失败时会识别非 JSON 响应、执行器断开、浏览器会话关闭和 Desktop Utility 连接超时，前端改为展示可操作的中文提示。',
      '新龙泰 Shipping 账号档案改为新增 / 编辑弹窗管理，执行前要求选择已保存账号，减少误用临时账号。',
    ])
    expect(releaseNotes.fixed).toEqual([
      '修复 TC INV 自动化选择 ZADD / ZDOC 原因后 Adjustment Reason 弹窗反复停留，导致后续发票无法继续处理的问题。',
      '修复自动化执行记录接口在远程 MySQL 暂时不可用时返回底层异常的问题，改为返回可读的中文诊断提示。',
      '修复自动化页面下载 Excel 模板失败时直接跳转到后端错误页的问题，改为停留当前页面并弹窗提示模板未配置、MinIO 文件缺失或存储连接异常。',
      '修复统计 ticket 归属自动化在 Microsoft 执行器未返回版本字段时误报小助手版本无法识别的问题，会使用本机小助手启动器版本兜底判断。',
      '修复自动化模块热更新时已运行的旧执行器被复用，导致 ticket 归属统计接口返回 Not found 且小助手版本无法识别的问题。',
      '修复自动化接口返回 HTML、空响应或执行器退出时只暴露 JSON.parse / 网络错误的问题。',
      '修复 Infor Nexus Pack-Scan-Ship 未连接 Desktop Utility 时 Shipment Scan 等待超时提示不清晰的问题。',
    ])
    expect(releaseNotes.showPopup).toBe(false)
    expect(releaseNotes.modules.map((module) => module.name)).toEqual([
      '自动化执行档案 / 模板中心',
      'TC INV 自动化',
      '浏览器自动化 / Excel 模板下载',
      '自动化助手 / 模块热更新',
      '网页自动化 / 本机执行器',
      'Infor Nexus Shipping 自动化',
      '工程规范',
    ])
  })
})
