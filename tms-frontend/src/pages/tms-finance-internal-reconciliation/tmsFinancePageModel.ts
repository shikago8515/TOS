import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import {
  tmsFinanceInternalReconciliationModuleId,
  tmsFinanceInternalReconciliationModuleName,
} from './tmsFinanceInternalReconciliationModel'
import {
  tmsFinanceWorkSalesModuleId,
  tmsFinanceWorkSalesModuleName,
} from './tmsFinanceWorkSalesModel'

export type TmsFinanceProcessId = 'internal-reconciliation' | 'work-sales'

export interface TmsFinanceProcessOption {
  id: TmsFinanceProcessId
  label: string
  subtitle: string
  badge: string
  icon: string
  requiredGroups: number
  progressLabel: string
  idleActionLabel: string
  processingActionLabel: string
  resultMetricLabel: string
  resultSummaryLabel: string
  moduleId: string
  moduleName: string
  routeName: string
}

export const tmsFinanceProcessOptions: readonly TmsFinanceProcessOption[] = [
  {
    id: 'internal-reconciliation',
    label: '内销对账表数据提取',
    subtitle: 'Sample/Bulk 来源文件 → 内销对账大表尾部回填',
    badge: '2 组必传',
    icon: 'database',
    requiredGroups: 2,
    progressLabel: '回填进度',
    idleActionLabel: '开始回填',
    processingActionLabel: '回填中...',
    resultMetricLabel: '回填行',
    resultSummaryLabel: '回填行',
    moduleId: tmsFinanceInternalReconciliationModuleId,
    moduleName: tmsFinanceInternalReconciliationModuleName,
    routeName: 'tms-finance-internal-reconciliation',
  },
  {
    id: 'work-sales',
    label: 'Work Sales 数据提取',
    subtitle: 'iPlix Turnover Details + 补充参考表 → Work Sales 汇总',
    badge: '2 组必传',
    icon: 'bar-chart',
    requiredGroups: 2,
    progressLabel: '提取进度',
    idleActionLabel: '开始提取',
    processingActionLabel: '提取中...',
    resultMetricLabel: '提取行',
    resultSummaryLabel: '提取行',
    moduleId: tmsFinanceWorkSalesModuleId,
    moduleName: tmsFinanceWorkSalesModuleName,
    routeName: 'tms-finance-work-sales',
  },
]

export function getTmsFinanceProcessById(
  processId: TmsFinanceProcessId,
): TmsFinanceProcessOption {
  return (
    tmsFinanceProcessOptions.find((process) => process.id === processId)
    ?? tmsFinanceProcessOptions[0]
  )
}

export function getTmsFinanceProcessByRoute(routeName: unknown): TmsFinanceProcessOption {
  return (
    tmsFinanceProcessOptions.find((process) => process.routeName === routeName)
    ?? tmsFinanceProcessOptions[0]
  )
}

export function getTmsFinanceResultMetricValue(
  summaryItems: readonly ProcessSummaryItem[],
  process: TmsFinanceProcessOption,
): string {
  const item = summaryItems.find((entry) => entry.label === process.resultSummaryLabel)

  return item?.value ?? '-'
}
