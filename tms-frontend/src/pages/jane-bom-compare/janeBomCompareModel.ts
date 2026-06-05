import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JaneBomCompareProcessResponse } from './janeBomCompareApi'

export const janeBomCompareModuleId = 'excel-jane-bom-compare'
export const janeBomCompareModuleName = 'Jane - BOM核对'

export interface JaneBomCompareInputCounts {
  production: number
  bomSummary: number
}

export function buildJaneBomCompareSummary(
  response: JaneBomCompareProcessResponse,
  counts: JaneBomCompareInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'T1 PRODUCTION 文件',
      value: String(counts.production),
    },
    {
      label: 'BOM汇总 文件',
      value: String(counts.bomSummary),
    },
    {
      label: 'BOM汇总文件',
      value: String(response.bom_count ?? '-'),
    },
    {
      label: 'BOM汇总有效行',
      value: String(response.bom_material_row_count ?? '-'),
      note: '只统计 BOM汇总 中可核对的有效行',
    },
    {
      label: '已核对行数',
      value: String(response.checked_row_count ?? '-'),
    },
    {
      label: '红色单元格',
      value: String(response.mismatch_cell_count ?? '-'),
      note: '不含新增缺失行的整行标红',
    },
    {
      label: '新增缺失行',
      value: String(response.missing_row_count ?? '-'),
    },
    {
      label: '无对应 BOM 行',
      value: String(response.no_bom_key_count ?? '-'),
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
