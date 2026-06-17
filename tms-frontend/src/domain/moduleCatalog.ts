export type TosModuleStage = 'production' | 'validation' | 'placeholder'

export type TosModuleCategory =
  | 'reconciliation'
  | 'excel'
  | 'browser-automation'
  | 'pdf'
  | 'web-collector'
  | 'system'

export type TosModuleGroup =
  | 'home'
  | 'jessica'
  | 'sophia'
  | 'jane'
  | 'eric'
  | 'jason'
  | 'finance-excel'
  | 'pdf-data-compare'
  | 'general-tools'

export interface TosModuleDefinition {
  id: string
  path: string
  routeName: string
  title: string
  titleEn: string
  navLabel: string
  navLabelEn: string
  group: TosModuleGroup
  category: TosModuleCategory
  navParentId?: string
  stage: TosModuleStage
  description: string
  descriptionEn: string
  order: number
}

export interface TosNavGroupDefinition {
  id: TosModuleGroup
  label: string
  labelEn: string
}

export interface TosNavParentDefinition {
  id: string
  label: string
  labelEn: string
  group: TosModuleGroup
  order: number
}

export const tosNavGroups = [
  { id: 'home', label: '首页', labelEn: 'Home' },
  { id: 'jessica', label: 'Jessica', labelEn: 'Jessica' },
  { id: 'sophia', label: 'Sophia', labelEn: 'Sophia' },
  { id: 'jane', label: 'Jane', labelEn: 'Jane' },
  { id: 'eric', label: 'Eric', labelEn: 'Eric' },
  { id: 'jason', label: 'Jason', labelEn: 'Jason' },
  { id: 'finance-excel', label: 'Lucia', labelEn: 'Lucia' },
  { id: 'pdf-data-compare', label: 'PDF数据获取核对', labelEn: 'PDF Data Compare' },
  { id: 'general-tools', label: '通用工具', labelEn: 'General Tools' },
] as const satisfies readonly TosNavGroupDefinition[]

export const tosModuleCategoryLabels: Record<TosModuleCategory, { label: string; labelEn: string }> = {
  reconciliation: { label: '对账核对', labelEn: 'Reconciliation' },
  excel: { label: 'Excel 处理', labelEn: 'Excel Processing' },
  'browser-automation': { label: '浏览器自动化', labelEn: 'Browser Automation' },
  pdf: { label: 'PDF / 单据处理', labelEn: 'PDF / Document Processing' },
  'web-collector': { label: '网页数据爬取', labelEn: 'Web Data Collection' },
  system: { label: '系统', labelEn: 'System' },
}

export const tosNavParents: TosNavParentDefinition[] = []

export const tosModuleStageLabels: Record<TosModuleStage, string> = {
  production: '正式模块',
  validation: '测试阶段',
  placeholder: '开发中',
}

export const tosModuleStageLabelsEn: Record<TosModuleStage, string> = {
  production: 'Production',
  validation: 'Validation',
  placeholder: 'In development',
}

export const tosModules = [
  {
    id: 'home',
    path: '/',
    routeName: 'home',
    title: '首页',
    titleEn: 'Home',
    navLabel: '首页',
    navLabelEn: 'Home',
    group: 'home',
    category: 'excel',
    stage: 'production',
    description: 'TOS 运营看板与快捷入口',
    descriptionEn: 'TOS operations dashboard and shortcuts',
    order: 10,
  },
  {
    id: 'jessca',
    path: '/jessca',
    routeName: 'jessca',
    title: 'Jessica / 对账核对',
    titleEn: 'Jessica / Reconciliation',
    navLabel: '对账核对',
    navLabelEn: 'Reconciliation',
    group: 'jessica',
    category: 'reconciliation',
    stage: 'production',
    description: 'Jessca 发票价格核对与差异整理',
    descriptionEn: 'Jessca invoice price checking and discrepancy cleanup',
    order: 20,
  },
  {
    id: 'sophia-tina',
    path: '/sophia-tina',
    routeName: 'sophia-tina',
    title: 'Sophia / 报表合并',
    titleEn: 'Sophia / Report Merge',
    navLabel: '报表合并',
    navLabelEn: 'Report Merge',
    group: 'sophia',
    category: 'excel',
    stage: 'production',
    description: 'Sophia & Tina 多源 Excel 汇总',
    descriptionEn: 'Sophia & Tina multi-source Excel summary',
    order: 30,
  },
  {
    id: 'jane',
    path: '/jane',
    routeName: 'jane',
    title: 'Jane / 成品表生成',
    titleEn: 'Jane / Finished Goods Sheet',
    navLabel: '成品表生成',
    navLabelEn: 'Finished Goods Sheet',
    group: 'jane',
    category: 'excel',
    stage: 'production',
    description: 'Jane 成品表模板自动填充',
    descriptionEn: 'Jane finished goods template auto-fill',
    order: 40,
  },
  {
    id: 'jane-bom-summary',
    path: '/jane-bom-summary',
    routeName: 'jane-bom-summary',
    title: 'Jane / BOM 汇总',
    titleEn: 'Jane / BOM Summary',
    navLabel: 'BOM 汇总',
    navLabelEn: 'BOM Summary',
    group: 'jane',
    category: 'excel',
    stage: 'production',
    description: 'BOM 文件按 Pack 映射生成 MAIN COMPONENT 汇总',
    descriptionEn: 'Generate MAIN COMPONENT summaries from BOM files and Pack mappings',
    order: 45,
  },
  {
    id: 'jane-bom-compare',
    path: '/jane-bom-compare',
    routeName: 'jane-bom-compare',
    title: 'Jane / BOM 核对',
    titleEn: 'Jane / BOM Compare',
    navLabel: 'BOM 核对',
    navLabelEn: 'BOM Compare',
    group: 'jane',
    category: 'excel',
    stage: 'production',
    description: 'T1 PRODUCTION 与 BOM汇总 面料核对并标红差异',
    descriptionEn: 'Compare T1 PRODUCTION with BOM summary materials and mark differences',
    order: 46,
  },
  {
    id: 'jane-outbound-compare',
    path: '/jane-outbound-compare',
    routeName: 'jane-outbound-compare',
    title: 'Jane / OUTBOUND 核对',
    titleEn: 'Jane / OUTBOUND Compare',
    navLabel: 'OUTBOUND 核对',
    navLabelEn: 'OUTBOUND Compare',
    group: 'jane',
    category: 'excel',
    stage: 'production',
    description: 'T1 OUTBOUND 与 Copy of TMS 核对并标红差异',
    descriptionEn: 'Compare T1 OUTBOUND with Copy of TMS and mark differences',
    order: 47,
  },
  {
    id: 'eric',
    path: '/eric',
    routeName: 'eric',
    title: 'Eric / 数据处理',
    titleEn: 'Eric / Data Processing',
    navLabel: '数据处理',
    navLabelEn: 'Data Processing',
    group: 'eric',
    category: 'excel',
    stage: 'validation',
    description: '测试阶段：Excel数据处理整合',
    descriptionEn: 'Validation: integrated Excel data processing',
    order: 50,
  },
  {
    id: 'jason-pdf-reorder',
    path: '/jason/pdf-reorder',
    routeName: 'jason-pdf-reorder',
    title: 'Jason / 发票 PDF 重排序',
    titleEn: 'Jason / Invoice PDF Reorder',
    navLabel: '发票 PDF 重排序',
    navLabelEn: 'Invoice PDF Reorder',
    group: 'jason',
    category: 'pdf',
    stage: 'production',
    description: '按发票 PO 顺序重排 PO PDF，并生成汇总页',
    descriptionEn: 'Reorder PO PDF by invoice PO sequence and generate a summary page',
    order: 55,
  },
  {
    id: 'po-auto-download',
    path: '/web-automation/scenarios/po-auto-download',
    routeName: 'web-automation-scenario-po-auto-download',
    title: 'Jason / PO 自动下载',
    titleEn: 'Jason / PO Auto Download',
    navLabel: 'PO 自动下载',
    navLabelEn: 'PO Auto Download',
    group: 'jason',
    category: 'browser-automation',
    stage: 'production',
    description: '按 Excel 中的 Invoice Number 请求下载 Invoice PDF 到本机目录',
    descriptionEn: 'Request and download Invoice PDFs by Invoice Number from Excel',
    order: 56,
  },
  {
    id: 'draft-packing-compare',
    path: '/draft-packing-compare',
    routeName: 'draft-packing-compare',
    title: 'Draft & Packing List 核对',
    titleEn: 'Draft & Packing List Compare',
    navLabel: 'Draft & Packing List 核对',
    navLabelEn: 'Draft & Packing Compare',
    group: 'jessica',
    category: 'reconciliation',
    stage: 'validation',
    description: '提取 Draft Form E 与 Packing List PDF 字段并生成上下对比 Excel',
    descriptionEn: 'Extract and compare Draft Form E and Packing List PDF fields',
    order: 21,
  },
  {
    id: 'tms-finance-internal-reconciliation',
    path: '/tms-finance-internal-reconciliation',
    routeName: 'tms-finance-internal-reconciliation',
    title: '内销对账表数据提取',
    titleEn: 'Internal Reconciliation Data Extraction',
    navLabel: '内销对账表数据提取',
    navLabelEn: 'Internal Reconciliation',
    group: 'finance-excel',
    category: 'excel',
    stage: 'validation',
    description: '从 Sample/Bulk 来源文件向内销对账大表追加缺失行',
    descriptionEn: 'Append missing internal reconciliation rows from Sample/Bulk source files',
    order: 56,
  },
  {
    id: 'tms-finance-work-sales',
    path: '/tms-finance-work-sales',
    routeName: 'tms-finance-work-sales',
    title: 'Work Sales 数据追加',
    titleEn: 'Work Sales Data Append',
    navLabel: 'Work Sales 数据追加',
    navLabelEn: 'Work Sales Append',
    group: 'finance-excel',
    category: 'excel',
    stage: 'validation',
    description: '从 BULK Sales 导出表追加到 TURNOVER 的 Turnover Details',
    descriptionEn: 'Append BULK Sales export rows to TURNOVER Turnover Details',
    order: 57,
  },
  {
    id: 'browser-plugins',
    path: '/browser-plugins',
    routeName: 'browser-plugins',
    title: '浏览器插件',
    titleEn: 'Browser Plugins',
    navLabel: '浏览器插件',
    navLabelEn: 'Browser Plugins',
    group: 'general-tools',
    category: 'browser-automation',
    stage: 'validation',
    description: '测试阶段：业务网页插件验证',
    descriptionEn: 'Validation: business web plugin checks',
    order: 60,
  },
  {
    id: 'web-automation',
    path: '/web-automation',
    routeName: 'web-automation',
    title: '网页自动化',
    titleEn: 'Web Automation',
    navLabel: '网页自动化',
    navLabelEn: 'Web Automation',
    group: 'general-tools',
    category: 'browser-automation',
    stage: 'validation',
    description: '测试阶段：本地浏览器自动化场景入口',
    descriptionEn: 'Validation: local browser automation scenario hub',
    order: 70,
  },
  {
    id: 'infornexus',
    path: '/infornexus',
    routeName: 'infornexus',
    title: 'Infornexus',
    titleEn: 'Infornexus',
    navLabel: 'Infornexus',
    navLabelEn: 'Infornexus',
    group: 'general-tools',
    category: 'browser-automation',
    stage: 'validation',
    description: '以外部整包方式启动 Infornexus Electron 子应用',
    descriptionEn: 'Launch the packaged Infornexus Electron sub-application',
    order: 75,
  },
  {
    id: 'jane-sap',
    path: '/jane-sap',
    routeName: 'jane-sap',
    title: 'Jane / SAP',
    titleEn: 'Jane / SAP',
    navLabel: 'SAP',
    navLabelEn: 'SAP',
    group: 'jane',
    category: 'browser-automation',
    stage: 'production',
    description: 'SAP 自动化流程',
    descriptionEn: 'SAP automation workflow',
    order: 48,
  },
  {
    id: 'eric-infornexus',
    path: '/eric-infornexus',
    routeName: 'eric-infornexus',
    title: 'Eric / Infornexus',
    titleEn: 'Eric / Infornexus',
    navLabel: 'Infornexus',
    navLabelEn: 'Infornexus',
    group: 'eric',
    category: 'browser-automation',
    stage: 'production',
    description: 'Infornexus 自动化流程',
    descriptionEn: 'Infornexus automation workflow',
    order: 55,
  },
  {
    id: 'adidas-materials',
    path: '/adidas-materials',
    routeName: 'adidas-materials',
    title: 'adidas 材料',
    titleEn: 'adidas Materials',
    navLabel: 'adidas 材料',
    navLabelEn: 'adidas Materials',
    group: 'general-tools',
    category: 'web-collector',
    stage: 'production',
    description: 'ACP Materials 数据采集',
    descriptionEn: 'ACP Materials data collection',
    order: 80,
  },
  {
    id: 'settings',
    path: '/settings',
    routeName: 'settings',
    title: '系统设置',
    titleEn: 'Settings',
    navLabel: '系统设置',
    navLabelEn: 'Settings',
    group: 'general-tools',
    category: 'system',
    stage: 'production',
    description: '查看版本信息、运行环境和界面语言',
    descriptionEn: 'View version information, run mode, and language settings',
    order: 110,
  },
] as const satisfies readonly TosModuleDefinition[]

export type TosModuleId = (typeof tosModules)[number]['id']

export const routeRedirects = [
  { from: '/it-invoice-pdf-reorder', to: '/jason/pdf-reorder' },
] as const

export function getModulesByGroup(group: TosModuleGroup): TosModuleDefinition[] {
  return tosModules
    .filter((module) => module.group === group)
    .sort((left, right) => left.order - right.order)
}

export function getNavParentsByGroup(group: TosModuleGroup): TosNavParentDefinition[] {
  return tosNavParents
    .filter((parent) => parent.group === group)
    .sort((left, right) => left.order - right.order)
}

export function getModuleById(id: TosModuleId): TosModuleDefinition {
  const module = tosModules.find((entry) => entry.id === id)

  if (!module) {
    throw new Error(`Unknown TOS module id: ${id}`)
  }

  return module
}

export function getLocalizedModuleTitle(
  module: TosModuleDefinition,
  language: 'zh-CN' | 'en-US',
): string {
  return language === 'en-US' ? module.titleEn : module.title
}
