import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { TmsFinanceWorkSalesResponse } from './tmsFinanceWorkSalesApi'

export const tmsFinanceWorkSalesModuleId = 'excel-tms-finance-work-sales'
export const tmsFinanceWorkSalesModuleName = 'Work Sales 数据写入'

export function buildTmsFinanceWorkSalesSummary(
  response: TmsFinanceWorkSalesResponse,
): ProcessSummaryItem[] {
  const salesWrittenCount =
    response.sales_written_count
    ?? response.source_summary?.sales_written_rows
    ?? response.totals?.sales_written_count
    ?? response.sales_appended_count
    ?? response.source_summary?.sales_rows
    ?? response.totals?.sales_appended_rows
  const purchaseWrittenCount =
    response.purchase_written_count
    ?? response.source_summary?.purchase_written_rows
    ?? response.totals?.purchase_written_count
    ?? response.purchase_appended_count
    ?? response.source_summary?.purchase_rows
    ?? response.totals?.purchase_appended_rows
  const clearedSalesCount =
    response.cleared_sales_count
    ?? response.source_summary?.cleared_sales_rows
    ?? response.totals?.cleared_sales_count
  const clearedPurchaseCount =
    response.cleared_purchase_count
    ?? response.source_summary?.cleared_purchase_rows
    ?? response.totals?.cleared_purchase_count
  const totalWrittenCount =
    typeof salesWrittenCount === 'number' && typeof purchaseWrittenCount === 'number'
      ? salesWrittenCount + purchaseWrittenCount
      : undefined
  const totalClearedCount =
    typeof clearedSalesCount === 'number' && typeof clearedPurchaseCount === 'number'
      ? clearedSalesCount + clearedPurchaseCount
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
      label: '写入行',
      value: String(totalWrittenCount ?? '-'),
    },
    {
      label: 'Sales 写入',
      value: String(salesWrittenCount ?? '-'),
    },
    {
      label: 'Purchase 写入',
      value: String(purchaseWrittenCount ?? '-'),
    },
    {
      label: '清空旧行',
      value: String(totalClearedCount ?? '-'),
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
