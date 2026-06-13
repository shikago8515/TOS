export const shippingAutomation2EntryId = 'shipping-automation-2'

export const shippingAutomation2Steps = [
  {
    title: '选择 Bulk 类型',
    desc: 'Unreleased Bulk 和 released Bulk 会进入不同的浏览器自动化逻辑。',
  },
  {
    title: '上传 Excel',
    desc: '每个区域独立选择自己的 .xlsx 或 .xls 文件。',
  },
  {
    title: '进入对应 Bulk 页面',
    desc: '登录后进入 Event Management，并按区域点击 Released Bulk 或 Unreleased Bulk。',
  },
  {
    title: '并行执行',
    desc: '多个自动化任务可以同时运行，不会互相占用同一个执行锁。',
  },
] as const
