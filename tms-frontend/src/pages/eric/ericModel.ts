import type { EricProcessResponse } from './ericApi'

export const ericModuleId = 'eric'
export const ericModuleName = 'Excel数据处理整合工具 - Eric'

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
    title: '生成 Final_Data',
    description: '先把 Pack Size breakdown 转成 PO / Article / Size / Quantity 明细。',
  },
  {
    index: '02',
    title: '解析 YTIC',
    description: '读取 YTIC check 的尺寸、目的地和 SP 信息，替代原宏的手工提取。',
  },
  {
    index: '03',
    title: '自动核对',
    description: '按 PO Number1 + Article Number1 + Size 对比双方数量。',
  },
  {
    index: '04',
    title: '诊断包',
    description: '输出 Summary、Size_Check、PO_Check 和审计明细表。',
  },
]

export function buildEricStats(input: {
  packReady: boolean
  yticReady: boolean
  processing: boolean
  success: boolean | null
  rowCount: string
  differenceCount: string
  outputFile: string
}): EricStatItem[] {
  const sourceCount = [input.packReady, input.yticReady].filter(Boolean).length

  return [
    {
      label: '源文件',
      value: `${sourceCount}/2`,
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
      label: '差异项',
      value: input.differenceCount,
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

export function readEricDifferenceCount(response: EricProcessResponse): string {
  return response.difference_count == null ? '-' : String(response.difference_count)
}
