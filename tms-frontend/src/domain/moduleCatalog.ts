export type TosModuleStage = 'production' | 'validation' | 'placeholder'

export type TosModuleGroup =
  | 'home'
  | 'excel'
  | 'automation'
  | 'testing'
  | 'collector'
  | 'settings'

export interface TosModuleDefinition {
  id: string
  path: string
  routeName: string
  title: string
  navLabel: string
  navLabelEn: string
  group: TosModuleGroup
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
  { id: 'excel', label: 'Excel 处理', labelEn: 'Excel Processing' },
  { id: 'automation', label: '浏览器自动化', labelEn: 'Browser Automation' },
  { id: 'testing', label: '测试', labelEn: 'Testing' },
  { id: 'collector', label: '网页数据爬取', labelEn: 'Web Data Collection' },
  { id: 'settings', label: '系统', labelEn: 'System' },
] as const satisfies readonly TosNavGroupDefinition[]

export const tosNavParents = [
  {
    id: 'jane-table-making',
    label: 'Jane-表格制作',
    labelEn: 'Jane Table Making',
    group: 'excel',
    order: 40,
  },
  {
    id: 'web-automation-group',
    label: '网页自动化',
    labelEn: 'Web Automation',
    group: 'automation',
    order: 65,
  },
] as const satisfies readonly TosNavParentDefinition[]

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
    navLabel: '首页',
    navLabelEn: 'Home',
    group: 'home',
    stage: 'production',
    description: 'TOS 运营看板与快捷入口',
    descriptionEn: 'TOS operations dashboard and shortcuts',
    order: 10,
  },
  {
    id: 'jessca',
    path: '/jessca',
    routeName: 'jessca',
    title: 'jessica-对账核对',
    navLabel: 'jessica-对账核对',
    navLabelEn: 'Reconciliation',
    group: 'excel',
    stage: 'production',
    description: 'Jessca 发票价格核对与差异整理',
    descriptionEn: 'Jessca invoice price checking and discrepancy cleanup',
    order: 20,
  },
  {
    id: 'sophia-tina',
    path: '/sophia-tina',
    routeName: 'sophia-tina',
    title: 'Sophia-报表合并',
    navLabel: 'Sophia-报表合并',
    navLabelEn: 'Report Merge',
    group: 'excel',
    stage: 'production',
    description: 'Sophia & Tina 多源 Excel 汇总',
    descriptionEn: 'Sophia & Tina multi-source Excel summary',
    order: 30,
  },
  {
    id: 'jane',
    path: '/jane',
    routeName: 'jane',
    title: '成品表生成',
    navLabel: '成品表生成',
    navLabelEn: 'Finished Goods Sheet',
    group: 'excel',
    navParentId: 'jane-table-making',
    stage: 'production',
    description: 'Jane 成品表模板自动填充',
    descriptionEn: 'Jane finished goods template auto-fill',
    order: 40,
  },
  {
    id: 'jane-bom-summary',
    path: '/jane-bom-summary',
    routeName: 'jane-bom-summary',
    title: 'Jane-BOM汇总',
    navLabel: 'Jane-BOM汇总',
    navLabelEn: 'Jane BOM Summary',
    group: 'excel',
    navParentId: 'jane-table-making',
    stage: 'production',
    description: 'BOM 文件按 Pack 映射生成 MAIN COMPONENT 汇总',
    descriptionEn: 'Generate MAIN COMPONENT summaries from BOM files and Pack mappings',
    order: 45,
  },
  {
    id: 'jane-bom-compare',
    path: '/jane-bom-compare',
    routeName: 'jane-bom-compare',
    title: 'Jane-BOM核对',
    navLabel: 'Jane-BOM核对',
    navLabelEn: 'Jane BOM Compare',
    group: 'excel',
    navParentId: 'jane-table-making',
    stage: 'production',
    description: 'T1 PRODUCTION 与 BOM汇总 面料核对并标红差异',
    descriptionEn: 'Compare T1 PRODUCTION with BOM summary materials and mark differences',
    order: 46,
  },
  {
    id: 'jane-outbound-compare',
    path: '/jane-outbound-compare',
    routeName: 'jane-outbound-compare',
    title: 'Jane-OUTBOUND核对',
    navLabel: 'Jane-OUTBOUND核对',
    navLabelEn: 'Jane OUTBOUND Compare',
    group: 'excel',
    navParentId: 'jane-table-making',
    stage: 'production',
    description: 'T1 OUTBOUND 与 Copy of TMS 核对并标红差异',
    descriptionEn: 'Compare T1 OUTBOUND with Copy of TMS and mark differences',
    order: 47,
  },
  {
    id: 'eric',
    path: '/eric',
    routeName: 'eric',
    title: 'Excel数据处理整合工具-Eric',
    navLabel: 'Eric数据处理',
    navLabelEn: 'Eric Data Processing',
    group: 'excel',
    stage: 'validation',
    description: '测试阶段：Excel数据处理整合',
    descriptionEn: 'Validation: integrated Excel data processing',
    order: 50,
  },
  {
    id: 'browser-plugins',
    path: '/browser-plugins',
    routeName: 'browser-plugins',
    title: '浏览器插件（测试）',
    navLabel: '浏览器插件',
    navLabelEn: 'Browser Plugins',
    group: 'automation',
    stage: 'validation',
    description: '测试阶段：业务网页插件验证',
    descriptionEn: 'Validation: business web plugin checks',
    order: 60,
  },
  {
    id: 'infornexus',
    path: '/infornexus',
    routeName: 'infornexus',
    title: 'Infornexus 外部子应用',
    navLabel: 'Infornexus',
    navLabelEn: 'Infornexus',
    group: 'automation',
    stage: 'validation',
    description: '以外部整包方式启动 Infornexus Electron 子应用',
    descriptionEn: 'Launch the packaged Infornexus Electron sub-application',
    order: 75,
  },
  {
    id: 'jane-sap',
    path: '/jane-sap',
    routeName: 'jane-sap',
    title: 'Jane-SAP',
    navLabel: 'Jane-SAP',
    navLabelEn: 'Jane-SAP',
    group: 'automation',
    navParentId: 'web-automation-group',
    stage: 'production',
    description: 'SAP 自动化流程',
    descriptionEn: 'SAP automation workflow',
    order: 72,
  },
  {
    id: 'eric-infornexus',
    path: '/eric-infornexus',
    routeName: 'eric-infornexus',
    title: 'Eric-Infornexus',
    navLabel: 'Eric-Infornexus',
    navLabelEn: 'Eric-Infornexus',
    group: 'automation',
    navParentId: 'web-automation-group',
    stage: 'production',
    description: 'Infornexus 自动化流程',
    descriptionEn: 'Infornexus automation workflow',
    order: 73,
  },
  {
    id: 'adidas-materials',
    path: '/adidas-materials',
    routeName: 'adidas-materials',
    title: 'adidas 材料收集器',
    navLabel: 'adidas 材料',
    navLabelEn: 'adidas Materials',
    group: 'collector',
    stage: 'production',
    description: 'ACP Materials 数据采集',
    descriptionEn: 'ACP Materials data collection',
    order: 80,
  },
  {
    id: 'module-a',
    path: '/module-a',
    routeName: 'module-a',
    title: '模块 A',
    navLabel: '模块 A',
    navLabelEn: 'Module A',
    group: 'testing',
    stage: 'placeholder',
    description: '功能开发中',
    descriptionEn: 'In development',
    order: 90,
  },
  {
    id: 'module-b',
    path: '/module-b',
    routeName: 'module-b',
    title: '模块 B',
    navLabel: '模块 B',
    navLabelEn: 'Module B',
    group: 'testing',
    stage: 'placeholder',
    description: '功能开发中',
    descriptionEn: 'In development',
    order: 100,
  },
  {
    id: 'settings',
    path: '/settings',
    routeName: 'settings',
    title: '系统设置',
    navLabel: '系统设置',
    navLabelEn: 'Settings',
    group: 'settings',
    stage: 'production',
    description: '查看版本、检查更新并安装新版 TOS',
    descriptionEn: 'View version, check for updates, and install a newer TOS',
    order: 110,
  },
] as const satisfies readonly TosModuleDefinition[]

export type TosModuleId = (typeof tosModules)[number]['id']

export const routeRedirects = [] as const

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
