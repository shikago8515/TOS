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
  directRunPath?: string
  requiresExcel?: boolean
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
    id: 'ticket-owner-statistics',
    title: '统计 ticket 归属 自动化',
    subtitle: 'SAP BTP Ticket 归属统计',
    description: '登录 SAP BTP 后从 Task Center 采集 ticket 信息，并生成 Ticket ownership Excel。',
    appId: 'microsoft-login-n8n-demo',
    executorBaseUrl: 'http://127.0.0.1:3002',
    localExecutorToken: 'local-ms-login-5f1d3d6d4bda4b2db7d54c8ce8c71e91',
    webhookUrl: 'http://127.0.0.1:5678/webhook/microsoft-login-excel-demo',
    directRunPath: '/api/run-ticket-owner-statistics',
    requiresExcel: false,
    routePath: '/web-automation/scenarios/ticket-owner-statistics',
    tags: ['SAP BTP', 'Ticket', 'Excel Export'],
    status: 'online',
  },
  {
    id: 'shipping-automation',
    title: '万代shipping 自动化',
    subtitle: 'Infor Nexus 万代运输业务自动化',
    description: '进入 https://network.infornexus.com，后续承接万代本地直连浏览器自动化链路。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/shipping-automation',
    tags: ['万代', 'Shipping', 'InforNexus'],
    status: 'online',
  },
  {
    id: 'xinlongtai-shipping-automation',
    title: '新龙泰-shipping 自动化',
    subtitle: 'Infor Nexus 运输业务自动化',
    description: '进入 https://network.infornexus.com，后续承接本地直连浏览器自动化链路。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/xinlongtai-shipping-automation',
    tags: ['Shipping', 'InforNexus'],
    status: 'online',
  },
  {
    id: 'tc-inv-automation',
    title: 'TC INV 自动化',
    subtitle: 'TC INV 出货明细与费用录入自动化',
    description: 'SLT、VENT、XO 工厂支持自动上传出货明细表，系统自动上传运费表，并同步录入货物交期、各项费用等信息。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/tc-inv-automation',
    tags: ['TC INV', 'SLT', 'VENT', 'XO'],
    status: 'online',
  },
  {
    id: 'shipping-automation-2',
    title: 'released Bulk 自动化',
    subtitle: 'Infor Nexus released Bulk 自动化流程',
    description: '先登录 Infor Nexus 并进入 released Bulk 场景，后续页面操作会继续在这个独立场景里扩展。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/shipping-automation-2',
    tags: ['released Bulk', 'InforNexus'],
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
    id: 'po-auto-download',
    title: 'Invoice 自动下载',
    subtitle: 'Excel Invoice 批量下载',
    description: '上传 Excel 后按 Invoice Number 发起请求下载，并保存到指定本机目录。',
    appId: 'shipping-automation-demo',
    executorBaseUrl: 'http://127.0.0.1:3003',
    localExecutorToken: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
    webhookUrl: 'https://network.infornexus.com',
    routePath: '/web-automation/scenarios/po-auto-download',
    tags: ['Invoice', 'Download', 'InforNexus'],
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
