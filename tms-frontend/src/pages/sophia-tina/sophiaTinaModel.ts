import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { SophiaTinaProcessResponse } from './sophiaTinaApi'

export const sophiaTinaModuleId = 'excel-sophia-tina'
export const sophiaTinaModuleName = 'Sophia - 报表合并'

export interface SophiaTinaInputCounts {
  tms: number
  tmsPrice: number
  price: number
  allocation: number
  shipmentMethod: number
}

export function buildSophiaTinaSummary(
  response: SophiaTinaProcessResponse,
  counts: SophiaTinaInputCounts,
): ProcessSummaryItem[] {
  return [
    {
      label: 'TMS / TMS Price',
      value: `${counts.tms} / ${counts.tmsPrice}`,
    },
    {
      label: 'Factory Price',
      value: String(counts.price),
    },
    {
      label: 'Allocation / Shipment',
      value: `${counts.allocation} / ${counts.shipmentMethod}`,
    },
    {
      label: 'Working Number',
      value: String(response.working_count ?? '-'),
    },
    {
      label: '结果明细',
      value: String(response.result_count ?? '-'),
    },
    {
      label: '诊断记录',
      value: String(response.diagnostics_count ?? '-'),
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
