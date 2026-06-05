import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JaneBomSummaryProcessResponse } from './janeBomSummaryApi'

export const janeBomSummaryModuleId = 'excel-jane-bom-summary'
export const janeBomSummaryModuleName = 'Jane - BOM汇总'

export interface JaneBomSummaryInputCounts {
  bom: number
  pack: number
}

export function buildJaneBomSummary(
  response: JaneBomSummaryProcessResponse,
  counts: JaneBomSummaryInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'BOM 文件',
      value: String(counts.bom),
    },
    {
      label: 'Pack 文件',
      value: String(counts.pack),
    },
    {
      label: '已处理 BOM',
      value: String(response.bom_count ?? '-'),
    },
    {
      label: '汇总行数',
      value: String(response.row_count ?? '-'),
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
