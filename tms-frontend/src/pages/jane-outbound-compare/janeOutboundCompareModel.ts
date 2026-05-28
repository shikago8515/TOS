import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JaneOutboundCompareProcessResponse } from './janeOutboundCompareApi'

export const janeOutboundCompareModuleId = 'excel-jane-outbound-compare'
export const janeOutboundCompareModuleName = 'Jane-OUTBOUND核对'

export interface JaneOutboundCompareInputCounts {
  outbound: number
  tms: number
}

export function buildJaneOutboundCompareSummary(
  response: JaneOutboundCompareProcessResponse,
  counts: JaneOutboundCompareInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'T1 OUTBOUND 文件',
      value: String(counts.outbound),
    },
    {
      label: 'Copy of TMS',
      value: String(counts.tms),
    },
    {
      label: '已核对行数',
      value: String(response.checked_row_count ?? '-'),
    },
    {
      label: '匹配行数',
      value: String(response.matched_row_count ?? '-'),
    },
    {
      label: 'TMS缺失行',
      value: String(response.missing_tms_row_count ?? '-'),
    },
    {
      label: 'OUTBOUND缺失行',
      value: String(response.missing_outbound_row_count ?? '-'),
    },
    {
      label: '红色单元格',
      value: String(response.difference_cell_count ?? '-'),
    },
    {
      label: '差异明细',
      value: String(response.issue_count ?? '-'),
    },
    {
      label: '结果文件',
      value: response.output_file || response.result_file
        ? '已生成'
        : response.success
          ? '可下载'
          : '未生成',
    },
  ]
}
