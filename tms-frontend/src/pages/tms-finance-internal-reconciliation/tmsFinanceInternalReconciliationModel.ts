import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { TmsFinanceInternalReconciliationResponse } from './tmsFinanceInternalReconciliationApi'

export const tmsFinanceInternalReconciliationModuleId =
  'excel-tms-finance-internal-reconciliation'
export const tmsFinanceInternalReconciliationModuleName =
  '内销对账表数据提取'

export function buildTmsFinanceInternalReconciliationSummary(
  response: TmsFinanceInternalReconciliationResponse,
): ProcessSummaryItem[] {
  return [
    {
      label: '来源提取行',
      value: String(response.source_row_count ?? response.source_summary?.source_rows ?? '-'),
    },
    {
      label: 'Sample 行',
      value: String(response.source_summary?.sample_rows ?? '-'),
    },
    {
      label: 'Bulk 行',
      value: String(response.source_summary?.bulk_rows ?? response.source_summary?.book_rows ?? '-'),
    },
    {
      label: '追加行',
      value: String(response.appended_count ?? response.updated_count ?? '-'),
    },
    {
      label: '重复跳过',
      value: String(response.duplicate_count ?? response.skipped_count ?? '-'),
    },
    {
      label: '相似已追加',
      value: String(response.similar_count ?? '-'),
    },
    {
      label: '目标处理行',
      value: String(response.target_row_count ?? '-'),
    },
    {
      label: '排除行',
      value: formatNumberList(response.excluded_rows),
    },
    {
      label: '排除列',
      value: formatNumberList(response.excluded_columns),
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

function formatNumberList(values: number[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : '-'
}
