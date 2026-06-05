import { computed, ref, watch } from 'vue'

export type AppLanguage = 'zh-CN' | 'en-US'

const languageStorageKey = 'tos-app-language'
const defaultLanguage: AppLanguage = 'zh-CN'

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return defaultLanguage
  }

  const storedLanguage = window.localStorage.getItem(languageStorageKey)
  return storedLanguage === 'en-US' ? 'en-US' : defaultLanguage
}

const currentLanguage = ref<AppLanguage>(readStoredLanguage())

watch(currentLanguage, (language) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(languageStorageKey, language)
  }
})

const translations = {
  'app.sidebar.hide': {
    'zh-CN': '隐藏侧边栏',
    'en-US': 'Hide sidebar',
  },
  'app.sidebar.show': {
    'zh-CN': '显示侧边栏',
    'en-US': 'Show sidebar',
  },
  'app.diagnostics.export': {
    'zh-CN': '导出诊断包',
    'en-US': 'Export diagnostics',
  },
  'app.settings.language': {
    'zh-CN': '界面语言',
    'en-US': 'Language',
  },
  'app.settings.kicker': {
    'zh-CN': '应用',
    'en-US': 'Application',
  },
  'app.settings.title': {
    'zh-CN': '版本与更新',
    'en-US': 'Version and Updates',
  },
  'app.settings.description': {
    'zh-CN': '当前安装版可从配置的更新源检查新版本，下载完成后会退出并安装新版。',
    'en-US': 'The installed app can check the configured update source and install the new version after download.',
  },
  'app.settings.currentVersion': {
    'zh-CN': '当前版本',
    'en-US': 'Current Version',
  },
  'app.settings.latestVersion': {
    'zh-CN': '最新版本',
    'en-US': 'Latest Version',
  },
  'app.settings.runMode': {
    'zh-CN': '运行模式',
    'en-US': 'Run Mode',
  },
  'app.settings.feedUrl': {
    'zh-CN': '更新源',
    'en-US': 'Update Source',
  },
  'app.home.kicker': {
    'zh-CN': 'TOS - 功能概览',
    'en-US': 'TOS - Overview',
  },
  'app.home.title': {
    'zh-CN': 'TOS 运营看板',
    'en-US': 'TOS Operations Dashboard',
  },
  'app.home.backendOnline': {
    'zh-CN': '后端在线',
    'en-US': 'Backend online',
  },
  'app.home.moduleStats': {
    'zh-CN': '模块统计',
    'en-US': 'Module statistics',
  },
  'app.home.shortcuts': {
    'zh-CN': '快捷入口',
    'en-US': 'Shortcuts',
  },
  'app.home.modules': {
    'zh-CN': '正式模块与测试模块',
    'en-US': 'Production and validation modules',
  },
  'app.home.serviceStatus': {
    'zh-CN': '服务状态',
    'en-US': 'Service status',
  },
  'app.home.runtime': {
    'zh-CN': '运行概况',
    'en-US': 'Runtime overview',
  },
  'app.home.metricExcel': {
    'zh-CN': 'Excel 处理',
    'en-US': 'Excel Processing',
  },
  'app.home.metricExcelDetail': {
    'zh-CN': '对账核对-Sophia / 报表合并-Sophia / Jane-表格制作 / Eric',
    'en-US': 'Reconciliation / Report Merge / Jane Table Making / Eric',
  },
  'app.home.metricCollector': {
    'zh-CN': '正式采集',
    'en-US': 'Production Collection',
  },
  'app.home.metricCollectorDetail': {
    'zh-CN': 'adidas Materials',
    'en-US': 'adidas Materials',
  },
  'app.home.metricTesting': {
    'zh-CN': '测试模块',
    'en-US': 'Validation Modules',
  },
  'app.home.serviceBackend': {
    'zh-CN': 'Python 后端',
    'en-US': 'Python Backend',
  },
  'app.home.serviceBackendDesc': {
    'zh-CN': '本地业务服务',
    'en-US': 'Local business service',
  },
  'app.home.serviceBackendStatus': {
    'zh-CN': '运行中',
    'en-US': 'Running',
  },
  'app.home.serviceDiagnostics': {
    'zh-CN': '诊断日志',
    'en-US': 'Diagnostics',
  },
  'app.home.serviceDiagnosticsDesc': {
    'zh-CN': '当前会话与模块运行记录',
    'en-US': 'Current session and module records',
  },
  'app.home.serviceDiagnosticsStatus': {
    'zh-CN': '可导出',
    'en-US': 'Exportable',
  },
  'app.home.serviceAutomation': {
    'zh-CN': '浏览器自动化',
    'en-US': 'Browser Automation',
  },
  'app.home.serviceAutomationDesc': {
    'zh-CN': '浏览器插件 / 网页自动化',
    'en-US': 'Browser plugins / Web automation',
  },
  'app.home.serviceAutomationStatus': {
    'zh-CN': '业务验证中',
    'en-US': 'Validating',
  },
  'app.home.serviceFiles': {
    'zh-CN': '文件准备',
    'en-US': 'File Preparation',
  },
  'app.home.serviceFilesDesc': {
    'zh-CN': 'Excel 模块默认入口',
    'en-US': 'Default Excel module entry',
  },
  'app.home.serviceFilesStatus': {
    'zh-CN': '对账核对-Sophia',
    'en-US': 'Reconciliation',
  },
  'app.module.open': {
    'zh-CN': '打开',
    'en-US': 'Open',
  },
} as const

export type TranslationKey = keyof typeof translations

const staticTextTranslations: Record<string, string> = {
  首页: 'Home',
  '对账核对-Sophia': 'Reconciliation-Sophia',
  '报表合并-Sophia': 'Report Merge-Sophia',
  成品表生成: 'Finished Goods Sheet',
  'Jane-BOM汇总': 'Jane BOM Summary',
  'Jane-BOM核对': 'Jane BOM Compare',
  'Jane-OUTBOUND核对': 'Jane OUTBOUND Compare',
  'Jane-表格制作': 'Jane Table Making',
  Eric数据处理: 'Eric Data Processing',
  系统设置: 'Settings',
  应用: 'Application',
  文件准备: 'File Preparation',
  文件预检查: 'File Precheck',
  必传: 'Required',
  '支持 .xls / .xlsx': 'Supports .xls / .xlsx',
  '支持 .xlsx': 'Supports .xlsx',
  '支持 .xlsx / .xlsm': 'Supports .xlsx / .xlsm',
  '支持 .xls / .xlsx / .xlsm': 'Supports .xls / .xlsx / .xlsm',
  '可多选，支持 .xls / .xlsx': 'Multiple files allowed. Supports .xls / .xlsx',
  '可多选，支持 .xlsx / .xlsm': 'Multiple files allowed. Supports .xlsx / .xlsm',
  点击或拖入文件: 'Click or drop files',
  移除文件: 'Remove file',
  必传文件未上传: 'Required file is missing',
  '该位置只允许上传 1 个文件': 'Only 1 file is allowed here',
  暂未上传文件: 'No file uploaded',
  '请先补齐必传文件，再开始处理。': 'Upload all required files before processing.',
  '必传文件已就绪，可以开始处理。': 'Required files are ready. You can start processing.',
  结果摘要: 'Result Summary',
  处理完成: 'Completed',
  处理失败: 'Failed',
  处理状态: 'Status',
  成功: 'Success',
  失败: 'Failed',
  处理中: 'Processing',
  待处理: 'Pending',
  已生成: 'Generated',
  可下载: 'Downloadable',
  未生成: 'Not generated',
  已上传: 'Uploaded',
  未上传: 'Not uploaded',
  已按筛选条件处理: 'Processed with filters',
  可导出诊断包发给开发排查: 'Export a diagnostics package for troubleshooting',
  处理记录: 'History',
  '最近 20 次本机处理记录。': 'Last 20 local processing records.',
  清空: 'Clear',
  暂无处理记录: 'No processing records',
  发票文件: 'Invoice Files',
  '发票文件（可多选）': 'Invoice Files (multiple)',
  参考表文件: 'Reference File',
  TMS文件: 'TMS Files',
  'TMS 文件': 'TMS Files',
  'TMS 文件（可多选）': 'TMS Files (multiple)',
  Article文件: 'Article Files',
  'Article 文件': 'Article Files',
  'Article 文件（可多选）': 'Article Files (multiple)',
  'Factory Price 文件': 'Factory Price Files',
  'Factory Price 文件（可多选）': 'Factory Price Files (multiple)',
  'Pack 文件': 'Pack Files',
  'Pack 文件（可多选）': 'Pack Files (multiple)',
  客户文件: 'Customer File',
  'Copy of TMS': 'Copy of TMS',
  country文件: 'country.xlsx',
  'T1 PRODUCTION 文件': 'T1 PRODUCTION File',
  'T1 OUTBOUND 文件': 'T1 OUTBOUND File',
  'TMS Released Order 文件': 'Copy of TMS',
  'BOM 文件': 'BOM Files',
  'BOM 文件（可多选）': 'BOM Files (multiple)',
  'BOM汇总 文件': 'BOM Summary File',
  结果文件: 'Result File',
  商品总数: 'Total Items',
  匹配统计: 'Match Count',
  'Result 明细': 'Result Details',
  诊断记录: 'Diagnostics',
  '已处理 BOM': 'Processed BOMs',
  已处理BOM: 'Processed BOMs',
  BOM汇总文件: 'BOM Summary File',
  BOM有效行: 'BOM Valid Rows',
  BOM汇总有效行: 'BOM Summary Valid Rows',
  只统计MAINCOMPONENT下的源行: 'Only counts source rows under MAIN COMPONENT',
  '只统计 MAIN COMPONENT 下的源行': 'Only counts source rows under MAIN COMPONENT',
  '只统计 BOM汇总 中可核对的有效行': 'Only counts comparable valid rows in the BOM summary',
  汇总行数: 'Summary Rows',
  已核对行数: 'Checked Rows',
  匹配行数: 'Matched Rows',
  TMS缺失行: 'Missing TMS Rows',
  OUTBOUND缺失行: 'Missing OUTBOUND Rows',
  红色单元格: 'Red Cells',
  新增缺失行: 'Added Missing Rows',
  无对应BOM行: 'Rows Without Matching BOM',
  不含新增缺失行的整行标红: 'Excludes fully red added missing rows',
  差异明细: 'Difference Details',
  源文件: 'Source Files',
  'Final_Data 行数': 'Final_Data Rows',
  差异项: 'Differences',
  生成FinalData: 'Generate Final_Data',
  '生成 Final_Data': 'Generate Final_Data',
  解析YTIC: 'Parse YTIC',
  '解析 YTIC': 'Parse YTIC',
  自动核对: 'Auto Reconcile',
  诊断包: 'Diagnostics Package',
  'Excel 处理': 'Excel Processing',
  'Excel数据处理整合工具-Eric': 'Excel Data Processing Tool - Eric',
  '核对流程 v0.2.0-alpha.1': 'Reconciliation Flow v0.2.0-alpha.1',
  '将 Pack Size breakdown 生成的 Final_Data 作为过渡明细，并自动解析 YTIC check 完成最终数量核对。':
    'Generate Final_Data from Pack Size breakdown, then parse YTIC check automatically for final quantity reconciliation.',
  '默认流程会输出诊断包：Summary、Size_Check、PO_Check、Final_Data 和 YTIC 审计明细。':
    'The default flow outputs a diagnostics package: Summary, Size_Check, PO_Check, Final_Data, and YTIC audit details.',
  '用于生成 Final_Data': 'Used to generate Final_Data',
  用于提取尺寸目的地和SP核对信息: 'Used to extract size, destination, and SP checks',
  '用于提取尺寸、目的地和 SP 核对信息': 'Used to extract size, destination, and SP checks',
  开始核对: 'Start Reconcile',
  仅生成FinalData: 'Generate Final_Data Only',
  '仅生成 Final_Data': 'Generate Final_Data Only',
  下载结果: 'Download Result',
  处理记录会显示在这里: 'Processing logs will appear here.',
  '处理记录会显示在这里。': 'Processing logs will appear here.',
  上传进度: 'Upload Progress',
  开始处理: 'Start',
  处理中点点点: 'Processing...',
  '处理中...': 'Processing...',
  重置: 'Reset',
  请先按预检查提示补齐文件: 'Complete the file precheck before processing',
  请先按预检查提示补齐四类文件: 'Complete all four file groups before processing',
  处理失败请重试: 'Processing failed. Please try again.',
  '处理失败，请重试': 'Processing failed. Please try again.',
  '上传一张或多张发票文件。': 'Upload one or more invoice files.',
  '上传 1 个参考表文件。': 'Upload one reference file.',
  'Jessca 发票文件与参考表自动核对，输出价格差异和缺失款号整理结果。':
    'Automatically compare Jessca invoice files with the reference file and export price differences and missing style cleanup.',
  发票价格与参考表核对: 'Invoice price and reference file reconciliation',
  '处理前会检查必传文件是否齐全。': 'Required files are checked before processing.',
  '输出价格差异和缺失款号整理结果。': 'Outputs price differences and missing style cleanup results.',
  'Sophia & Tina 多类 Excel 文件统一合并，自动生成分析报表。':
    'Merge multiple Sophia & Tina Excel file types and generate analysis reports automatically.',
  '上传一个或多个 TMS 文件。': 'Upload one or more TMS files.',
  '上传一个或多个 Article 文件。': 'Upload one or more Article files.',
  '上传一个或多个 Factory Price 文件。': 'Upload one or more Factory Price files.',
  '上传一个或多个 Pack 文件。': 'Upload one or more Pack files.',
  多类Excel文件统一合并: 'Merge multiple Excel file types',
  '多类 Excel 文件统一合并': 'Merge multiple Excel file types',
  '四类文件都需要至少上传 1 个。': 'Each of the four file groups requires at least one file.',
  '输出合并后的 Sophia & Tina 分析报表。': 'Exports the merged Sophia & Tina analysis report.',
  '上传客户文件和 country.xlsx 后自动生成标准成品表。':
    'Upload Copy of TMS and country.xlsx to generate the standard finished goods sheet.',
  '上传 Copy of TMS 和 country.xlsx 后自动生成标准成品表。':
    'Upload Copy of TMS and country.xlsx to generate the standard finished goods sheet.',
  '上传 1 个客户原始文件。': 'Upload one Copy of TMS file.',
  '上传 1 个 Copy of TMS 文件。': 'Upload one Copy of TMS file.',
  '上传用于国家/区域单别统计的 country.xlsx。':
    'Upload country.xlsx for country/region order statistics.',
  'Working Number 筛选（可选）': 'Working Number Filter (optional)',
  多个WorkingNumber用英文逗号分隔: 'Separate multiple Working Numbers with commas',
  '多个 Working Number 用英文逗号分隔': 'Separate multiple Working Numbers with commas',
  客户文件生成标准成品表: 'Generate standard finished goods sheet from Copy of TMS',
  'Copy of TMS 生成标准成品表': 'Generate standard finished goods sheet from Copy of TMS',
  '只上传 1 个，支持 .xls / .xlsx': 'Upload exactly 1 file, supports .xls / .xlsx',
  '只上传 1 个，仅支持 .xlsx': 'Upload exactly 1 file, supports .xlsx only',
  'Working Number 筛选为可选项，多个值用英文逗号分隔。':
    'Working Number filter is optional. Separate multiple values with commas.',
  '输出标准成品表和对应统计结果。': 'Exports the standard finished goods sheet and statistics.',
  '上传多个 BOM 文件和 Pack.xlsx，按 Working # + Season 匹配 Pack，并生成 MAIN COMPONENT 汇总表。':
    'Upload multiple BOM files and Pack.xlsx, match Pack by Working # + Season, and generate the MAIN COMPONENT summary.',
  '上传一个或多个 BOM 文件，支持 .xlsx / .xlsm。': 'Upload one or more BOM files. Supports .xlsx / .xlsm.',
  '上传包含 Pack、Season、Working Number 的 Pack 文件。':
    'Upload a Pack file containing Pack, Season, and Working Number.',
  'BOM MAIN COMPONENT 汇总': 'BOM MAIN COMPONENT Summary',
  '只上传 1 个，需包含 Pack、Season、Working Number':
    'Upload exactly 1 file. Must include Pack, Season, and Working Number.',
  '按 Working # + Season 匹配 Pack.xlsx。若 Pack 映射冲突会终止处理。':
    'Matches Pack.xlsx by Working # + Season. Processing stops if Pack mappings conflict.',
  '当前只汇总 BOM 里的 MAIN COMPONENT 物料，并按 Article/Color 展开。':
    'Only MAIN COMPONENT materials are summarized and expanded by Article/Color.',
  '上传 T1 PRODUCTION.xlsx 和多个 BOM 文件，按 Style ID + Recording Facility ID 核对 MAIN COMPONENT 面料并标红差异。':
    'Upload T1 PRODUCTION.xlsx and BOM files, compare MAIN COMPONENT materials by Style ID + Recording Facility ID, and mark differences in red.',
  '上传 T1 PRODUCTION.xlsx 和 BOM汇总.xlsx，按 Style ID + Recording Facility ID 核对面料并标红差异。':
    'Upload T1 PRODUCTION.xlsx and BOM Summary.xlsx, compare materials by Style ID + Recording Facility ID, and mark differences in red.',
  '上传 1 个 T1 PRODUCTION.xlsx，输出会保留原表样式并标红差异。':
    'Upload one T1 PRODUCTION.xlsx. The output keeps the original sheet styling and marks differences in red.',
  '上传 1 个 Jane-BOM汇总 生成的 BOM汇总.xlsx。':
    'Upload one BOM Summary.xlsx generated by Jane BOM Summary.',
  'T1 PRODUCTION 与 BOM 面料核对': 'T1 PRODUCTION and BOM Material Check',
  'T1 PRODUCTION 与 BOM汇总 面料核对': 'T1 PRODUCTION and BOM Summary Material Check',
  '只上传 1 个，支持 .xlsx / .xlsm': 'Upload exactly 1 file, supports .xlsx / .xlsm',
  '按 Style ID + Recording Facility ID 匹配 BOM 的 Article + Factory。':
    'Match BOM Article + Factory by Style ID + Recording Facility ID.',
  '按 Style ID + Recording Facility ID 匹配 BOM汇总 的 Articles + Factory。':
    'Match BOM Summary Articles + Factory by Style ID + Recording Facility ID.',
  '材料号或供应商不一致会标红；BOM 有但生产表缺少的材料会追加红色行。':
    'Material or supplier mismatches are marked in red; BOM materials missing from the production sheet are appended as red rows.',
  '材料号或供应商不一致会标红；BOM汇总 有但生产表缺少的材料会写入诊断。':
    'Material or supplier mismatches are marked in red; BOM summary materials missing from the production sheet are written to diagnostics.',
  '上传 T1 OUTBOUND.xlsx 和 TMS Released Order 报表，按 Style/PO/Line/Factory 核对数量、PODD 和 Working Number。':
    'Upload T1 OUTBOUND.xlsx and Copy of TMS, then compare quantity, PODD, and Working Number by Style/PO/Line/Factory.',
  '上传 T1 OUTBOUND.xlsx 和 Copy of TMS 报表，按 Style/PO/Line/Factory 核对数量、PODD 和 Working Number。':
    'Upload T1 OUTBOUND.xlsx and Copy of TMS, then compare quantity, PODD, and Working Number by Style/PO/Line/Factory.',
  '上传 1 个 T1 OUTBOUND.xlsx，输出会保留原表样式并标红差异。':
    'Upload one T1 OUTBOUND.xlsx. The output keeps the original sheet styling and marks differences in red.',
  '上传 1 个包含 Result Set 的 TMS Released Order 报表。':
    'Upload one Copy of TMS report containing Result Set.',
  '上传 1 个包含 Result Set 的 Copy of TMS 报表。':
    'Upload one Copy of TMS report containing Result Set.',
  'T1 OUTBOUND 与 TMS 出库核对': 'T1 OUTBOUND and TMS Outbound Check',
  '只上传 1 个，需包含 Result Set': 'Upload exactly 1 file. Must contain Result Set.',
  '按 Style Number + PO Number + Line Number + Recording Facility ID 匹配 TMS。':
    'Match TMS by Style Number + PO Number + Line Number + Recording Facility ID.',
  'TMS 会先按 T1 的 Working Number 范围过滤，避免全量报表无关订单进入结果。':
    'TMS rows are first filtered by Working Numbers present in T1 to avoid unrelated full-report orders entering the result.',
  '数量、PODD 或 Working Number 不一致会标红，并输出 OUTBOUND_Check 明细表。':
    'Quantity, PODD, or Working Number differences are marked in red and exported to OUTBOUND_Check.',
  '先把 Pack Size breakdown 转成 PO / Article / Size / Quantity 明细。':
    'Convert Pack Size breakdown into PO / Article / Size / Quantity details.',
  '读取 YTIC check 的尺寸、目的地和 SP 信息，替代原宏的手工提取。':
    'Read size, destination, and SP data from YTIC check instead of manual macro extraction.',
  '按 PO Number1 + Article Number1 + Size 对比双方数量。':
    'Compare quantities by PO Number1 + Article Number1 + Size.',
  '输出 Summary、Size_Check、PO_Check 和审计明细表。':
    'Export Summary, Size_Check, PO_Check, and audit detail sheets.',
  请上传PackSizebreakdown文件: 'Upload a Pack Size breakdown file',
  '请上传 Pack Size breakdown 文件': 'Upload a Pack Size breakdown file',
  'Pack Size breakdown 仅支持 .xlsx / .xlsm': 'Pack Size breakdown only supports .xlsx / .xlsm',
  请上传YTICcheck文件: 'Upload a YTIC check file',
  '请上传 YTIC check 文件': 'Upload a YTIC check file',
  'YTIC check 仅支持 .xls / .xlsx / .xlsm': 'YTIC check only supports .xls / .xlsx / .xlsm',
  核对完成: 'Reconciliation completed',
  核对失败: 'Reconciliation failed',
  'Final_Data 生成完成': 'Final_Data generated',
  'Final_Data 生成失败': 'Final_Data generation failed',
  下载进度: 'Download Progress',
  正在准备下载信息: 'Preparing download information',
  更新日志: 'Changelog',
  本次版本变化: 'Changes in This Version',
  待检查: 'Not checked',
  新增: 'Added',
  优化: 'Improved',
  修复: 'Fixed',
  暂无记录: 'No records',
  发布说明: 'Release Notes',
  检查中: 'Checking',
  已是最新: 'Up to date',
  发现新版本: 'Update available',
  下载中: 'Downloading',
  可安装: 'Ready to install',
  安装中: 'Installing',
  更新异常: 'Update error',
  开发环境: 'Development',
  未配置: 'Not configured',
  环境变量: 'Environment variable',
  本地配置: 'Local config',
  打包配置: 'Package config',
  未读取: 'Not read',
  安装版: 'Installed',
  开发预览: 'Development / Preview',
  '开发/预览': 'Development / Preview',
  '检查中...': 'Checking...',
  检查更新: 'Check for Updates',
  '下载中...': 'Downloading...',
  下载更新: 'Download Update',
  备用下载: 'Backup Download',
  免安装版: 'No-install Version',
  下载免安装版: 'Download No-install Version',
  '打开中...': 'Opening...',
  已打开免安装版下载链接: 'No-install download link opened',
  '正在安装...': 'Installing...',
  立即安装并重启: 'Install and Restart',
  当前浏览器预览环境不支持应用更新: 'The browser preview environment does not support app updates',
  读取应用更新状态失败: 'Failed to read app update status',
  更新操作失败: 'Update operation failed',
  当前已经是最新版本: 'Already on the latest version',
  发现可用新版本: 'A new version is available',
  检查更新完成: 'Update check completed',
  更新包已下载完成: 'Update package downloaded',
  更新包开始下载: 'Update package download started',
  正在退出并安装更新: 'Exiting and installing update',
  '请先配置正式更新地址，再下载免安装版。': 'Configure the update source before downloading the no-install version.',
  '更新源暂未提供免安装版下载。': 'The update source has not provided a no-install download.',
  '更新源暂未提供 changelog.json': 'The update source has not provided changelog.json',
  检查到新版本后会显示新增优化和修复内容: 'Added, improved, and fixed items will appear after a new version is found',
  '检查到新版本后会显示新增、优化和修复内容': 'Added, improved, and fixed items will appear after a new version is found',
  '侧边栏新增收起/展开能力，Excel、浏览器自动化和网页数据爬取支持分组折叠。':
    'The sidebar now supports hide/show, and Excel, Browser Automation, and Web Data Collection support collapsible groups.',
  'Excel 处理下新增 Jane-表格制作分组，统一收纳成品表生成和 Jane-BOM汇总。':
    'Added the Jane Table Making group under Excel Processing for Finished Goods Sheet and Jane BOM Summary.',
  '系统设置新增界面语言切换，支持中文和 English。':
    'Settings now includes a language switch for Chinese and English.',
  'Jane 新增 BOM 汇总子模块，支持上传多个 BOM 文件和 Pack.xlsx，并按 Working # + Season 生成 MAIN COMPONENT 汇总表。':
    'Jane adds a BOM Summary module supporting multiple BOM files and Pack.xlsx to generate MAIN COMPONENT summaries by Working # + Season.',
  'Eric 模块新增 PO_Text_Compare 工作表，用文本方式对比 YTIC_Destination_Extract 的 CUSTOMER PO NUMBER 和 Final_Data 的 PO Number。':
    'Eric adds PO_Text_Compare to compare YTIC_Destination_Extract CUSTOMER PO NUMBER and Final_Data PO Number as text.',
  '版本号在系统设置中统一显示为大写 V 前缀，避免侧边栏和底栏出现冗余信息。':
    'Version numbers are shown in Settings with an uppercase V prefix, avoiding redundant sidebar or footer information.',
  '移除 Electron 默认菜单栏，主窗口保留应用自有导航和操作区。':
    'Removed the default Electron menu bar and kept the app-owned navigation and action areas.',
  '发布构建会自动重建后端 runtime，确保安装包使用最新后端逻辑。':
    'Release builds rebuild the backend runtime so the installer uses the latest backend logic.',
  'Eric 核对结果只保留 Size_Check、Final_Data、YTIC_Destination_Extract、YTIC_SP_Extract 和 PO_Text_Compare，减少无关工作表。':
    'Eric output keeps only Size_Check, Final_Data, YTIC_Destination_Extract, YTIC_SP_Extract, and PO_Text_Compare.',
  'Eric 的 Size_Check、YTIC_Destination_Extract 和 YTIC_SP_Extract 差值列改为 Excel 公式，方便打开文件后复核和追踪。':
    'Eric difference columns in Size_Check, YTIC_Destination_Extract, and YTIC_SP_Extract now use Excel formulas.',
  'Eric 的 YTIC_Destination_Extract 目的地匹配列改为 TRUE/FALSE 布尔值。':
    'Eric destination match columns in YTIC_Destination_Extract now use TRUE/FALSE booleans.',
  'Jane 成品表 Sub. Total 行的 PO QTY 改为纵向汇总本列数据行。':
    'Jane finished goods Sub. Total PO QTY now sums the current column vertically.',
  '修复发布包优先运行旧 backend-runtime，导致后端模块修改未在 TOS.exe 中生效的问题。':
    'Fixed release packages preferring stale backend-runtime so backend module changes did not take effect in TOS.exe.',
  '修复 Eric 核对结果中 YTIC_SP_Extract 补充行字段错位的问题。':
    'Fixed field misalignment in Eric YTIC_SP_Extract supplemental rows.',
  '修复 Eric 核对结果中 YTIC 目的地、尺码和 Final_Data 对比顺序不便核对的问题。':
    'Fixed Eric comparison ordering for YTIC destination, size, and Final_Data.',
  '修复 Eric Size_Check 仍输出 Status 列且差值不是公式的问题。':
    'Fixed Eric Size_Check still outputting Status and non-formula differences.',
  '修复 Jane 成品表分组小计中 PO QTY 横向求和导致总数不正确的问题。':
    'Fixed Jane finished goods group subtotals summing PO QTY horizontally.',
}

export function setAppLanguage(language: AppLanguage): void {
  currentLanguage.value = language
}

export function translateText(key: TranslationKey, language = currentLanguage.value): string {
  return translations[key][language]
}

export function translateStaticText(value: string, language = currentLanguage.value): string {
  if (language === 'zh-CN' || !value) {
    return value
  }

  const normalized = value.replace(/\s+/g, '').replace(/[，。]/g, '')
  const directTranslation = staticTextTranslations[value] ?? staticTextTranslations[normalized]
  if (directTranslation) {
    return directTranslation
  }

  const fileCountMatch = value.match(/^(\d+) 个文件已选择$/)
  if (fileCountMatch) {
    return `${fileCountMatch[1]} files selected`
  }

  const fileReadyMatch = value.match(/^(\d+) 个文件已就绪$/)
  if (fileReadyMatch) {
    return `${fileReadyMatch[1]} files ready`
  }

  const expectedCountMatch = value.match(/^应上传 (\d+) 个文件$/)
  if (expectedCountMatch) {
    return `Expected ${expectedCountMatch[1]} files`
  }

  const extraFilesMatch = value.match(/^\+(\d+) 个文件$/)
  if (extraFilesMatch) {
    return `+${extraFilesMatch[1]} files`
  }

  const labeledValueMatch = value.match(/^([^:：]+)([:：]\s*)(.+)$/)
  if (labeledValueMatch) {
    const translatedLabel = translateStaticText(labeledValueMatch[1], language)
    return `${translatedLabel}: ${labeledValueMatch[3]}`
  }

  return value
}

export function useAppLanguage() {
  const languageOptions = computed(() => [
    { value: 'zh-CN', label: currentLanguage.value === 'en-US' ? 'Chinese' : '中文' },
    { value: 'en-US', label: 'English' },
  ] as const)

  return {
    currentLanguage,
    languageOptions,
    isEnglish: computed(() => currentLanguage.value === 'en-US'),
    setAppLanguage,
    t: translateText,
    text: translateStaticText,
  }
}
