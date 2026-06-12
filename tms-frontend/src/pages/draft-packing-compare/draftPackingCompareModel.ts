import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { DraftPackingCompareProcessResponse } from './draftPackingCompareApi'

export const draftPackingCompareModuleId = 'pdf-draft-packing-compare'
export const draftPackingCompareModuleName = 'Draft & Packing List 核对'

export interface DraftPackingCompareInputCounts {
  draft: number
  packing: number
}

export function buildDraftPackingCompareSummary(
  response: DraftPackingCompareProcessResponse,
  counts: DraftPackingCompareInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'Draft Form E PDF',
      value: String(counts.draft),
    },
    {
      label: 'Packing List PDF',
      value: String(counts.packing),
    },
    {
      label: 'Draft 记录',
      value: String(response.draft_count ?? '-'),
    },
    {
      label: 'Packing 记录',
      value: String(response.packing_count ?? '-'),
    },
    {
      label: '核对分组',
      value: String(response.group_count ?? '-'),
    },
    {
      label: '差异字段',
      value: String(response.mismatch_count ?? '-'),
    },
    {
      label: '需反馈字段',
      value: String(response.missing_field_count ?? '-'),
    },
    {
      label: '问题总数',
      value: String(response.issue_count ?? '-'),
    },
    {
      label: '结果文件',
      value: response.output_file ? '已生成' : response.success ? '可下载' : '未生成',
    },
  ]
}
