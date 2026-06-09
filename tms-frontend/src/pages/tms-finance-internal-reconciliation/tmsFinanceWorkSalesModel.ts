import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { TmsFinanceWorkSalesResponse } from './tmsFinanceWorkSalesApi'

export const tmsFinanceWorkSalesModuleId = 'excel-tms-finance-work-sales'
export const tmsFinanceWorkSalesModuleName = 'Work Sales 数据提取'

export function buildTmsFinanceWorkSalesSummary(
  response: TmsFinanceWorkSalesResponse,
): ProcessSummaryItem[] {
  return [
    {
      label: '提取行',
      value: String(response.extracted_count ?? '-'),
    },
    {
      label: '参考匹配',
      value: String(response.matched_reference_count ?? '-'),
    },
    {
      label: '参考缺失',
      value: String(response.missing_reference_count ?? '-'),
    },
    {
      label: '月份',
      value: response.month_label ?? '-',
    },
    {
      label: 'Sales 单价合计',
      value: formatAmount(response.totals?.sales_unit_price_total),
    },
    {
      label: 'Purchase 单价合计',
      value: formatAmount(response.totals?.purchase_unit_price_total),
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
