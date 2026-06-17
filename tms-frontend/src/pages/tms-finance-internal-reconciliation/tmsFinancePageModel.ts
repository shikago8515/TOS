import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import { isBackendVersionMismatchMessage } from '../../shared/api/backendClient'
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
    subtitle: 'Sample/Bulk 来源文件 → 内销对账大表尾部追加',
    badge: '2 组必传',
    icon: 'database',
    requiredGroups: 2,
    progressLabel: '追加进度',
    idleActionLabel: '开始追加',
    processingActionLabel: '追加中...',
    resultMetricLabel: '追加行',
    resultSummaryLabel: '追加行',
    moduleId: tmsFinanceInternalReconciliationModuleId,
    moduleName: tmsFinanceInternalReconciliationModuleName,
    routeName: 'tms-finance-internal-reconciliation',
  },
  {
    id: 'work-sales',
    label: 'Work Sales 数据写入',
    subtitle: 'BULK Sales 导出表 → 写入 TURNOVER Turnover Details',
    badge: '2 组必传',
    icon: 'bar-chart',
    requiredGroups: 2,
    progressLabel: '写入进度',
    idleActionLabel: '开始写入',
    processingActionLabel: '写入中...',
    resultMetricLabel: '写入行',
    resultSummaryLabel: '写入行',
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

export function buildTmsFinanceProcessErrorSummary(
  errorMessage: string,
): ProcessSummaryItem[] {
  if (isBackendVersionMismatchMessage(errorMessage)) {
    return [
      {
        label: '后端版本',
        value: '未更新',
        note: errorMessage,
      },
    ]
  }

  return [
    {
      label: '处理状态',
      value: '失败',
      note: '可导出诊断包发给开发排查',
    },
  ]
}
