import type { ProcessSummaryItem } from '../../shared/process/processHistory'
import type { JaneProcessResponse } from './janeApi'

export const janeModuleId = 'excel-jane'
export const janeModuleName = '成品表生成'

export interface JaneInputState {
  customerFileCount: number
  countryFileCount: number
  workingFilters: string
}

export function buildJaneSummary(
  response: JaneProcessResponse,
  input: JaneInputState,
): ProcessSummaryItem[] {
  return [
    {
      label: 'Copy of TMS',
      value: String(input.customerFileCount),
    },
    {
      label: 'country.xlsx',
      value: input.countryFileCount > 0 ? '已上传' : '未上传',
    },
    {
      label: 'Working Number',
      value: String(response.working_count ?? '-'),
      note: input.workingFilters.trim() ? '已按筛选条件处理' : undefined,
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
