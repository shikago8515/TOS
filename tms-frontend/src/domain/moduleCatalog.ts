export type TosModuleStage = 'production' | 'validation' | 'placeholder'

export type TosModuleGroup =
  | 'home'
  | 'excel'
  | 'automation'
  | 'collector'
  | 'settings'

export interface TosModuleDefinition {
  id: string
  path: string
  routeName: string
  title: string
  navLabel: string
  group: TosModuleGroup
  stage: TosModuleStage
  description: string
}

export const tosModules = [
  {
    id: 'home',
    path: '/',
    routeName: 'home',
    title: '首页',
    navLabel: '首页',
    group: 'home',
    stage: 'production',
    description: 'TOS 运营看板与快捷入口',
  },
  {
    id: 'jessca',
    path: '/jessca',
    routeName: 'jessca',
    title: '对账核对',
    navLabel: '对账核对',
    group: 'excel',
    stage: 'production',
    description: 'Jessca 发票价格核对与差异整理',
  },
  {
    id: 'sophia-tina',
    path: '/sophia-tina',
    routeName: 'sophia-tina',
    title: '报表合并',
    navLabel: '报表合并',
    group: 'excel',
    stage: 'production',
    description: 'Sophia & Tina 多源 Excel 汇总',
  },
  {
    id: 'jane',
    path: '/jane',
    routeName: 'jane',
    title: '成品表生成',
    navLabel: '成品表生成',
    group: 'excel',
    stage: 'production',
    description: 'Jane 成品表模板自动填充',
  },
  {
    id: 'eric',
    path: '/eric',
    routeName: 'eric',
    title: 'Excel数据处理整合工具-Eric',
    navLabel: 'Eric数据处理',
    group: 'excel',
    stage: 'validation',
    description: '测试阶段：Excel数据处理整合',
  },
  {
    id: 'browser-plugins',
    path: '/browser-plugins',
    routeName: 'browser-plugins',
    title: '浏览器插件（测试）',
    navLabel: '浏览器插件',
    group: 'automation',
    stage: 'validation',
    description: '测试阶段：业务网页插件验证',
  },
  {
    id: 'web-automation',
    path: '/web-automation',
    routeName: 'web-automation',
    title: '网页自动化（测试）',
    navLabel: '网页自动化',
    group: 'automation',
    stage: 'validation',
    description: '测试阶段：Playwright 流程试用',
  },
  {
    id: 'adidas-materials',
    path: '/adidas-materials',
    routeName: 'adidas-materials',
    title: 'adidas 材料收集器',
    navLabel: 'adidas 材料',
    group: 'collector',
    stage: 'production',
    description: 'ACP Materials 数据采集',
  },
  {
    id: 'module-a',
    path: '/module-a',
    routeName: 'module-a',
    title: '模块 A',
    navLabel: '模块 A',
    group: 'automation',
    stage: 'placeholder',
    description: '功能开发中',
  },
  {
    id: 'module-b',
    path: '/module-b',
    routeName: 'module-b',
    title: '模块 B',
    navLabel: '模块 B',
    group: 'automation',
    stage: 'placeholder',
    description: '功能开发中',
  },
  {
    id: 'settings',
    path: '/settings',
    routeName: 'settings',
    title: '系统设置',
    navLabel: '系统设置',
    group: 'settings',
    stage: 'placeholder',
    description: '功能开发中',
  },
] as const satisfies readonly TosModuleDefinition[]

export type TosModuleId = (typeof tosModules)[number]['id']

export const routeRedirects = [
  {
    from: '/infornexus',
    to: '/browser-plugins',
  },
] as const
