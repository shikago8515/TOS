import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JaneBomCompareProcessResponse } from './janeBomCompareApi'

export const janeBomCompareModuleId = 'excel-jane-bom-compare'
export const janeBomCompareModuleName = 'Jane - PRODUCTION核对'

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
      label: 'C-F 不一致组',
      value: String(response.inconsistent_group_count ?? '-'),
      note: '按 Style ID + Production Lot ID 分组检查 C-D-E-F',
    },
    {
      label: '多出材料行',
      value: String(response.extra_material_row_count ?? '-'),
      note: 'Production 有但 BOM汇总 未使用的材料行会加删除线并标红',
    },
    {
      label: '补入材料行',
      value: String(response.missing_row_count ?? '-'),
    },
    {
      label: '料率计算行',
      value: String(response.rate_row_count ?? '-'),
      note: '料率列后会按 Style ID + Material 填入颜色',
    },
    {
      label: '红色单元格',
      value: String(response.mismatch_cell_count ?? '-'),
      note: '包含 C-D-E-F、Material Reference、Factory 和 Supplier 差异',
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
