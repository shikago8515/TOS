import type { BrowserPluginInfo } from '../../types/electronApi'

export type BrowserPluginStatusTone = 'success' | 'danger'
export type BrowserPluginNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface BrowserPluginMetaItem {
  label: string
  value: string
}

export const browserPluginStageMessage =
  '业务验证中：此模块暂不按正式生产功能交付，建议记录可用场景、失败页面和操作步骤后再迭代。'

export const browserPluginNotes = [
  '插件资源随 TMS 集成工具一起打包，当前用于验证 Infornexus 页面自动搜索并添加。',
  '试用时请记录登录入口、目标页面、失败 ID 和复现步骤，便于后续修正。',
  '只有业务部确认流程稳定后，再升级为正式模块。',
] as const

export function getBrowserPluginStatusLabel(plugin: BrowserPluginInfo): string {
  if (plugin.previewOnly) {
    return '预览'
  }

  if (!plugin.available) {
    return '插件缺失'
  }

  return plugin.browserAvailable ? '可用' : '未找到浏览器'
}

export function getBrowserPluginStatusTone(plugin: BrowserPluginInfo): BrowserPluginStatusTone {
  if (plugin.previewOnly) {
    return 'danger'
  }

  return plugin.available && plugin.browserAvailable ? 'success' : 'danger'
}

export function buildBrowserPluginMeta(plugin: BrowserPluginInfo): BrowserPluginMetaItem[] {
  return [
    {
      label: '适用网页',
      value: plugin.provider || '业务网页',
    },
    {
      label: '插件类型',
      value: plugin.category || '-',
    },
    {
      label: '版本',
      value: plugin.version || '-',
    },
  ]
}
