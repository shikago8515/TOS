import { describe, expect, it } from 'vitest'

import { translateStaticText } from './appLanguage'

describe('appLanguage', () => {
  it('translates browser plugin page text in English mode', () => {
    const phrases = [
      '浏览器插件管理',
      '浏览器预览模式',
      '搜索插件或站点',
      '刷新',
      '插件总数',
      '可启动',
      '预览模式',
      '当前为预览模式：可查看插件信息，启动需在桌面 Electron 环境中使用。',
      'Infornexus 自动搜索并添加',
      'Chrome 扩展',
      '预览配置',
      '在 Infornexus 页面读取 XLS/XLSX 的指定 ID，并自动执行搜索、勾选和添加操作。',
      '启动',
      '站点',
    ]

    for (const phrase of phrases) {
      expect(translateStaticText(phrase, 'en-US')).not.toBe(phrase)
    }
  })

  it('translates common upload and automation page text in English mode', () => {
    const phrases = [
      '释放文件',
      '不支持的文件格式：demo.txt',
      '只上传 1 个，支持 .xls / .xlsx',
      '只上传 1 个，仅支持 .xlsx',
      '只上传 1 个，需包含 Result Set',
      '文件上传',
      '处理进度',
      '网页自动化',
      '选择自动化入口，上传 Excel 并启动本地浏览器执行',
      '搜索入口名称或标签',
      '运行模式',
      '进入场景',
      '详情',
      '没有匹配的自动化入口',
      '请调整搜索条件，或联系管理员添加新的自动化场景。',
      'shipping自动化',
      'Infor Nexus 运输业务自动化',
      '上传 Excel 后启动可视浏览器，读取第二列 10 位 ID 并在 Infor Nexus 自动搜索、勾选和添加。',
      '搜索并添加 Infornexus ID',
      '本机执行器会读取 Excel 第二列 ID，登录 Infor Nexus 后自动搜索、勾选和添加。',
      '上传 Excel 并执行自动搜索添加',
      '待命',
      '未就绪',
      '执行中',
      '发送中',
      '未完成',
      '异常',
      '等待上传 Excel，并执行 Infornexus 自动搜索添加。',
      '本机执行器尚未就绪，请先启动执行器后再试。',
      '正在上传 Excel，并启动 Infornexus 自动搜索添加...',
      '本地执行失败，HTTP 500。',
      'Infornexus 自动搜索添加完成。已处理 2/3 个 ID。',
      '本地执行异常：网络错误',
      '2 组必传',
      '3 组必传 + 2 组可选',
      '选择 Bulk 类型',
      'Unreleased Bulk 和 released Bulk 会进入不同的浏览器自动化逻辑。',
      '等待选择 Excel 文件。',
      'demo.xlsx 已选择，等待启动。',
    ]

    for (const phrase of phrases) {
      expect(translateStaticText(phrase, 'en-US')).not.toBe(phrase)
    }
  })

  it('translates second-batch business page text in English mode', () => {
    const phrases = [
      'Copy of TMS + 国家区域统计 → 标准成品表',
      '上传国家/区域统计文件',
      'BOM汇总',
      '多 BOM 文件 + Pack 映射 → MAIN COMPONENT 汇总',
      'BOM核对',
      'T1 PRODUCTION × BOM汇总 → 面料差异核对',
      'OUTBOUND核对',
      'T1 OUTBOUND × TMS 报表 → 出库差异核对',
      '核对进度',
      '输出会保留原表样式并标红差异',
      'BOM汇总 生成的汇总文件',
      '包含 Result Set 的 TMS 报表',
      'SAP BTP 自动化流程',
      'TMS财务表格数据处理',
      'Sample/Bulk 来源文件 → 内销对账大表尾部追加',
      'BULK Sales 导出表 → TURNOVER Turnover Details 尾部追加',
      '追加进度',
      '追加中...',
      'BULK Sales 导出表',
      '上传从 iPlex 导出的 bulk sales 表，系统会读取对应列追加到 TURNOVER',
      'TURNOVER 目标表',
      '上传要追加 Turnover Details 明细的 TURNOVER 工作簿',
      'Sample/Bulk 来源文件',
      '可一次上传多个合并Sample、合并BULK工作簿，按上传顺序追加缺失行',
      '内销对账单',
      '上传要追加缺失数据的内销对账大表',
      '外部 Electron 子应用',
      '刷新状态',
      '启动应用',
      '模块详情',
      '基本信息',
      '模块 ID',
      '模块名称',
      '接入方式',
      '部署信息',
      '入口文件',
      '运行状态',
      '备注',
      '部署时请保留完整运行时目录',
      '当前状态',
      'Electron 子应用',
      '已检测到 Infornexus 外部应用。',
      '未找到 Infornexus 整包，请确认 external-apps/infornexus 目录完整。',
      '读取状态失败',
      'Infornexus 已启动。',
      '启动失败',
      '未读取',
      '整包缺失',
      '网页数据爬取',
      'adidas 材料数据收集器',
      '通过外部浏览器登录后自动监听 Materials 接口，批量采集并本地落盘。',
      '打开外部浏览器',
      '操作提示',
      '运行流程',
      '采集方式',
      '浏览器监听',
      '外部 Edge/Chrome 登录后监听 Materials 接口响应',
      '保存策略',
      '自动落盘',
      '默认每 2000 条保存 JSON 与 CSV 双格式',
      '恢复能力',
      '断点续传',
      '本地保存去重 ID 与待保存批次，支持恢复',
      '采集器运行在外部浏览器窗口中，不会在主应用里直接请求 adidas 页面。',
      '登录入口、账号权限和 Materials 列表页路径都按业务实际操作为准。',
      '采集结束前先保存当前批次，避免剩余数据只在内存里。',
      '打开外部 Edge/Chrome，在右侧"网页地址"输入登录入口并前往',
      '在外部浏览器里完成账号登录，并按正常路径进入 Materials 列表页',
      '进入 Materials 列表页，确认右上角显示"接口捕获：已启用"',
      '点击"获取当前页"或"开始自动翻页"',
      '结束前点击"保存当前批次"，避免剩余数据未落盘',
      '打开 adidas 外部浏览器失败',
      'adidas 外部浏览器已在运行',
      'adidas 外部浏览器已打开',
      '内销对账表数据提取',
      'Work Sales 数据追加',
      '来源提取行',
      'Sample 行',
      'Bulk 行',
      '重复跳过',
      '相似已追加',
      '目标处理行',
      '排除行',
      '排除列',
      'QTY 合计',
      'Purchase 合计',
      'Sales 含税合计',
      '诊断项',
      '源行',
      'Sales 追加',
      'Purchase 追加',
      'Infornexus 子应用',
      '当前运行环境不支持外部子应用管理',
      '当前运行环境不支持启动外部子应用',
      '本机后台启动器版本过旧，缺少 adidas 网页端启动接口。请重启或更新后台启动器后再试。',
      '无法一键启动本机后台启动器。请确认已安装新版 TOS，且浏览器允许打开 tos://automation/launcher/start。',
      '本机启动器请求失败，HTTP 500',
    ]

    for (const phrase of phrases) {
      const translated = translateStaticText(phrase, 'en-US')

      expect(translated).not.toBe(phrase)
      expect(translated).not.toMatch(/[\u4e00-\u9fff]/)
    }
  })

  it('translates settings, system menu, and release update page text in English mode', () => {
    const phrases = [
      '系统',
      '版本更新记录',
      '查看每次更新影响的页面和内容',
      '语言、版本更新与自动化助手',
      '更新管理中心',
      '检查、下载与安装桌面客户端更新',
      '下载中',
      '检查更新',
      '下载更新',
      '安装中...',
      '安装并重启',
      '免安装版',
      '桌面客户端更新',
      '当前运行在服务器 / 浏览器环境，桌面客户端会显示自动更新能力。',
      '自动化助手安装包',
      '新用户安装后即可在浏览器页面启动本机自动化助手。',
      '下载安装包',
      '版本与环境',
      '已打开自动化助手安装包下载。',
      '自动化助手安装包下载失败',
      '探索我们每一次的演进：功能迭代、页面优化与系统修复。',
      '刷新记录',
      '总计记录数',
      '涉及页面',
      '最新版本',
      '暂无相关记录',
      '当前筛选条件下没有找到版本更新日志。',
      '本次更新带来了一些性能提升与细节优化。',
      '全局通用',
      '获取版本记录失败，请检查网络后重试。',
      '本地版本说明',
      '后端未连接，当前显示本地版本说明。',
      '无法连接后端服务',
      '版本更新记录页本地 fallback 支持展示内置历史版本记录。',
      '修复 Draft & Packing List 核对结果中 Goods Description 误带入 PDF 免责声明和页码的问题。',
      '修复版本更新记录页在浏览器模式且后端未启动时显示 Failed to fetch 的问题，改为展示本地版本说明。',
    ]

    for (const phrase of phrases) {
      const translated = translateStaticText(phrase, 'en-US')

      expect(translated).not.toBe(phrase)
      expect(translated).not.toMatch(/[\u4e00-\u9fff]/)
    }
  })
})
