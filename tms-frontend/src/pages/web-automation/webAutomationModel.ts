import type { AutomationAppInfo } from '../../types/electronApi'

export type AutomationAppStatusTone = 'success' | 'info' | 'danger'
export type WebAutomationNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface WebAutomationEntry {
  id: string
  title: string
  subtitle: string
  description: string
  appId: string
  executorBaseUrl: string
  localExecutorToken: string
  webhookUrl: string
  routePath: string
  tags: readonly string[]
  status: 'online' | 'soon' | 'offline'
}

export const webAutomationEntries: WebAutomationEntry[] = [
  {
    id: 'microsoft-login-n8n',
    title: 'Microsoft Login / SAP BTP',
    subtitle: 'SAP BTP 自动登录',
    description: '上传 Excel 后自动完成 Microsoft 登录与 SAP BTP 平台操作。',
    appId: 'microsoft-login-n8n-demo',
    executorBaseUrl: 'http://127.0.0.1:3002',
    localExecutorToken: 'local-ms-login-5f1d3d6d4bda4b2db7d54c8ce8c71e91',
    webhookUrl: 'http://127.0.0.1:5678/webhook/microsoft-login-excel-demo',
    routePath: '/web-automation/scenarios/microsoft-login-n8n',
    tags: ['Excel', 'n8n', 'Playwright'],
    status: 'online',
  },
  {
    id: 'shipping-automation',
    title: 'shipping自动化',
    subtitle: 'Infor Nexus 运输业务自动化',
    description: '进入 https://network.infornexus.com，后续承接本地直连浏览器自动化链路。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/shipping-automation',
    tags: ['Shipping', 'InforNexus'],
    status: 'online',
  },
  {
    id: 'shipping-automation-2',
    title: 'shipping 2 自动化',
    subtitle: 'Infor Nexus 登录与页面预备流程',
    description: '先登录 Infor Nexus 并进入站点，后续页面操作会继续在这个独立场景里扩展。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/shipping-automation-2',
    tags: ['Shipping 2', 'InforNexus'],
    status: 'online',
  },
  {
    id: 'infornexus-auto-add',
    title: 'Infornexus 自动搜索并添加',
    subtitle: 'Excel 第二列 ID 自动执行',
    description: '上传 Excel 后启动可视浏览器，读取第二列 10 位 ID 并在 Infor Nexus 自动搜索、勾选和添加。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/infornexus-auto-add',
    tags: ['Excel', 'Auto Add', 'InforNexus'],
    status: 'online',
  },
  {
    id: 'infornexus-sync',
    title: 'Infornexus 数据同步',
    subtitle: '跨平台数据自动同步',
    description: '定时抓取 Infornexus 数据并同步至本地，支持增量同步。',
    appId: 'infornexus-sync',
    executorBaseUrl: 'http://127.0.0.1:3004',
    localExecutorToken: '',
    webhookUrl: 'http://127.0.0.1:5678/webhook/infornexus-sync',
    routePath: '/web-automation/scenarios/infornexus-sync',
    tags: ['Infornexus', 'Sync'],
    status: 'soon',
  },
  {
    id: 'email-report-bot',
    title: '邮件报表机器人',
    subtitle: '自动抓取页面生成报表并发送',
    description: '自动生成汇总报表并通过邮件分发。',
    appId: 'email-report-bot',
    executorBaseUrl: 'http://127.0.0.1:3005',
    localExecutorToken: '',
    webhookUrl: 'http://127.0.0.1:5678/webhook/email-report',
    routePath: '/web-automation/scenarios/email-report-bot',
    tags: ['Email', 'Report'],
    status: 'offline',
  },
  {
    id: 'form-auto-fill',
    title: '智能表单填充',
    subtitle: 'AI 辅助表单识别与填写',
    description: '智能识别表单结构，匹配 Excel 列完成批量填充。',
    appId: 'form-auto-fill',
    executorBaseUrl: 'http://127.0.0.1:3006',
    localExecutorToken: '',
    webhookUrl: 'http://127.0.0.1:5678/webhook/form-fill',
    routePath: '/web-automation/scenarios/form-auto-fill',
    tags: ['AI', 'Form'],
    status: 'offline',
  },
]

export function getWebAutomationEntry(entryId: string): WebAutomationEntry | null {
  return webAutomationEntries.find((entry) => entry.id === entryId) ?? null
}

export function getAutomationAppStatusLabel(app: AutomationAppInfo): string {
  if (app.running) return '运行中'
  return app.available ? '可启动' : '缺失'
}

export function getAutomationAppStatusTone(app: AutomationAppInfo): AutomationAppStatusTone {
  if (app.running) return 'success'
  return app.available ? 'info' : 'danger'
}

export function selectInitialAutomationApp(apps: AutomationAppInfo[]): string {
  return apps.find((app) => app.running)?.id || apps[0]?.id || ''
}

export function getEntryStatusLabel(status: WebAutomationEntry['status']): string {
  if (status === 'online') return '可用'
  if (status === 'soon') return '即将上线'
  return '暂不可用'
}

export function getEntryStatusTone(status: WebAutomationEntry['status']): 'success' | 'warning' | 'danger' {
  if (status === 'online') return 'success'
  if (status === 'soon') return 'warning'
  return 'danger'
}
