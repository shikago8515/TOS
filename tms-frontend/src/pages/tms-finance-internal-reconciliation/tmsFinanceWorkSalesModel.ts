import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { TmsFinanceWorkSalesResponse } from './tmsFinanceWorkSalesApi'

export const tmsFinanceWorkSalesModuleId = 'excel-tms-finance-work-sales'
export const tmsFinanceWorkSalesModuleName = 'Work Sales 数据追加'

export function buildTmsFinanceWorkSalesSummary(
  response: TmsFinanceWorkSalesResponse,
): ProcessSummaryItem[] {
  const salesAppendedCount =
    response.sales_appended_count
    ?? response.source_summary?.sales_rows
    ?? response.totals?.sales_appended_rows
  const purchaseAppendedCount =
    response.purchase_appended_count
    ?? response.source_summary?.purchase_rows
    ?? response.totals?.purchase_appended_rows
  const totalAppendedCount =
    typeof salesAppendedCount === 'number' && typeof purchaseAppendedCount === 'number'
      ? salesAppendedCount + purchaseAppendedCount
      : undefined

  return [
    {
      label: '源行',
      value: String(
        response.source_row_count
          ?? response.extracted_count
          ?? response.source_summary?.source_rows
          ?? '-',
      ),
    },
    {
      label: '追加行',
      value: String(totalAppendedCount ?? '-'),
    },
    {
      label: 'Sales 追加',
      value: String(salesAppendedCount ?? '-'),
    },
    {
      label: 'Purchase 追加',
      value: String(purchaseAppendedCount ?? '-'),
    },
    {
      label: '重复跳过',
      value: String(
        response.duplicate_count
          ?? response.source_summary?.duplicate_rows
          ?? response.totals?.duplicate_rows
          ?? '-',
      ),
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
