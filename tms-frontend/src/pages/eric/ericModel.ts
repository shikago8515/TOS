import type { EricProcessResponse } from './ericApi'

export const ericModuleId = 'excel-eric'
export const ericModuleName = 'Excel数据处理整合工具-Eric'

export interface EricStatItem {
  label: string
  value: string
}

export interface EricStepItem {
  index: string
  title: string
  description: string
}

export const ericWorkflowSteps: EricStepItem[] = [
  {
    index: '01',
    title: '辅助列',
    description: '插入 PO Number1 和 Article Number1，并向下填充 PO Number1 空值。',
  },
  {
    index: '02',
    title: '拆分 Sheet',
    description: '按 PO Number 标题行分割业务数据块。',
  },
  {
    index: '03',
    title: 'Final_Data',
    description: '将尺码列转成 Size / Quantity 明细行。',
  },
]

export function buildEricStats(input: {
  hasFile: boolean
  processing: boolean
  success: boolean | null
  rowCount: string
  outputFile: string
}): EricStatItem[] {
  return [
    {
      label: '源文件',
      value: input.hasFile ? '1' : '0',
    },
    {
      label: '处理状态',
      value: input.processing
        ? '处理中'
        : input.success === true
          ? '成功'
          : input.success === false
            ? '失败'
            : '待处理',
    },
    {
      label: 'Final_Data 行数',
      value: input.rowCount,
    },
    {
      label: '结果文件',
      value: input.outputFile ? '已生成' : '未生成',
    },
  ]
}

export function readEricRowCount(response: EricProcessResponse): string {
  return response.row_count == null ? '-' : String(response.row_count)
}
