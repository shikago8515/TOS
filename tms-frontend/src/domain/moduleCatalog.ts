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
  category?: TosModuleCategory
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
  reconciliation: { label: 'Excel处理', labelEn: 'Excel Processing' },
  excel: { label: 'Excel 处理', labelEn: 'Excel Processing' },
  'browser-automation': { label: '浏览器自动化', labelEn: 'Browser Automation' },
  pdf: { label: 'PDF / 单据处理', labelEn: 'PDF / Document Processing' },
  'web-collector': { label: '网页数据爬取', labelEn: 'Web Data Collection' },
  system: { label: '系统', labelEn: 'System' },
}

export const tosNavParents: TosNavParentDefinition[] = [
  {
    id: 'jessica-infornexus-automation',
    label: 'Infornexus自动化',
    labelEn: 'Infornexus Automation',
    group: 'jessica',
    category: 'browser-automation',
    order: 22,
  },
  {
    id: 'jessica-packing-list-auto-download',
    label: 'Packing list 自动下载',
    labelEn: 'Packing List Auto Download',
    group: 'jessica',
    category: 'browser-automation',
    order: 25,
  },
]

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
    title: 'Invoice 核对',
    titleEn: 'Invoice Compare',
    navLabel: 'Invoice 核对',
    navLabelEn: 'Invoice Compare',
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
    title: 'Jane / PRODUCTION 核对',
    titleEn: 'Jane / PRODUCTION Compare',
    navLabel: 'PRODUCTION 核对',
    navLabelEn: 'PRODUCTION Compare',
    group: 'jane',
    category: 'excel',
    stage: 'production',
    description: 'T1 PRODUCTION 与 BOM汇总 核对材料多缺、一致性和料率',
    descriptionEn: 'Compare T1 PRODUCTION with BOM summary for materials, consistency, and rates',
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
    title: '数据处理',
    titleEn: 'Data Processing',
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
    id: 'jason-result-set-excel',
    path: '/jason/result-set-excel',
    routeName: 'jason-result-set-excel',
    title: 'Jason / Result Set Excel',
    titleEn: 'Jason / Result Set Excel',
    navLabel: 'Result Set Excel',
    navLabelEn: 'Result Set Excel',
    group: 'jason',
    category: 'excel',
    stage: 'validation',
    description: '上传 To ERIC Result Set，生成 test 目标表',
    descriptionEn: 'Generate the test target workbook from a To ERIC Result Set export',
    order: 56,
  },
  {
    id: 'draft-packing-compare',
    path: '/draft-packing-compare',
    routeName: 'draft-packing-compare',
    title: '产地证核对',
    titleEn: 'Certificate of Origin Compare',
    navLabel: '产地证核对',
    navLabelEn: 'Certificate of Origin Compare',
    group: 'jessica',
    category: 'reconciliation',
    stage: 'validation',
    description: '提取产地证与 Packing List PDF 字段并生成上下对比 Excel',
    descriptionEn: 'Extract and compare Certificate of Origin and Packing List PDF fields',
    order: 21,
  },
  {
    id: 'shipping-automation',
    path: '/web-automation/scenarios/shipping-automation',
    routeName: 'web-automation-scenario-shipping-automation',
    title: 'Jessica / VENT',
    titleEn: 'Jessica / VENT',
    navLabel: 'VENT',
    navLabelEn: 'VENT',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-infornexus-automation',
    stage: 'production',
    description: '进入 Infor Nexus 后承接 VENT 本地直连浏览器自动化链路',
    descriptionEn: 'Open Infor Nexus and run the VENT local browser automation flow',
    order: 22,
  },
  {
    id: 'xinlongtai-shipping-automation',
    path: '/web-automation/scenarios/xinlongtai-shipping-automation',
    routeName: 'web-automation-scenario-xinlongtai-shipping-automation',
    title: 'Jessica / YUEN TAI+XO',
    titleEn: 'Jessica / YUEN TAI+XO',
    navLabel: 'YUEN TAI+XO',
    navLabelEn: 'YUEN TAI+XO',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-infornexus-automation',
    stage: 'production',
    description: '进入 Infor Nexus 后承接 YUEN TAI+XO 本地直连浏览器自动化链路',
    descriptionEn: 'Open Infor Nexus and run the YUEN TAI+XO local browser automation flow',
    order: 23,
  },
  {
    id: 'tc-inv-automation',
    path: '/web-automation/scenarios/tc-inv-automation',
    routeName: 'web-automation-scenario-tc-inv-automation',
    title: 'Jessica / VENT+YUEN TAI-Trade Card INV amount',
    titleEn: 'Jessica / VENT+YUEN TAI-Trade Card INV amount',
    navLabel: 'VENT+YUEN TAI-Trade Card INV amount',
    navLabelEn: 'VENT+YUEN TAI-Trade Card INV amount',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-infornexus-automation',
    stage: 'production',
    description: 'VENT+YUEN TAI-Trade Card INV amount 出货明细与费用录入自动化',
    descriptionEn: 'VENT+YUEN TAI-Trade Card INV amount shipping details and charge entry automation',
    order: 24,
  },
  {
    id: 'xo-tc-inv-automation',
    path: '/web-automation/scenarios/xo-tc-inv-automation',
    routeName: 'web-automation-scenario-xo-tc-inv-automation',
    title: 'Jessica / XO-Trade Card INV amount',
    titleEn: 'Jessica / XO-Trade Card INV amount',
    navLabel: 'XO-Trade Card INV amount',
    navLabelEn: 'XO-Trade Card INV amount',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-infornexus-automation',
    stage: 'production',
    description: 'XO-Trade Card INV amount 出货明细与费用录入自动化',
    descriptionEn: 'XO-Trade Card INV amount shipping details and charge entry automation',
    order: 25,
  },
  {
    id: 'po-auto-download',
    path: '/web-automation/scenarios/po-auto-download',
    routeName: 'web-automation-scenario-po-auto-download',
    title: 'Jessica / Invoice 下载',
    titleEn: 'Jessica / Invoice Download',
    navLabel: 'Invoice 下载',
    navLabelEn: 'Invoice Download',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-packing-list-auto-download',
    stage: 'production',
    description: '按 Excel 中的 Invoice Number 请求下载 Invoice PDF 到本机目录',
    descriptionEn: 'Request and download Invoice PDFs by Invoice Number from Excel',
    order: 26,
  },
  {
    id: 'packing-list-auto-download',
    path: '/web-automation/scenarios/packing-list-auto-download',
    routeName: 'web-automation-scenario-packing-list-auto-download',
    title: 'Jessica / Packing List 下载',
    titleEn: 'Jessica / Packing List Download',
    navLabel: 'Packing List 下载',
    navLabelEn: 'Packing List Download',
    group: 'jessica',
    category: 'browser-automation',
    navParentId: 'jessica-packing-list-auto-download',
    stage: 'validation',
    description: '按 Excel 中的箱单下载信息执行 Infor Nexus 本机浏览器自动化',
    descriptionEn: 'Run the local Infor Nexus Packing List download flow from Excel',
    order: 27,
  },
  {
    id: 'tms-finance-internal-reconciliation',
    path: '/tms-finance-internal-reconciliation',
    routeName: 'tms-finance-internal-reconciliation',
    title: '内销对账单数据写入',
    titleEn: 'Internal Reconciliation Data Fill',
    navLabel: '内销对账单数据写入',
    navLabelEn: 'Internal Reconciliation Data Fill',
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
    title: 'Turnover数据写入',
    titleEn: 'Turnover Data Fill',
    navLabel: 'Turnover数据写入',
    navLabelEn: 'Turnover Data Fill',
    group: 'finance-excel',
    category: 'excel',
    stage: 'validation',
    description: '从 BULK Sales 导出表写入 TURNOVER 的 Turnover Details',
    descriptionEn: 'Fill TURNOVER Turnover Details from BULK Sales export rows',
    order: 57,
  },
  {
    id: 'iplex-dual-table-compare',
    path: '/iplex/dual-table-compare',
    routeName: 'iplex-dual-table-compare',
    title: '数据核对',
    titleEn: 'Data Compare',
    navLabel: '数据核对',
    navLabelEn: 'Data Compare',
    group: 'eric',
    category: 'excel',
    stage: 'validation',
    description: '两张 iPlex Excel 按指定关键列 VLOOKUP 匹配并导出差值核对结果',
    descriptionEn: 'Compare two iPlex Excel exports by a selected VLOOKUP key and export differences',
    order: 51,
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
    description: '按 Excel 第二列 ID 自动执行 Infor Nexus 搜索、勾选和添加。',
    descriptionEn: 'Run Infor Nexus search, select and add flow from Excel column B IDs.',
    order: 55,
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
    id: 'excel-template-mapper-test',
    path: '/excel-template-mapper-test',
    routeName: 'excel-template-mapper-test',
    title: '通用 Excel 映射测试',
    titleEn: 'Generic Excel Mapper Test',
    navLabel: '通用 Excel 映射测试',
    navLabelEn: 'Generic Excel Mapper',
    group: 'general-tools',
    category: 'excel',
    stage: 'validation',
    description: '测试阶段：上传源 Excel，选择标准模板并手动匹配字段后生成结果',
    descriptionEn: 'Validation: map uploaded Excel fields into a selected template workbook',
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
    id: 'jane-infornexus',
    path: '/jane-infornexus',
    routeName: 'jane-infornexus',
    title: 'Jane / Infornexus',
    titleEn: 'Jane / Infornexus',
    navLabel: 'Infornexus',
    navLabelEn: 'Infornexus',
    group: 'jane',
    category: 'browser-automation',
    stage: 'production',
    description: 'Infor Nexus released Bulk 自动化流程',
    descriptionEn: 'Infor Nexus released Bulk automation flow',
    order: 49,
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
    id: 'automation-runs',
    path: '/automation-runs',
    routeName: 'automation-runs',
    title: '自动化执行记录',
    titleEn: 'Automation Runs',
    navLabel: '自动化执行记录',
    navLabelEn: 'Automation Runs',
    group: 'general-tools',
    category: 'system',
    stage: 'production',
    description: '查看所有自动化页面的执行记录、结果文件和错误详情',
    descriptionEn: 'Review execution records, result files, and failure details for all automation pages',
    order: 90,
  },
  {
    id: 'automation-templates',
    path: '/automation-templates',
    routeName: 'automation-templates',
    title: '自动化模板管理',
    titleEn: 'Automation Templates',
    navLabel: '自动化模板管理',
    navLabelEn: 'Automation Templates',
    group: 'general-tools',
    category: 'system',
    stage: 'production',
    description: '集中维护每个自动化页面使用的 Excel 模板',
    descriptionEn: 'Manage Excel templates used by every automation page',
    order: 95,
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
  { from: '/jessica-infornexus', to: '/eric-infornexus' },
  { from: '/browser-plugins', to: '/eric-infornexus' },
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
