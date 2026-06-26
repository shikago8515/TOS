import {
  getModuleById,
  getModulesByGroup,
  tosModules,
  type TosModuleDefinition,
  type TosModuleId,
  type TosModuleStage,
} from '../../domain/moduleCatalog'
import type { TranslationKey } from '../../shared/i18n/appLanguage'

const excelModules = [
  ...getModulesByGroup('jessica'),
  ...getModulesByGroup('sophia'),
  ...getModulesByGroup('jane'),
  ...getModulesByGroup('eric'),
  ...getModulesByGroup('jason'),
  ...getModulesByGroup('finance-excel'),
]
const collectorModules = getModulesByGroup('general-tools')

/* ── Dynamic counts from full module catalog ── */
const productionModules = tosModules.filter(
  (m) => m.stage === 'production' && m.id !== 'home' && m.id !== 'settings',
)
const validationModules = tosModules.filter(
  (m) => m.stage === 'validation',
)
const allFunctionalModules = tosModules.filter(
  (m) => m.id !== 'home' && m.id !== 'settings',
)

/* ── Metric tiles (4 cards) ── */
export const homeMetricTiles = [
  {
    key: 'excel',
    label: 'Excel 处理',
    value: String(excelModules.length),
    detail: '杰西卡 / 索菲 / 简 / 埃里克 / 杰森 / 露西亚',
    icon: 'database',
    tone: 'green' as const,
    delta: '+2',
    deltaLabel: '较昨日',
  },
  {
    key: 'production',
    label: '正式模块',
    value: String(productionModules.length),
    detail: '所有已上线模块',
    icon: 'globe-search',
    tone: 'green' as const,
    delta: undefined,
    deltaLabel: undefined,
  },
  {
    key: 'validation',
    label: '测试模块',
    value: String(validationModules.length),
    detail: '网页自动化 / Infornexus / ...',
    icon: 'workflow',
    tone: 'orange' as const,
    delta: undefined,
    deltaLabel: undefined,
  },
  {
    key: 'health',
    label: '系统健康度',
    value: '100%',
    detail: '所有服务运行正常',
    icon: 'shield-check',
    tone: 'blue' as const,
    delta: undefined,
    deltaLabel: undefined,
  },
] as const

/* ── Module shortcut IDs (12 modules) ── */
export const homeShortcutModuleIds = [
  'jessca',
  'sophia-tina',
  'jane',
  'jane-bom-summary',
  'jane-bom-compare',
  'jane-outbound-compare',
  'eric',
  'jason-pdf-reorder',
  'web-automation',
  'adidas-materials',
] as const satisfies readonly TosModuleId[]

export const homeShortcutModules = homeShortcutModuleIds.map(getModuleById)

/* ── Module cards for the 4×3 grid ── */
export interface HomeModuleCard {
  module: TosModuleDefinition
  iconName: string
  iconTone: 'green' | 'blue' | 'orange'
  stageLabel: string
  stageDot: 'green' | 'blue'
}

export const homeModuleCards: HomeModuleCard[] = allFunctionalModules.map((mod) => {
  let iconTone: 'green' | 'blue' | 'orange' = 'green'
  if (mod.stage === 'validation') {
    iconTone = 'blue'
  }
  if (mod.category === 'pdf') {
    iconTone = 'orange'
  }

  const stageLabel = mod.stage === 'validation' ? '测试阶段' : '正式模块'
  const stageDot: 'green' | 'blue' = mod.stage === 'validation' ? 'blue' : 'green'

  const iconMap: Record<string, string> = {
    jessca: 'check-circle',
    'sophia-tina': 'files',
    jane: 'package',
    'jane-bom-summary': 'layers',
    'jane-bom-compare': 'sliders',
    'jane-outbound-compare': 'check-circle',
    'jane-sap': 'monitor-code',
    eric: 'database',
    'eric-infornexus': 'globe',
    'jason-pdf-reorder': 'file-search',
    'draft-packing-compare': 'files',
    'tms-finance-internal-reconciliation': 'bar-chart',
    'tms-finance-work-sales': 'trending-up',
    'web-automation': 'workflow',
    'adidas-materials': 'globe-search',
  }

  return {
    module: mod,
    iconName: iconMap[mod.id] || 'puzzle',
    iconTone,
    stageLabel,
    stageDot,
  }
})

/* ── Service status items (运行概况) ── */
export const serviceStatusItems = [
  {
    key: 'backend',
    title: 'Python 后端',
    subtitle: '本地业务服务',
    status: '运行中',
    tone: 'online' as const,
  },
  {
    key: 'diagnostics',
    title: '诊断日志',
    subtitle: '当前会话与模块运行记录',
    status: '可导出',
    tone: 'ready' as const,
  },
  {
    key: 'automation',
    title: '浏览器自动化',
    subtitle: '网页自动化 / Infornexus',
    status: '业务验证中',
    tone: 'working' as const,
  },
  {
    key: 'files',
    title: '文件准备',
    subtitle: 'Excel 模块默认模板准备',
    status: 'jessica - Invoice 核对',
    tone: 'online' as const,
  },
]

/* ── Quick actions (快捷操作) ── */
export const homeQuickActions = [
  { icon: 'plus', label: '新建任务', tone: 'green' as const, path: '/jessca' },
  { icon: 'bar-chart', label: '任务监控', tone: 'blue' as const, path: '/web-automation' },
  { icon: 'settings', label: '系统设置', tone: 'slate' as const, path: '/settings' },
]
