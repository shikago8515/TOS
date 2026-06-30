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
    expect(releaseNotes.added).toEqual([
      '新增小助手启动后的自动化模块静默全量预更新：后台检查服务器 manifest，下载、校验并缓存新版模块包。',
      '新增自动下载箱单按 NO 批次处理和浏览器内进度浮层，支持从 Excel PO 批次中命中首个可下载箱单。',
      '新增 Koi 风格后台工作台能力：Pinia 全局状态、顶部标签页缓存、keep-alive 页面缓存、右键标签操作和路由顶部加载进度条。',
      '新增 Element Plus 全局组件体系，后续系统页面统一使用 Element Plus 表单、按钮、弹窗、抽屉、标签和图标控件。',
      '新增完整中英文语言切换链路，菜单、面包屑、顶部搜索、标签页标题、设置页和 Element Plus 内置文案会同步切换。',
      '新增 Packing List 自动下载页面和本机自动化模块入口，支持按独立业务模块发布与调用。',
      '新增统计 ticket 归属自动化的 Excel 查询辅助能力，支持在本地执行器中读取 Excel 映射数据。',
      '新增自动化执行档案页面和各自动化页面的执行记录抽屉，可查看执行批次、结果文件、失败原因和归档下载。',
      '新增 Excel 模板中心，可集中维护每个自动化页面使用的模板文件并同步到页面下载入口。',
      '新增自动化模块热更新链路，小助手和桌面端可按服务器 manifest 自动下载、校验并缓存 Shipping、Invoice、TC INV 等自动化模块包。',
      '新增浏览器自动化模块边界规范，明确后续自动化按业务页面拆分模块，避免新流程继续堆进单个 server.mjs。',
    ])
    expect(releaseNotes.improved).toEqual([
      '自动化运行前会兜底刷新模块；执行器忙碌时不打断当前任务，任务结束或业务进程停止后自动切到新版。',
      '系统设置页会正确读取服务器安装包 manifest 的下载路径，桌面端和小助手更新入口保持一致。',
      '小助手 health 会返回 appId 和模块版本，Microsoft / SAP 与 Infor Nexus 执行器都能被启动器准确识别。',
      '自动下载箱单改为复用 Infor Nexus 登录态请求详情页和 PDF，下载文件按 Packing list + NO 批次号保存，并在执行结果中返回本机 PDF 路径。',
      '系统设置页重构为 Koi 风格下载与更新工作台，包含当前版本、下载中心、更新管理、运行参数和安装包版本信息，并适配子页面满屏布局。',
      '暗黑 / 白色模式改为全局主题状态，layout 子页面、自动化页面、设置页和 Element Plus 控件会同步应用暗黑色变量。',
      '路由名和路由组件名统一，配合标签页缓存保证页面切换后可按业务路由稳定复用。',
      '系统设置页的浏览器模式检查更新会刷新运行参数和服务器安装包信息，桌面模式仍调用桌面更新桥接能力。',
      '系统设置页支持导出运行参数 JSON，便于排查服务器版本、安装包版本、运行模式和更新状态。',
      '多处自动化子页面逐步替换为 Element Plus 控件，保留原有页面布局同时统一按钮、弹窗和表单交互。',
      'TC INV 自动化支持按 Excel 中的 Invoice# 顺序批量循环处理，已处于 Preview 的发票会直接记录完成，查不到的发票会记录失败后继续下一张。',
      'TC INV 自动化缩短 Infor Nexus 页面稳定等待和 Invoice 查询无结果等待时间，并对登录页连接重置增加重试。',
      '自动化模块发布支持在服务器直接构建 zip 并上传 MinIO，后续修复可通过模块包下发，减少用户反复重装小助手。',
      'Excel 模板中心改为先勾选模板再操作，顶部只显示当前选中模板的下载、替换、保存和停用操作，减少误点和重复按钮。',
      '模板停用改为统一确认弹窗，支持取消 / 确认，不再使用浏览器原生确认框。',
      '浏览器自动化执行失败时会识别非 JSON 响应、执行器断开、浏览器会话关闭和 Desktop Utility 连接超时，前端改为展示可操作的中文提示。',
      '新龙泰 Shipping 账号档案改为新增 / 编辑弹窗管理，执行前要求选择已保存账号，减少误用临时账号。',
    ])
    expect(releaseNotes.fixed).toEqual([
      '修复小助手安装包下载路径未加服务器前缀，导致设置页获取安装包 manifest 后下载失败的问题。',
      '修复安装包下载接口缺少 /tos/desktop-api 前缀导致 404 的问题。',
      '修复自动化模块热更新时已运行的旧执行器被复用，导致接口 Not found 或版本识别错误的问题。',
      '修复自动下载箱单搜索空结果、详情页跳转卡顿、PDF 保存后路径不回传和查询页重复闪烁的问题。',
      '修复暗黑模式只影响顶部壳层、未覆盖 layout 子页面和部分自动化页面的问题。',
      '修复语言切换只更新顶部入口、首页和部分子页面缺少语言映射的问题。',
      '修复设置页版本区域字号过大、下载卡片图片和按钮位置未对齐、小助手按钮上下不齐的问题。',
      '修复设置页浏览器模式点击检查更新没有真实刷新反馈的问题。',
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
      '后台工作台 / 主题语言',
      '系统设置',
      'Packing List 自动下载',
      '统计 ticket 归属自动化',
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
