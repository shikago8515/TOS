import {
  getModuleById,
  getModulesByGroup,
  type TosModuleId,
} from '../../domain/moduleCatalog'

const excelModules = getModulesByGroup('excel')
const collectorModules = getModulesByGroup('collector')
const automationModules = getModulesByGroup('automation')

export const homeMetricTiles = [
  {
    label: 'Excel 处理',
    value: excelModules.length,
    detail: '对账核对 / 报表合并 / 成品表生成 / Eric',
    tone: 'blue',
  },
  {
    label: '正式采集',
    value: collectorModules.length,
    detail: 'adidas Materials',
    tone: 'green',
  },
  {
    label: '测试模块',
    value: automationModules.length,
    detail: automationModules.map((module) => module.navLabel).join(' / '),
    tone: 'amber',
  },
] as const

export const homeShortcutModuleIds = [
  'jessca',
  'sophia-tina',
  'jane',
  'eric',
  'browser-plugins',
  'web-automation',
  'adidas-materials',
] as const satisfies readonly TosModuleId[]

export const homeShortcutModules = homeShortcutModuleIds.map(getModuleById)

export const serviceStatusItems = [
  {
    label: 'Python 后端',
    description: '本地业务服务',
    status: '运行中',
    tone: 'online',
  },
  {
    label: '诊断日志',
    description: '当前会话与模块运行记录',
    status: '可导出',
    tone: 'ready',
  },
  {
    label: '自动化试验区',
    description: '浏览器插件 / 网页自动化',
    status: '业务验证中',
    tone: 'working',
  },
  {
    label: '文件准备',
    description: 'Excel 模块默认入口',
    status: '对账核对',
    tone: 'ready',
  },
] as const
