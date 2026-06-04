import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JesscaProcessResponse } from './jesscaApi'

export const jesscaModuleId = 'excel-jessca'
export const jesscaModuleName = '对账核对'

export function buildJesscaSummary(
  response: JesscaProcessResponse,
  invoiceFileCount: number,
): ProcessSummaryItem[] {
  const matchedCount = response.matches
    ? Object.values(response.matches).reduce((sum, value) => sum + Number(value || 0), 0)
    : undefined
  const diagnosticIssueCount = response.diagnostics
    ? Object.entries(response.diagnostics).reduce(
        (sum, [status, value]) => sum + (status === '一致' ? 0 : Number(value || 0)),
        0,
      )
    : undefined

  return [
    {
      label: '发票文件',
      value: String(response.invoice_count ?? invoiceFileCount),
    },
    {
      label: '商品总数',
      value: String(response.total_items ?? '-'),
    },
    {
      label: '匹配数量',
      value: matchedCount === undefined ? '-' : String(matchedCount),
    },
    {
      label: '异常诊断',
      value: diagnosticIssueCount === undefined ? '-' : String(diagnosticIssueCount),
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
