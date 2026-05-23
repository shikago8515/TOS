import type { AutomationAppInfo } from '../../types/electronApi'

export type AutomationAppStatusTone = 'success' | 'info' | 'danger'
export type WebAutomationNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface AutomationAppMetaItem {
  label: string
  value: string
}

export const webAutomationStageMessage =
  '业务验证中：控制台流程、页面适配和登录态稳定性仍需试用确认，建议把失败截图和操作步骤一起反馈。'

export const webAutomationNotes = [
  '控制台用于从 Excel 读取业务数据，再驱动 Edge/Chrome 执行网页流程。',
  '启动后会在右侧嵌入控制台，也可以外部打开进行调试。',
  '正式上线前需要逐个业务流程确认登录态、页面选择器和失败恢复策略。',
] as const

export function getAutomationAppStatusLabel(app: AutomationAppInfo): string {
  if (app.running) {
    return '运行中'
  }

  return app.available ? '未启动' : '缺失'
}

export function getAutomationAppStatusTone(app: AutomationAppInfo): AutomationAppStatusTone {
  if (app.running) {
    return 'success'
  }

  return app.available ? 'info' : 'danger'
}

export function buildAutomationAppMeta(app: AutomationAppInfo): AutomationAppMetaItem[] {
  return [
    {
      label: '供应方',
      value: app.provider || 'Playwright',
    },
    {
      label: '类型',
      value: app.category || '网页自动化',
    },
    {
      label: '版本',
      value: app.version || '-',
    },
    {
      label: '端口',
      value: app.port ? String(app.port) : '-',
    },
  ]
}

export function selectInitialAutomationApp(apps: AutomationAppInfo[]): string {
  return apps.find((app) => app.running)?.id || apps[0]?.id || ''
}
