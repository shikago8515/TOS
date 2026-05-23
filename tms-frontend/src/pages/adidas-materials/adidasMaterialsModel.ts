export type AdidasMaterialsNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface AdidasMaterialsCapability {
  label: string
  value: string
}

export interface AdidasMaterialsWorkflowStep {
  index: number
  text: string
}

export const adidasMaterialsCapabilities = [
  {
    label: '采集方式',
    value: '外部 Edge/Chrome 登录后监听 materials 接口响应',
  },
  {
    label: '保存策略',
    value: '默认每 2000 条保存 JSON 与 CSV',
  },
  {
    label: '恢复能力',
    value: '本地保存去重 ID 与待保存批次',
  },
] as const satisfies readonly AdidasMaterialsCapability[]

export const adidasMaterialsWorkflowSteps = [
  '打开外部 Edge/Chrome，在右侧“网页地址”输入登录入口并前往',
  '在外部浏览器里完成账号登录，并按正常路径进入 Materials 列表页',
  '进入 Materials 列表页，确认右上角显示“接口捕获：已启用”',
  '点击“获取当前页”或“开始自动翻页”',
  '结束前点击“保存当前批次”，避免剩余数据未落盘',
].map((text, index) => ({
  index: index + 1,
  text,
})) satisfies AdidasMaterialsWorkflowStep[]

export const adidasMaterialsNotes = [
  '采集器运行在外部浏览器窗口中，不会在主应用里直接请求 adidas 页面。',
  '登录入口、账号权限和 Materials 列表页路径都按业务实际操作为准。',
  '采集结束前先保存当前批次，避免剩余数据只在内存里。',
] as const

export function readLaunchSuccessMessage(alreadyOpen?: boolean): string {
  return alreadyOpen ? 'adidas 外部浏览器已在运行' : 'adidas 外部浏览器已打开'
}
