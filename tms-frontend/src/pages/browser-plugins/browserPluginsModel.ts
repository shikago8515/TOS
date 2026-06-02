import type { BrowserPluginInfo } from '../../types/electronApi'

export type BrowserPluginStatusTone = 'success' | 'warning' | 'danger'
export type BrowserPluginNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface BrowserPluginGuideItem {
  title: string
  description: string
}

export const browserPluginStageMessage =
  '当前页面用于验证业务浏览器插件是否具备真实试用条件，重点检查目标站点、浏览器环境、匹配规则以及失败后的回放记录。'

export const browserPluginJourney: BrowserPluginGuideItem[] = [
  {
    title: '锁定真实入口',
    description: '先确认插件绑定的业务站点、登录入口和需要覆盖的按钮或表格区域。',
  },
  {
    title: '读取业务数据',
    description: '根据试验需求读取 Excel 或页面上下文，把待处理 ID 与页面状态同步到插件流程。',
  },
  {
    title: '执行自动操作',
    description: '在真实业务页面完成搜索、勾选、添加等动作，并观察是否存在误选、漏选或权限阻塞。',
  },
  {
    title: '沉淀诊断样本',
    description: '记录失败页面、复现路径和浏览器环境，为后续迭代提供稳定的诊断样本。',
  },
]

export const browserPluginNotes = [
  '优先从业务部门日常使用的真实入口开始试用，不要只在理想化测试页里通过。',
  '建议同时保留失败截图、输入表格与页面 URL，方便后续快速复盘和修复。',
  '只有在目标流程和浏览器环境都稳定后，再把试验方案升级为正式模块交付。',
] as const

export function getBrowserPluginStatusLabel(plugin: BrowserPluginInfo): string {
  if (plugin.previewOnly) {
    return '预览配置'
  }

  if (!plugin.available) {
    return '插件缺失'
  }

  return plugin.browserAvailable ? '可执行' : '浏览器未就绪'
}

export function getBrowserPluginStatusTone(plugin: BrowserPluginInfo): BrowserPluginStatusTone {
  if (plugin.previewOnly) {
    return 'warning'
  }

  return plugin.available && plugin.browserAvailable ? 'success' : 'danger'
}
