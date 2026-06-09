import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { TmsFinanceInternalReconciliationResponse } from './tmsFinanceInternalReconciliationApi'

export const tmsFinanceInternalReconciliationModuleId =
  'excel-tms-finance-internal-reconciliation'
export const tmsFinanceInternalReconciliationModuleName =
  '内销对账单导入'

export function buildTmsFinanceInternalReconciliationSummary(
  response: TmsFinanceInternalReconciliationResponse,
): ProcessSummaryItem[] {
  return [
    {
      label: 'Sample 提取行',
      value: String(response.source_summary?.sample_rows ?? '-'),
    },
    {
      label: 'Bulk 提取行',
      value: String(response.source_summary?.bulk_rows ?? '-'),
    },
    {
      label: '新增行',
      value: String(response.appended_count ?? '-'),
    },
    {
      label: '跳过重复',
      value: String(response.skipped_count ?? '-'),
    },
    {
      label: 'QTY 合计',
      value: String(response.totals?.quantity ?? '-'),
    },
    {
      label: 'Purchase 合计',
      value: formatAmount(response.totals?.purchase_amount),
    },
    {
      label: 'Sales 含税合计',
      value: formatAmount(response.totals?.sales_amount_with_tax),
    },
    {
      label: '诊断项',
      value: String(response.diagnostic_count ?? '-'),
    },
    {
      label: '结果文件',
      value:
        response.output_file || response.result_file
          ? '已生成'
          : response.success
            ? '可下载'
            : '未生成',
    },
  ]
}

function formatAmount(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '-'
}
