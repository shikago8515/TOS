import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { SophiaTinaProcessResponse } from './sophiaTinaApi'

export const sophiaTinaModuleId = 'excel-sophia-tina'
export const sophiaTinaModuleName = '报表合并'

export interface SophiaTinaInputCounts {
  tms: number
  article: number
  price: number
  pack: number
}

export function buildSophiaTinaSummary(
  response: SophiaTinaProcessResponse,
  counts: SophiaTinaInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'TMS 文件',
      value: String(counts.tms),
    },
    {
      label: 'Article 文件',
      value: String(counts.article),
    },
    {
      label: 'Price / Pack',
      value: `${counts.price} / ${counts.pack}`,
    },
    {
      label: 'Working Number',
      value: String(response.working_count ?? '-'),
    },
    {
      label: 'Result 明细',
      value: String(response.result_count ?? '-'),
    },
    {
      label: '诊断记录',
      value: String(response.diagnostics_count ?? '-'),
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
