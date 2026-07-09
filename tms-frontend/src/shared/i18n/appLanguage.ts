import { computed, ref, watch } from 'vue'

import { useGlobalStore } from '../../app/stores/globalStore'
import {
  appLanguageToKoiLanguage,
  koiLanguageToAppLanguage,
  normalizeKoiLanguage,
  type KoiLanguage,
} from '../../languages/language'

export type AppLanguage = 'zh-CN' | 'en-US'

const languageStorageKey = 'tos-app-language'
const globalStorageKey = 'tos:global'
const defaultLanguage: AppLanguage = 'zh-CN'

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return defaultLanguage
  }

  try {
    const storedGlobal = window.localStorage.getItem(globalStorageKey)
    if (storedGlobal) {
      const parsed = JSON.parse(storedGlobal) as { language?: unknown }
      return koiLanguageToAppLanguage(normalizeKoiLanguage(parsed.language))
    }

    const storedLanguage = window.localStorage.getItem(languageStorageKey)
    return storedLanguage === 'en-US' ? 'en-US' : defaultLanguage
  } catch (_error) {
    return defaultLanguage
  }
}

const currentLanguage = ref<AppLanguage>(readStoredLanguage())

watch(currentLanguage, (language) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(languageStorageKey, language)
    } catch (_error) {
      // Keep language changes in memory when localStorage is blocked or unavailable.
    }
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
    'zh-CN': '查看当前版本、运行环境和界面语言；桌面客户端会额外显示安装包更新能力。',
    'en-US': 'View the current version, run mode, and language; the desktop client also shows installer update controls.',
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
    'zh-CN': 'jessica - Invoice 核对 / Sophia - 报表合并 / Jane - 表格制作 / Eric',
    'en-US': 'Invoice Compare / Report Merge / Jane Table Making / Eric',
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
    'zh-CN': '网页自动化 / Infornexus',
    'en-US': 'Web automation / Infornexus',
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
    'zh-CN': 'jessica - Invoice 核对',
    'en-US': 'Invoice Compare',
  },
  'app.module.open': {
    'zh-CN': '打开',
    'en-US': 'Open',
  },
} as const

export type TranslationKey = keyof typeof translations

function normalizeStaticText(value: string): string {
  return value.replace(/\s+/g, '').replace(/[，。、。]/g, '')
}

const staticTextTranslations: Record<string, string> = {
  首页: 'Home',
  'TMS 工作站': 'TMS Workstation',
  'TOS 工作台': 'TOS Workstation',
  原产地: 'Origin',
  自动填写: 'Auto fill',
  不填写: 'Off',
  开: 'On',
  关: 'Off',
  例如: 'Example',
  数据处理: 'Data Processing',
  'TOS 运营看板': 'TOS Operations Dashboard',
  '数据核对、报表制作、浏览器自动化与通用工具，一站式工作台。':
    'Data comparison, report preparation, browser automation, and general tools in one workstation.',
  今日人员处理看板: 'Today by Person',
  '按左侧人员分组汇总今天的处理记录、失败事项和最近产物。':
    'Summarize today\'s processing records, failures, and recent outputs by the people groups in the left navigation.',
  最后刷新: 'Last refreshed',
  未刷新: 'Not refreshed',
  今日处理: 'Today\'s Runs',
  来自自动化记录与本地处理历史: 'From automation runs and local processing history',
  今日成功: 'Succeeded Today',
  已完成的处理记录: 'Completed processing records',
  失败待处理: 'Failures to Review',
  需要查看错误详情: 'Error details need review',
  今日暂无失败记录: 'No failed records today',
  参与人员: 'Active People',
  今日已有处理的人数: 'People with records today',
  人员今日动态: 'Today by Person',
  谁今天使用了系统处理了哪些内容: 'Who used the system today and what they processed',
  '谁今天使用了系统、处理了哪些内容。': 'Who used the system today and what they processed.',
  人: 'people',
  最近: 'Latest',
  今日暂无处理: 'No processing today',
  可用模块: 'Available modules',
  未开始: 'Not started',
  次: 'runs',
  正常: 'Normal',
  '版本、更新、语言和运行环境': 'Version, updates, language, and runtime',
  最近处理: 'Recent Processing',
  展示自动化记录和本地Excel处理历史: 'Shows automation records and local Excel processing history',
  '展示自动化记录和本地 Excel 处理历史。': 'Shows automation records and local Excel processing history.',
  运行与产物: 'Runtime and Outputs',
  关注记录读取本地缓存和最近输出文件: 'Monitor record loading, local cache, and recent output files',
  '关注记录读取、本地缓存和最近输出文件。': 'Monitor record loading, local cache, and recent output files.',
  自动化记录: 'Automation record',
  本地处理历史: 'Local history',
  条最近记录: 'recent records',
  读取失败: 'Read failed',
  可读取: 'Readable',
  条本机记录: 'local records',
  条数据库记录: 'database records',
  本机缓存: 'Local cache',
  集中维护各自动化页面模板: 'Manage templates for automation pages in one place',
  可维护: 'Manageable',
  最近结果文件: 'Recent Output Files',
  暂无输出文件: 'No output files',
  待确认: 'Pending',
  未知时间: 'Unknown time',
  通用工具: 'General Tools',
  正式模块与测试模块: 'Production and Validation Modules',
  切换视图: 'Switch View',
  正式模块: 'Production',
  测试模块: 'Validation',
  测试阶段: 'Validation Stage',
  杰西卡: 'Jessica',
  索菲: 'Sophia',
  简: 'Jane',
  埃里克: 'Eric',
  杰森: 'Jason',
  露西亚: 'Lucia',
  '杰西卡 / 索菲 / 简 / 埃里克 / 杰森 / 露西亚': 'Jessica / Sophia / Jane / Eric / Jason / Lucia',
  较昨日: 'vs yesterday',
  所有已上线模块: 'All published modules',
  '网页自动化 / Infornexus / ...': 'Web automation / Infornexus / ...',
  系统健康度: 'System Health',
  所有服务运行正常: 'All services are running normally',
  运行概况: 'Runtime Overview',
  查看更多: 'View More',
  'Python 后端': 'Python Backend',
  本地业务服务: 'Local business service',
  诊断日志: 'Diagnostics',
  当前会话与模块运行记录: 'Current session and module records',
  可导出: 'Exportable',
  浏览器自动化: 'Browser Automation',
  '网页自动化 / Infornexus': 'Web automation / Infornexus',
  业务验证中: 'Validating',
  '2 组必传': '2 required groups',
  '2 张 Excel 必传': '2 Excel files required',
  '3 组必传 + 2 组可选': '3 required groups + 2 optional groups',
  '每类至少 1 份 PDF': 'At least 1 PDF per type',
  '产地证 × Packing List → 字段提取与上下对比 Excel':
    'Certificate of Origin x Packing List -> field extraction and vertical comparison Excel',
  Excel模块默认模板准备: 'Default Excel module template preparation',
  'Excel 模块默认模板准备': 'Default Excel module template preparation',
  有更新: 'Update',
  系统管理员: 'Administrator',
  自动化执行档案: 'Automation Run Archive',
  '查看执行批次、结果文件和失败说明': 'View run batches, result files, and failure details',
  Excel模板中心: 'Excel Template Center',
  'Excel 模板中心': 'Excel Template Center',
  维护各自动化页面使用的模板: 'Manage templates used by automation pages',
  未命名页面: 'Untitled Page',
  正在检查安装包版本: 'Checking installer version',
  安装包已是最新版本: 'Installer is up to date',
  发现安装包更新: 'Installer Update Available',
  已是最新版本: 'Already Up to Date',
  当前桌面端安装包版本已和服务器保持一致: 'The desktop installer version is already aligned with the server.',
  '当前桌面端安装包版本已和服务器保持一致。': 'The desktop installer version is already aligned with the server.',
  检查更新失败: 'Update Check Failed',
  无法连接服务器安装包版本清单请稍后再试: 'Unable to connect to the server installer manifest. Try again later.',
  '无法连接服务器安装包版本清单，请稍后再试。': 'Unable to connect to the server installer manifest. Try again later.',
  已开始下载安装包: 'Installer Download Started',
  下载安装包失败: 'Installer Download Failed',
  无法打开服务器安装包下载请检查网络或稍后重试: 'Unable to open the server installer download. Check the network or try again later.',
  '无法打开服务器安装包下载，请检查网络或稍后重试。':
    'Unable to open the server installer download. Check the network or try again later.',
  '统一查看各自动化页面的执行批次、上传文件、结果文件和失败说明。':
    'View run batches, uploads, result files, and failure details across automation pages.',
  '当前筛选': 'Current Filter',
  '全部页面': 'All Pages',
  '全部状态': 'All Statuses',
  'Run ID / 文件 / 错误说明': 'Run ID / File / Error',
  '查询': 'Search',
  '执行批次': 'Run Batches',
  '执行时间': 'Run Time',
  '自动化页面': 'Automation Page',
  '说明': 'Message',
  '耗时': 'Duration',
  '暂无执行记录': 'No run records',
  '第': 'Page',
  '页': '',
  '执行详情': 'Run Details',
  '读取中...': 'Loading...',
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  '无执行说明。': 'No run message.',
  '归档文件': 'Archived Files',
  '暂无归档文件': 'No archived files',
  '执行 JSON': 'Run JSON',
  '未选择执行记录': 'No Run Selected',
  '请在左侧列表中选择一条记录，以查看源文件、结果文件和错误详情。':
    'Select a run record on the left to view source files, result files, and error details.',
  '已取消': 'Canceled',
  '无法读取自动化执行记录，请确认本地后端和远程 MySQL 数据库连接正常。':
    'Unable to load automation run records. Confirm the local backend and remote MySQL connection are healthy.',
  '执行文件下载失败。': 'Run file download failed.',
  '集中维护每个自动化页面的 Excel 模板，替换后页面下载入口会同步使用最新模板。':
    'Manage Excel templates for each automation page. Download entries use the latest template after replacement.',
  '刷新模板': 'Refresh Templates',
  '先选择一个模板': 'Select a template first',
  '点击下方表格左侧小圆点后，再下载、替换或停用模板。':
    'Click the small dot on the left of a table row, then download, replace, or disable the template.',
  '新增模板': 'New Template',
  '显示停用': 'Show Disabled',
  '新模板显示名称': 'New template display name',
  '模板显示名称': 'Template display name',
  '选择新模板文件': 'Choose new template file',
  '选择文件替换当前模板': 'Choose a file to replace the current template',
  '选择模板文件': 'Choose template file',
  '选择文件替换': 'Choose replacement file',
  '创建模板': 'Create Template',
  '替换文件': 'Replace File',
  '保存名称': 'Save Name',
  '启用': 'Enable',
  '停用': 'Disable',
  '取消': 'Cancel',
  '模板清单': 'Template List',
  '选择': 'Select',
  '模板名称 & 类型': 'Template Name & Type',
  '更新时间': 'Updated At',
  '选择这个模板': 'Select this template',
  '已停用': 'Disabled',
  '启用中': 'Enabled',
  '暂无模板记录': 'No template records',
  '请先勾选模板，或点击新增模板': 'Select a template first, or click New Template',
  '请先选择 Excel 文件': 'Choose an Excel file first',
  '正在等待本机执行器健康检查...': 'Waiting for the local executor health check...',
  '文件已添加，无需重复上传。': 'File already added. No need to upload it again.',
  '已跳过非 Excel 文件。': 'Skipped non-Excel files.',
  '上传新的模板文件': 'Upload a new template file',
  '替换当前选中模板的文件': 'Replace the selected template file',
  'Excel 模板': 'Excel Template',
  '停用模板': 'Disable Template',
  '确定停用': 'Disable',
  '默认模板': 'Default Template',
  'Released Bulk 模板': 'Released Bulk Template',
  'Unreleased Bulk 模板': 'Unreleased Bulk Template',
  '请上传 .xlsx 或 .xls 文件。': 'Upload a .xlsx or .xls file.',
  '未检测到本机自动化助手': 'Local automation helper not detected',
  '未检测到本机自动化助手。': 'Local automation helper not detected.',
  '已触发，结果未确认。': 'Triggered; result not confirmed.',
  '已触发，未确认。': 'Triggered; result not confirmed.',
  '执行器未就绪。': 'Executor is not ready.',
  '本机执行器未就绪。': 'Local executor is not ready.',
  '执行完成。': 'Completed.',
  '请先启动 TOS 自动化助手，然后重新检测。': 'Start the TOS automation helper first, then check again.',
  '日志': 'Logs',
  '下载助手': 'Download Helper',
  '已尝试启动本机自动化助手。': 'Attempted to start the local automation helper.',
  '运行状态与连通性控制台': 'Runtime status and connectivity console',
  '执行器健康日志': 'Executor Health Logs',
  '执行器未连接': 'Executor Disconnected',
  '执行器已启动。': 'Executor started.',
  '执行器已停止。': 'Executor stopped.',
  '执行器已在运行。': 'Executor is already running.',
  '重新检测': 'Recheck',
  '状态已刷新。': 'Status refreshed.',
  '原始响应': 'Raw Response',
  '本机自动化助手已连接，执行器尚未启动。': 'Local automation helper is connected; the executor has not started.',
  '清除': 'Clear',
  '停止失败': 'Stop failed',
  '停止执行器失败。': 'Failed to stop executor.',
  '暂无模板': 'No template',
  '后台执行器任务已结束，请查看执行记录或重新开始。':
    'The background executor task has ended. View run records or start again.',
  '后台下载任务已结束，请查看执行记录或重新开始。':
    'The background download task has ended. View run records or start again.',
  '后台下载任务已结束。': 'The background download task has ended.',
  '模板加载中...': 'Loading template...',
  '下载 Excel 模板': 'Download Excel Template',
  '请输入 User ID': 'Enter User ID',
  '请输入密码': 'Enter password',
  '请先填写账号和密码。': 'Fill in the account and password first.',
  '已保存': 'Saved',
  '已保存。': 'Saved.',
  '保存登录账号密码': 'Save Login Account and Password',
  '保存失败。': 'Save failed.',
  '保存中...': 'Saving...',
  '保存': 'Save',
  '登录账号': 'Login Account',
  '登录账号密码': 'Login Account and Password',
  '登录凭据': 'Login Credentials',
  '清除失败。': 'Clear failed.',
  '已清除。': 'Cleared.',
  '请先新增并保存 Infor Nexus 登录账号密码。': 'Add and save Infor Nexus login credentials first.',
  '当前': 'Current',
  '已下载': 'Downloaded',
  '已完成': 'Completed',
  '启动执行器失败。': 'Failed to start executor.',
  '上传 PO No Excel 执行批量录入': 'Upload PO No Excel for batch entry',
  '执行': 'Run',
  '释放以上传': 'Release to upload',
  '拖拽或点击选择 Excel 文件': 'Drag or click to choose an Excel file',
  '暂无已保存账号': 'No saved accounts',
  '默认账号': 'Default Account',
  '新增账号': 'New Account',
  '编辑账号': 'Edit Account',
  '删除账号档案': 'Delete Account Profile',
  '账号档案': 'Account Profiles',
  '已保存账号': 'Saved Accounts',
  '选择账号': 'Select Account',
  '没有匹配账号': 'No matching account',
  '确认删除': 'Confirm Delete',
  '删除中...': 'Deleting...',
  '已保存账号档案。': 'Account profile saved.',
  '已删除账号档案。': 'Account profile deleted.',
  '保存账号档案失败。': 'Failed to save account profile.',
  '删除账号档案失败。': 'Failed to delete account profile.',
  '保存到远程数据库后，可在账号档案中直接选择使用。':
    'After saving to the remote database, you can select it directly from account profiles.',
  '例如 user3 / 默认账号': 'Example: user3 / default account',
  '自动搜索并添加': 'Auto Search and Add',
  '按 Excel 顺序逐个搜索、勾选并添加': 'Search, select, and add one by one in Excel order.',
  '上传 Excel 并执行': 'Upload Excel and Run',
  '上传 Excel 并执行 TC INV': 'Upload Excel and Run TC INV',
  '上传出货明细表并同步交期与费用': 'Upload shipment details and sync delivery dates and fees',
  '登录并打开 TC INV 流程': 'Log in and open the TC INV flow',
  '请包含工厂、交期、费用等字段': 'Include fields such as factory, delivery date, and fees',
  '请求下载箱单 PDF': 'Request Packing List PDF Downloads',
  '上传 Excel 后按 PO 号查询箱单并发起下载到本机目录。':
    'After Excel upload, query packing lists by PO number and download them to a local folder.',
  '上传 Excel 并下载箱单 PDF': 'Upload Excel and Download Packing List PDFs',
  '等待上传 Excel 并填写箱单下载保存目录。': 'Waiting for Excel upload and packing list download folder.',
  '选择箱单下载保存目录': 'Choose Packing List Download Folder',
  '箱单 PDF 下载完成。': 'Packing List PDF download completed.',
  '正在上传 Excel 并发起箱单 PDF 请求下载...': 'Uploading Excel and starting packing list PDF download requests...',
  '自动下载箱单模板未上传，请先在 Excel 模板中心上传。':
    'Packing list auto-download template is missing. Upload it in the Excel Template Center first.',
  '执行器仍在下载箱单 PDF，请勿重复启动。': 'The executor is still downloading packing list PDFs. Do not start it again.',
  '执行器仍在下载 Invoice PDF，请勿重复启动。': 'The executor is still downloading Invoice PDFs. Do not start it again.',
  '请先上传 Excel 文件，文件需包含 PO# 和 Invoice# 列。':
    'Upload an Excel file first. It must include PO# and Invoice# columns.',
  '请先上传 Excel 文件，文件需包含 PO NUMBER、inv number 和 PODD DATE 列。':
    'Upload an Excel file first. It must include PO NUMBER, inv number, and PODD DATE columns.',
  '请先上传 Excel 文件，文件需包含 INVOICE NUMBER 和 STATUS 列。':
    'Upload an Excel file first. It must include INVOICE NUMBER and STATUS columns.',
  '请先选择或填写下载保存目录。': 'Choose or enter the download folder first.',
  '请先填写 User ID。': 'Enter the User ID first.',
  '请先填写并保存 Infor Nexus 登录账号密码。':
    'Enter and save the Infor Nexus login account and password first.',
  '无法解析响应。': 'Unable to parse the response.',
  '自动化执行失败。': 'Automation execution failed.',
  '自动化执行异常。': 'Automation execution error.',
  '本机执行器缺少当前自动化接口，系统已同步最新自动化逻辑但接口仍不可用。请确认服务器 automation-modules 模块包已发布，或重启本机自动化执行器后再试。':
    'The local executor is missing the current automation API. The latest automation logic has been synced, but the API is still unavailable. Confirm the server automation-modules package has been published, or restart the local executor and try again.',
  '没有可继续的自动下载箱单批次。': 'No packing list auto-download batch can be resumed.',
  '请先选择自动下载箱单 Excel。': 'Choose the packing list auto-download Excel file first.',
  断点续跑: 'Resume Checkpoint',
  继续未完成: 'Continue Pending',
  只重试失败: 'Retry Failed Only',
  待继续: 'Pending',
  暂无可续跑批次: 'No Resumable Batch',
  '上传执行后，如果中途失败或中断，这里会出现“继续未完成”。':
    'After an upload run fails or is interrupted, pending work will appear here.',
  正在处理: 'Processing',
  'PO 自动下载模板未上传，请先上传到 MinIO。': 'PO auto-download template is missing. Upload it to MinIO first.',
  '请从 Jessica 浏览器自动化菜单重新进入。': 'Re-enter from the Jessica browser automation menu.',
  '请包含 PO NUMBER 和 STATUS 列': 'Include PO NUMBER and STATUS columns',
  '例如：D:\\Downloads\\InforNexus\\PackingList': 'Example: D:\\Downloads\\InforNexus\\PackingList',
  '万代 Shipping 自动化仍在后台运行，请勿重复启动。':
    'Wandai Shipping automation is still running in the background. Do not start it again.',
  '新龙泰 Shipping 自动化仍在后台运行，请勿重复启动。':
    'Xinlongtai Shipping automation is still running in the background. Do not start it again.',
  'Infornexus 自动搜索添加仍在后台运行，请勿重复启动。':
    'Infornexus auto search/add is still running in the background. Do not start it again.',
  'TC INV 自动化仍在后台运行，请勿重复启动。':
    'TC INV automation is still running in the background. Do not start it again.',
  '读取账号密码失败。': 'Failed to read account credentials.',
  '检测到当前自动化仍在后台运行，已恢复页面状态。':
    'The current automation is still running in the background, so the page state has been restored.',
  '已同步最新自动化逻辑。': 'Latest automation logic has been synchronized.',
  '未保存': 'Not Saved',
  '按 Factory + Working Number 匹配 Merch，不上传则留空':
    'Match Merch by Factory + Working Number; leave blank if not uploaded.',
  '按 PO Number 匹配 Factory，不上传则留空':
    'Match Factory by PO Number; leave blank if not uploaded.',
  '辅助 Excel（可选）': 'Auxiliary Excel (optional)',
  'Factory Price 表': 'Factory Price Sheet',
  'Release / Unrelease 表': 'Release / Unrelease Sheet',
  'Microsoft 账号': 'Microsoft Account',
  'Microsoft 密码': 'Microsoft Password',
  '请输入 Microsoft 账号': 'Enter Microsoft account',
  '打开小助手面板': 'Open Helper Panel',
  '当前版本': 'Current Version',
  '更新管理': 'Update Management',
  '处理日志': 'Processing Logs',
  '条': 'items',
  '需要更新本机自动化助手': 'Local Automation Helper Update Required',
  '当前助手缺少 adidas 网页端启动能力，请安装最新版后再打开采集器。':
    'The current helper lacks adidas web launcher support. Install the latest version before opening the collector.',
  '未知版本': 'Unknown Version',
  '系统要求': 'System Requirement',
  '安装包文件名会带版本号；安装完成后请重启本机自动化助手，或重新打开此页面。':
    'The installer file name includes the version. After installation, restart the local automation helper or reopen this page.',
  '稍后处理': 'Later',
  '下载最新助手': 'Download Latest Helper',
  '自动化助手安装包下载失败。': 'Automation helper installer download failed.',
  '核对异常列表': 'Exception List',
  '待生成': 'Pending',
  '上传两张 Excel 后点击生成，系统会自动识别固定业务列并在这里显示核对结果。':
    'Upload two Excel files and click generate. The system will identify fixed business columns and show comparison results here.',
  '全部一致，未发现差值不为 0 的行。': 'Everything matches. No rows with non-zero differences were found.',
  'RC 行号': 'RC Row',
  'RC 单价': 'RC Unit Price',
  'PO 单价': 'PO Unit Price',
  目标表行号: 'Target Workbook Row',
  目标表单价: 'Target Workbook Unit Price',
  汇总表单价: 'Summary Workbook Unit Price',
  '单价差值': 'Unit Price Difference',
  'RC 金额': 'RC Amount',
  'PO 金额': 'PO Amount',
  目标表金额: 'Target Workbook Amount',
  汇总表金额: 'Summary Workbook Amount',
  '金额差值': 'Amount Difference',
  '功能开发中': 'Feature in Development',
  '此功能模块正在紧张开发中，敬请期待！': 'This feature module is under active development. Stay tuned.',
  '返回首页': 'Back Home',
  '执行记录': 'Run Records',
  '查看本页面最近': 'View the latest',
  '次执行、源文件和结果归档。': 'runs, source files, and result archives for this page.',
  '全部记录': 'All Records',
  '正在读取执行记录...': 'Loading run records...',
  '选择一条记录查看文件': 'Select a record to view files',
  '正在读取归档文件...': 'Loading archived files...',
  '该记录暂无归档文件': 'This record has no archived files',
  '失败 JSON': 'Failure JSON',
  '排序与核对中心': 'Sort and Compare Center',
  '微调 PO 顺序，并实时比对 PO 页码匹配状态': 'Fine-tune PO order and compare PO page matching status in real time',
  '个 PO': 'POs',
  '个PO': 'POs',
  '个有效 PO': 'valid POs',
  'PO 顺序列表 (一行一个)': 'PO Order List (one per line)',
  '应用列表': 'Apply List',
  '复制列表': 'Copy List',
  '打印摘要': 'Print Summary',
  '清空列表': 'Clear List',
  'PO页': 'PO Page',
  '数量': 'Quantity',
  '货品金额': 'Goods Amount',
  '等待同步或输入 PO 列表': 'Waiting for sync or PO list input',
  '已匹配': 'Matched',
  '未找到': 'Not Found',
  '生成中...': 'Generating...',
  '单独生成': 'Generate Single',
  'PO PDF 中有但当前列表未包含': 'POs exist in the PO PDF but are not included in the current list',
  '发票 PO 提取': 'Invoice PO Extraction',
  '自定义号码提取': 'Custom Number Extraction',
  '上传发票 PDF 后提取 PO 顺序与明细': 'Upload an invoice PDF to extract PO order and details',
  '发票 PDF 数据源': 'Invoice PDF Data Source',
  '个已导入 PO': 'imported POs',
  '清除文件': 'Clear File',
  '选择或拖入发票 PDF': 'Choose or drop an invoice PDF',
  '支持单个 .pdf 文件': 'Supports a single .pdf file',
  '提取中...': 'Extracting...',
  '提取发票': 'Extract Invoice',
  '同步到 PO': 'Sync to PO',
  '复制': 'Copy',
  'PO 数量': 'PO Count',
  '总数量': 'Total Quantity',
  '发票总额': 'Invoice Total',
  '发票页': 'Invoice Page',
  '描述': 'Description',
  '净额': 'Net Amount',
  '等待上传发票 PDF 并提取数据': 'Waiting for invoice PDF upload and extraction',
  '按自定义规则抓取特定文本或 PDF 中的号码': 'Capture numbers from text or PDFs with custom rules',
  '个号码': 'numbers',
  '应用规则': 'Apply Rule',
  '090/45 开头': 'Starts with 090/45',
  '10 位数字': '10-digit number',
  '包含 45': 'Contains 45',
  '自定义提取 PDF': 'Custom Extraction PDF',
  '个已选文件': 'selected files',
  '个 PDF': 'PDFs',
  '选择用于提取的 PDF': 'Choose PDFs for extraction',
  '可多选': 'Multiple allowed',
  '如 090|45 或 \\d{10}': 'Example: 090|45 or \\d{10}',
  '粘贴文本，然后点击从粘贴提取': 'Paste text, then click extract from paste',
  '从 PDF 提取': 'Extract from PDF',
  '从粘贴提取': 'Extract from Paste',
  '抓取页面文本': 'Capture Page Text',
  '等待提取号码': 'Waiting to extract numbers',
  '个': 'items',
  '闪电极速重排': 'Lightning Fast Reorder',
  '免去手动核对，一键完成数据提取与 PDF 合并': 'Skip manual checking and complete data extraction plus PDF merge in one click',
  '拖入或选择发票 PDF': 'Drop or choose invoice PDF',
  '清除发票文件': 'Clear invoice file',
  '拖入或选择 PO PDF': 'Drop or choose PO PDF',
  '清除 PO 文件': 'Clear PO file',
  '正在极速重排...': 'Fast reordering...',
  '极速生成成功': 'Fast generation succeeded',
  '一键极速重排': 'One-click Fast Reorder',
  '预览 PDF': 'Preview PDF',
  '清空文件': 'Clear Files',
  'PO PDF 匹配与生成': 'PO PDF Matching and Generation',
  '上传 PO PDF，一键生成重排后的最终文件': 'Upload a PO PDF and generate the final reordered file in one click',
  '个已识别 PO': 'recognized POs',
  'PO 原始文件 PDF': 'Original PO PDF',
  '选择或拖入 PO PDF': 'Choose or drop a PO PDF',
  '识别中...': 'Recognizing...',
  '识别 PO 页码': 'Recognize PO Pages',
  '清空 PO 文件': 'Clear PO File',
  '输出选项': 'Output Options',
  '仅打印当前页': 'Print current page only',
  '同时打印下一页': 'Also print next page',
  '摘要包含未找到 PO': 'Include missing POs in summary',
  '生成重排 PDF': 'Generate Reordered PDF',
  '打开 PDF': 'Open PDF',
  '查看运行日志': 'View Runtime Logs',
  '运行日志': 'Runtime Logs',
  '操作和后端状态返回': 'Operations and backend status responses',
  'PO 发票顺序重排': 'PO Invoice Order Reorder',
  '智能文档工作台': 'Smart Document Workbench',
  '原始输入发票/列表': 'Original invoice/list input',
  '原始数据': 'Raw Data',
  '智能重组与页码映射': 'Smart reordering and page mapping',
  '排序重组': 'Order Rebuild',
  '按指定顺序生成重排 PDF': 'Generate reordered PDF in the specified order',
  '重排 PDF': 'Reordered PDF',
  'jessica - 对账核对': 'jessica - Invoice Compare',
  'jessica - Invoice 核对': 'jessica - Invoice Compare',
  'Invoice 核对': 'Invoice Compare',
  'Sophia - 报表合并': 'Sophia - Report Merge',
  成品表生成: 'Finished Goods Sheet',
  'Jane - BOM汇总': 'Jane BOM Summary',
  'Jane - PRODUCTION核对': 'Jane PRODUCTION Compare',
  'Jane - OUTBOUND核对': 'Jane OUTBOUND Compare',
  'Jane - 表格制作': 'Jane Table Making',
  Eric数据处理: 'Eric Data Processing',
  数据核对: 'Data Compare',
  系统设置: 'Settings',
  应用: 'Application',
  运行模式: 'Run Mode',
  文件准备: 'File Preparation',
  文件预检查: 'File Precheck',
  必传: 'Required',
  已选文件: 'Selected Files',
  已就绪: 'Ready',
  目标月份: 'Target Month',
  未选择月份: 'No month selected',
  日期范围: 'Date Range',
  日期范围未完整: 'Incomplete date range',
  全部日期: 'All Dates',
  'Order Type': 'Order Type',
  Bulk: 'Bulk',
  Sample: 'Sample',
  'Bulk + Sample': 'Bulk + Sample',
  组文件: 'file groups',
  当前共: 'total',
  个文件: 'files',
  组必传: 'required groups',
  组可选: 'optional groups',
  开始合并: 'Start Merge',
  '合并中...': 'Merging...',
  开始追加: 'Start Append',
  追加行: 'Appended Rows',
  结果指标: 'Result Metrics',
  '支持 .xls / .xlsx': 'Supports .xls / .xlsx',
  '支持 .xlsx': 'Supports .xlsx',
  '支持 .pdf': 'Supports .pdf',
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
  '请先补齐必传文件，再开始核对。': 'Upload all required files before reconciling.',
  '必传文件已就绪，可以开始处理。': 'Required files are ready. You can start processing.',
  结果摘要: 'Result Summary',
  处理完成: 'Completed',
  处理失败: 'Failed',
  处理状态: 'Status',
  'Result Set 文件': 'Result Set File',
  写入行数: 'Written Rows',
  'Lookup 缺失': 'Missing Lookup',
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
  下载历史结果: 'Download History Results',
  'To ERIC Result Set -> test 目标表': 'To ERIC Result Set -> test target workbook',
  '上传 1 个 .xlsx / .xlsm 文件': 'Upload one .xlsx / .xlsm file',
  请选择有效目标月份: 'Select a valid target month',
  请选择有效日期范围: 'Select a valid date range',
  '查看近30天已归档的历史结果': 'View archived results from the last 30 days',
  当前模块未配置历史结果页: 'No history results page is configured for this module',
  发票文件: 'Invoice Files',
  '发票文件（可多选）': 'Invoice Files (multiple)',
  参考表文件: 'Reference File',
  'TC INV PDF（可多选）': 'TC INV PDF (multiple)',
  'Packing List PDF（可多选）': 'Packing List PDF (multiple)',
  TMS文件: 'TMS Files',
  'TMS 文件': 'TMS Files',
  'TMS 文件（可多选）': 'TMS Files (multiple)',
  Article文件: 'Article Files',
  'Article 文件': 'Article Files',
  'Article 文件（可多选）': 'Article Files (multiple)',
  'TMS Price 文件': 'TMS Price Files',
  'TMS Price 文件（可多选）': 'TMS Price Files (multiple)',
  'Factory Price 文件': 'Factory Price Files',
  'Factory Price 文件（可多选）': 'Factory Price Files (multiple)',
  'Allocation Factory 文件': 'Allocation Factory Files',
  'Allocation Factory 文件（可选，可多选）': 'Allocation Factory Files (optional, multiple)',
  'Shipment Method 文件': 'Shipment Method Files',
  'Shipment Method 文件（可选，可多选）': 'Shipment Method Files (optional, multiple)',
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
  匹配数量: 'Matched Count',
  异常诊断: 'Exception Diagnostics',
  TC核对记录: 'TC Compare Records',
  TC异常: 'TC Exceptions',
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
  'C-F 不一致组': 'C-F Inconsistent Groups',
  多出材料行: 'Extra Material Rows',
  补入材料行: 'Inserted Missing Material Rows',
  料率计算行: 'Rate Calculated Rows',
  '按 Style ID + Production Lot ID 分组检查 C-D-E-F':
    'Checks C-D-E-F by Style ID + Production Lot ID group',
  'Production 有但 BOM汇总 未使用的材料行会加删除线':
    'Production material rows not used in BOM Summary are struck through',
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
  核对进度: 'Reconciliation Progress',
  'SAP BTP 自动化流程': 'SAP BTP Automation Flow',
  诊断包: 'Diagnostics Package',
  Excel处理: 'Excel Processing',
  'Excel 处理': 'Excel Processing',
  桌面Electron环境: 'Desktop Electron Environment',
  '桌面 Electron 环境': 'Desktop Electron Environment',
  刷新: 'Refresh',
  历史结果: 'History Results',
  可下载结果: 'Downloadable Results',
  当前页: 'Current Page',
  全部模块: 'All Modules',
  模块: 'Modules',
  '远端读取失败，当前显示本机缓存': 'Remote loading failed. Showing local cache.',
  正在读取历史结果: 'Loading history results',
  近30天暂无已归档结果: 'No archived results in the last 30 days',
  处理时间: 'Processed At',
  摘要: 'Summary',
  输入文件: 'Input Files',
  大小: 'Size',
  未知人员: 'Unknown Person',
  未知人员历史页: 'Unknown person history page',
  历史结果读取失败: 'Failed to load history results',
  历史结果文件下载失败: 'Failed to download history result file',
  '刷新中...': 'Refreshing...',
  'Infornexus 自动搜索并添加': 'Infornexus Auto Search and Add',
  业务网页: 'Business Web Page',
  '在 Infornexus 页面读取 XLS/XLSX 的指定 ID，并自动执行搜索、勾选和添加操作。':
    'Read specified IDs from XLS/XLSX on Infornexus, then automatically search, select, and add them.',
  启动: 'Launch',
  启动中: 'Launching',
  站点: 'Site',
  未读取到插件注册表请检查桌面端插件清单: 'No plugin registry was found. Check the desktop plugin manifest.',
  '未读取到插件注册表，请检查桌面端插件清单。': 'No plugin registry was found. Check the desktop plugin manifest.',
  浏览器: 'Browser',
  功能受限: 'Limited Feature',
  '导出诊断包功能需要在桌面客户端中使用，当前浏览器预览环境不支持。':
    'Exporting diagnostics requires the desktop client and is not supported in the current browser preview environment.',
  当前运行环境不支持打开外部网页: 'The current runtime does not support opening external pages',
  序号: 'No.',
  状态: 'Status',
  操作: 'Actions',
  部分成功: 'Partially Successful',
  开始日期: 'Start Date',
  结束日期: 'End Date',
  个归档文件: 'archived files',
  个文件可下载: 'files available',
  打开: 'Open',
  关闭: 'Close',
  取消全选: 'Clear Selection',
  全选: 'Select All',
  下载已选: 'Download Selected',
  全量下载: 'Download All',
  打开后可全选勾选或单独下载: 'Open to select all, choose individual files, or download separately.',
  '打开后可全选、勾选或单独下载。': 'Open to select all, choose individual files, or download separately.',
  该记录还没有可下载文件: 'This record has no downloadable files yet.',
  '该记录还没有可下载文件。': 'This record has no downloadable files yet.',
  执行记录已删除: 'Run record deleted.',
  '执行记录已删除。': 'Run record deleted.',
  确认删除这条执行记录: 'Delete this run record?',
  '确认删除这条执行记录？': 'Delete this run record?',
  删除执行记录: 'Delete Run Record',
  正在读取归档文件: 'Loading archived files',
  请稍候文件列表会在这里更新: 'Please wait. The file list will update here.',
  '请稍候，文件列表会在这里更新。': 'Please wait. The file list will update here.',
  该执行记录还没有可下载的业务文件: 'This run record has no downloadable business files yet.',
  '该执行记录还没有可下载的业务文件。': 'This run record has no downloadable business files yet.',
  正在读取文件列表: 'Loading file list',
  暂无可下载文件: 'No downloadable files',
  模板文件已替换成功: 'Template file replaced successfully.',
  '模板文件已替换成功。': 'Template file replaced successfully.',
  模板名称已保存: 'Template name saved.',
  '模板名称已保存。': 'Template name saved.',
  模板已启用: 'Template enabled.',
  '模板已启用。': 'Template enabled.',
  模板已停用: 'Template disabled.',
  '模板已停用。': 'Template disabled.',
  自动化执行记录: 'Automation Run Records',
  '如 090|45 或 \\\\d{10}': 'Example: 090|45 or \\\\d{10}',
  请包含PO和Invoice列: 'Include PO# and Invoice# columns',
  '请包含 PO# 和 Invoice# 列': 'Include PO# and Invoice# columns',
  '请包含 PO NUMBER、inv number 和 PODD DATE 列': 'Include PO NUMBER, inv number, and PODD DATE columns',
  '读取 PO NUMBER、inv number 和 PODD DATE 列生成箱单下载清单。':
    'Read PO NUMBER, inv number, and PODD DATE columns to build the packing list download queue.',
  已保存PDF: 'Saved PDFs',
  '已保存 PDF': 'Saved PDFs',
  未下载成功批次: 'Unsuccessful Download Batches',
  未填写Invoice: 'Invoice# Missing',
  '未填写 Invoice#': 'Invoice# Missing',
  已切换断点批次可继续未完成或查看文件: 'Resume batch selected. Continue unfinished items or view files.',
  '已切换断点批次，可继续未完成或查看文件。': 'Resume batch selected. Continue unfinished items or view files.',
  执行器当前未运行未完成批次已标记为中断可从断点继续:
    'The executor is not running. The unfinished batch was marked interrupted and can be resumed.',
  '执行器当前未运行，未完成批次已标记为中断，可从断点继续。':
    'The executor is not running. The unfinished batch was marked interrupted and can be resumed.',
  用户已停止本机执行器当前批次已中断可从断点继续:
    'The local executor was stopped. The current batch is interrupted and can be resumed.',
  '用户已停止本机执行器，当前批次已中断，可从断点继续。':
    'The local executor was stopped. The current batch is interrupted and can be resumed.',
  箱单PDF已部分下载可通过断点续跑继续未完成批次:
    'Packing List PDFs were partially downloaded. Resume the batch to continue unfinished items.',
  '箱单 PDF 已部分下载，可通过断点续跑继续未完成批次。':
    'Packing List PDFs were partially downloaded. Resume the batch to continue unfinished items.',
  箱单PDF下载失败: 'Packing List PDF download failed.',
  '箱单 PDF 下载失败。': 'Packing List PDF download failed.',
  最近批次: 'Recent Batch',
  刷新批次: 'Refresh Batches',
  查看文件: 'View Files',
  历史批次: 'Batch History',
  执行后会在这里显示最近批次进度和文件入口:
    'Recent batches, progress, and file entries will appear here after a run.',
  '执行后会在这里显示最近批次、进度和文件入口。':
    'Recent batches, progress, and file entries will appear here after a run.',
  查看历史批次: 'View Batch History',
  批次文件: 'Batch Files',
  当前批次暂无可下载文件: 'The current batch has no downloadable files',
  每完成一个箱单文件会自动归档到这里:
    'Each completed packing list file is archived here automatically.',
  '每完成一个箱单，文件会自动归档到这里。':
    'Each completed packing list file is archived here automatically.',
  箱单状态: 'Packing List Status',
  已下载失败和待继续一眼可见: 'Downloaded, failed, and pending items are visible at a glance',
  '已下载、失败和待继续一眼可见': 'Downloaded, failed, and pending items are visible at a glance',
  文件下载: 'File Download',
  可单独下载也可全量下载: 'Download files individually or all at once',
  '可单独下载，也可全量下载': 'Download files individually or all at once',
  选择任意批次继续下载不限最近一次: 'Select any batch to continue downloading, not only the latest one.',
  '选择任意批次继续下载，不限最近一次。': 'Select any batch to continue downloading, not only the latest one.',
  暂无历史批次: 'No batch history',
  执行一次自动下载后这里会显示可继续和可查看的批次:
    'After one auto-download run, resumable and viewable batches will appear here.',
  '执行一次自动下载后，这里会显示可继续和可查看的批次。':
    'After one auto-download run, resumable and viewable batches will appear here.',
  选择续跑: 'Select to Resume',
  删除: 'Delete',
  当前批次正在执行停止后才可以继续未完成:
    'The current batch is running. Stop it before continuing unfinished items.',
  '当前批次正在执行，停止后才可以继续未完成。':
    'The current batch is running. Stop it before continuing unfinished items.',
  当前批次已完成不需要续跑: 'The current batch is complete and does not need to resume.',
  '当前批次已完成，不需要续跑。': 'The current batch is complete and does not need to resume.',
  当前批次没有可继续的箱单: 'The current batch has no packing lists to continue.',
  '当前批次没有可继续的箱单。': 'The current batch has no packing lists to continue.',
  当前批次正在执行停止后才可以重试失败项:
    'The current batch is running. Stop it before retrying failed items.',
  '当前批次正在执行，停止后才可以重试失败项。':
    'The current batch is running. Stop it before retrying failed items.',
  当前批次没有失败项: 'The current batch has no failed items.',
  '当前批次没有失败项。': 'The current batch has no failed items.',
  当前批次暂不可重试: 'The current batch cannot be retried yet.',
  '当前批次暂不可重试。': 'The current batch cannot be retried yet.',
  文件下载已开始: 'File download started.',
  '文件下载已开始。': 'File download started.',
  文件下载失败: 'File download failed.',
  '文件下载失败。': 'File download failed.',
  批次文件下载失败: 'Batch file download failed.',
  '批次文件下载失败。': 'Batch file download failed.',
  源Excel: 'Source Excel',
  '源 Excel': 'Source Excel',
  箱单PDF: 'Packing List PDF',
  '箱单 PDF': 'Packing List PDF',
  结果JSON: 'Result JSON',
  '结果 JSON': 'Result JSON',
  部分完成: 'Partially Complete',
  已中断: 'Interrupted',
  待执行: 'Pending Run',
  时间未知: 'Unknown Time',
  共: 'Total',
  项失败记录: 'failed records',
  下载失败Excel: 'Download Failed Excel',
  '下载失败 Excel': 'Download Failed Excel',
  仅包含失败的记录: 'Only failed records are included',
  下载结果Excel: 'Download Result Excel',
  '下载结果 Excel': 'Download Result Excel',
  包含全部处理结果: 'All processing results are included',
  未识别Invoice: 'Unrecognized Invoice',
  '未识别 Invoice': 'Unrecognized Invoice',
  行: 'rows',
  跳过: 'Skipped',
  未返回错误详情: 'No error details returned',
  重试: 'Retry',
  小助手更新: 'Helper Update',
  服务器最新版本: 'Latest Server Version',
  未检测到: 'Not Detected',
  箱数校验: 'Carton Check',
  运行记录: 'Run Records',
  次任务: 'runs',
  完成: 'Complete',
  已等待: 'Waited',
  浏览器内进度提示: 'In-Browser Progress Prompt',
  'SAP 浏览器左上角会显示当前进度。': 'The current progress appears at the top left of the SAP browser.',
  已关闭浏览器内浮层TOS页面仍会显示进度:
    'The in-browser overlay is closed. The TOS page still shows progress.',
  '已关闭浏览器内浮层，TOS 页面仍会显示进度。':
    'The in-browser overlay is closed. The TOS page still shows progress.',
  后台执行器任务已结束: 'Background executor task ended.',
  '后台执行器任务已结束。': 'Background executor task ended.',
  执行完成Excel已生成: 'Execution complete. Excel was generated.',
  '执行完成，Excel 已生成。': 'Execution complete. Excel was generated.',
  结果已生成但历史结果未归档不会出现在历史结果页:
    'The result was generated, but it was not archived and will not appear on the history results page',
  '结果已生成，但历史结果未归档，不会出现在历史结果页':
    'The result was generated, but it was not archived and will not appear on the history results page',
  释放文件: 'Release files',
  文件上传: 'File Upload',
  处理进度: 'Progress',
  网页自动化: 'Web Automation',
  选择自动化入口上传Excel并启动本地浏览器执行:
    'Choose an automation entry, upload Excel, and launch the local browser.',
  '选择自动化入口，上传 Excel 并启动本地浏览器执行':
    'Choose an automation entry, upload Excel, and launch the local browser.',
  搜索入口: 'Search entries',
  搜索入口名称或标签: 'Search entry name or tag',
  可用: 'Available',
  即将上线: 'Coming Soon',
  暂不可用: 'Unavailable',
  进入场景: 'Open Scenario',
  详情: 'Details',
  没有匹配的自动化入口: 'No matching automation entries',
  请调整搜索条件或联系管理员添加新的自动化场景:
    'Adjust the search terms, or contact an administrator to add a new automation scenario.',
  '请调整搜索条件，或联系管理员添加新的自动化场景。':
    'Adjust the search terms, or contact an administrator to add a new automation scenario.',
  没有匹配的入口: 'No matching entries',
  请调整搜索条件: 'Adjust the search terms',
  Infornexus自动化: 'Infornexus Automation',
  'Packing list 自动下载': 'Packing List Auto Download',
  其他自动化: 'Other Automation',
  个入口: 'entries',
  shipping自动化: 'Shipping Automation',
  '万代shipping 自动化': 'Wandai Shipping Automation',
  万代: 'Wandai',
  'SAP BTP 自动登录': 'SAP BTP Automatic Login',
  '上传 Excel 后自动完成 Microsoft 登录与 SAP BTP 平台操作。':
    'Upload Excel and automatically complete Microsoft login and SAP BTP platform actions.',
  '统计 ticket 归属 自动化': 'Ticket Ownership Statistics Automation',
  'SAP BTP Ticket 归属统计': 'SAP BTP Ticket Ownership Statistics',
  '登录 SAP BTP 后从 Task Center 采集 ticket 信息，并生成 Ticket ownership Excel。':
    'Log in to SAP BTP, collect ticket information from Task Center, and generate the Ticket ownership Excel.',
  'Ticket ownership 操作模式': 'Ticket ownership mode',
  采集生成: 'Collect and generate',
  补全结果表: 'Complete result workbook',
  已生成结果表: 'Generated result workbook',
  '拖入或选择第一次生成的 Ticket ownership 表':
    'Drop or choose the first generated Ticket ownership workbook',
  '支持 .xlsx / .xls / .json；再配合下方辅助表补全 Factory / Merch':
    'Supports .xlsx / .xls / .json; then use the helper tables below to complete Factory / Merch.',
  释放以上传结果表: 'Release to upload the result workbook',
  '适合先不上传辅助表完成浏览器采集，再查看结果并上传辅助表进行二次补全。':
    'Use this to run browser collection without helper tables first, then review the result and upload helper tables for a second completion pass.',
  '补全中...': 'Completing...',
  '生成补全后的 Excel': 'Generate Completed Excel',
  '请上传 .xlsx / .xls / .json 结果表。': 'Upload an .xlsx / .xls / .json result workbook.',
  '补全 Excel 已生成。': 'Completed Excel has been generated.',
  '新龙泰-shipping 自动化': 'Xinlongtai Shipping Automation',
  'Preview PDF 保存目录': 'Preview PDF Save Folder',
  'Preview PDF 下载结果': 'Preview PDF Download Result',
  未执行: 'Not run',
  'PDF 下载状态': 'PDF Download Status',
  '例如：D:\\Downloads\\InforNexus\\TCINV': 'Example: D:\\Downloads\\InforNexus\\TCINV',
  '选择 VENT Preview PDF 保存目录': 'Choose VENT Preview PDF Save Folder',
  '正在打开 VENT Preview PDF 保存目录选择器，请留意系统弹窗。':
    'Opening the VENT Preview PDF folder picker. Watch for the system dialog.',
  '本机自动化助手缺少 VENT 目录选择接口，请同步最新自动化模块后重试，或手动填写完整本机路径。':
    'The local automation helper is missing the VENT folder picker API. Sync the latest automation module and try again, or enter the full local path manually.',
  '选择 TC INV Preview PDF 保存目录': 'Choose TC INV Preview PDF Save Folder',
  '本机自动化助手版本落后，请同步最新自动化模块后重试，或手动填写完整本机路径。':
    'The local automation helper is out of date. Sync the latest automation module and try again, or enter the full local path manually.',
  '正在打开 TC INV Preview PDF 保存目录选择器，请留意系统弹窗。':
    'Opening the TC INV Preview PDF folder picker. Watch for the system dialog.',
  '本机自动化助手缺少 TC INV 目录选择接口，请同步最新自动化模块后重试，或手动填写完整本机路径。':
    'The local automation helper is missing the TC INV folder picker API. Sync the latest automation module and try again, or enter the full local path manually.',
  '选择新龙泰 Preview PDF 保存目录': 'Choose Xinlongtai Preview PDF Save Folder',
  '已选择 Preview PDF 保存目录。': 'Preview PDF save folder selected.',
  '本机自动化助手版本落后，请安装最新模块后重试，或手动填写完整本机路径。':
    'The local automation helper is out of date. Install the latest module and try again, or enter the full local path manually.',
  '正在打开新龙泰 Preview PDF 保存目录选择器，请留意系统弹窗。':
    'Opening the Xinlongtai Preview PDF folder picker. Watch for the system dialog.',
  '本机自动化助手缺少新龙泰目录选择接口，请同步最新自动化模块后重试，或手动填写完整本机路径。':
    'The local automation helper is missing the Xinlongtai folder picker API. Sync the latest automation module and try again, or enter the full local path manually.',
  'Shipping 已完成，但 Preview PDF 下载有失败。':
    'Shipping completed, but some Preview PDF downloads failed.',
  'shipping 2 自动化': 'Shipping 2 Automation',
  'released Bulk 自动化': 'Released Bulk Automation',
  'n8n + Excel 驱动可见浏览器': 'n8n + Excel drives a visible browser',
  '上传 Excel 后由 n8n webhook 回调本机执行器，启动 Playwright 可见浏览器完成 Microsoft Login 与 SAP BTP 操作。':
    'After Excel upload, the n8n webhook calls the local executor and starts a visible Playwright browser for Microsoft Login and SAP BTP.',
  'Infor Nexus 运输业务自动化': 'Infor Nexus shipping automation',
  'Infor Nexus 自动化': 'Infor Nexus Automation',
  'Infor Nexus 万代运输业务自动化': 'Infor Nexus Wandai shipping automation',
  '进入 https://network.infornexus.com，后续承接本地直连浏览器自动化链路。':
    'Open https://network.infornexus.com, then continue through the local direct browser automation flow.',
  '进入 https://network.infornexus.com，后续承接万代本地直连浏览器自动化链路。':
    'Open https://network.infornexus.com, then continue through the Wandai local direct browser automation flow.',
  '进入 https://network.infornexus.com，后续承接 VENT 本地直连浏览器自动化链路。':
    'Open https://network.infornexus.com, then continue through the VENT local direct browser automation flow.',
  '进入 https://network.infornexus.com，后续承接 YUEN TAI+XO 本地直连浏览器自动化链路。':
    'Open https://network.infornexus.com, then continue through the YUEN TAI+XO local direct browser automation flow.',
  'Infor Nexus 登录与页面预备流程': 'Infor Nexus login and page preparation flow',
  'Infor Nexus released Bulk 自动化流程': 'Infor Nexus released Bulk automation flow',
  '先登录 Infor Nexus 并进入站点，后续页面操作会继续在这个独立场景里扩展。':
    'Log in to Infor Nexus and enter the site first; later page actions will expand in this dedicated scenario.',
  '先登录 Infor Nexus 并进入 released Bulk 场景，后续页面操作会继续在这个独立场景里扩展。':
    'Log in to Infor Nexus and enter the released Bulk scenario first; later page actions will expand in this dedicated scenario.',
  'Excel 第二列 ID 自动执行': 'Auto-run IDs from the second Excel column',
  '上传 Excel 后启动可视浏览器，读取第二列 10 位 ID 并在 Infor Nexus 自动搜索、勾选和添加。':
    'Upload Excel, launch a visible browser, read 10-digit IDs from the second column, then search, select, and add them in Infor Nexus.',
  'PO 自动下载': 'PO Auto Download',
  'Invoice 自动下载': 'Invoice Auto Download',
  'Invoice 下载': 'Invoice Download',
  'Excel Invoice 批量下载': 'Batch Invoice download from Excel',
  '上传 Excel 后按 Invoice Number 发起请求下载，并保存到指定本机目录。':
    'Upload Excel, request downloads by Invoice Number, and save files to the selected local folder.',
  'TC INV 自动化': 'TC INV Automation',
  'TC INV 出货明细与费用录入自动化': 'TC INV shipping details and charge entry automation',
  'VENT+YUEN TAI-Trade Card INV amount 自动化':
    'VENT+YUEN TAI-Trade Card INV amount Automation',
  'VENT+YUEN TAI-Trade Card INV amount 出货明细与费用录入自动化。':
    'VENT+YUEN TAI-Trade Card INV amount shipping details and charge entry automation.',
  'XO-Trade Card INV amount 自动化': 'XO-Trade Card INV amount Automation',
  'XO-Trade Card INV amount 出货明细与费用录入自动化。':
    'XO-Trade Card INV amount shipping details and charge entry automation.',
  'SLT、VENT、XO 工厂支持自动上传出货明细表，系统自动上传运费表，并同步录入货物交期、各项费用等信息。':
    'SLT, VENT, and XO factories support automatic shipping detail upload, freight table upload, and synchronized entry of delivery dates and charges.',
  自动下载箱单: 'Packing List Auto Download',
  'Packing List 下载': 'Packing List Download',
  'Excel 箱单批量下载': 'Batch packing list download from Excel',
  '上传 Excel 后按 PO 号查询箱单并发起下载，保存到指定本机目录。':
    'Upload Excel, search packing lists by PO number, start the download, and save files to the selected local folder.',
  'Excel PO 批量下载': 'Batch PO download from Excel',
  '上传 Excel 后按 PO 发起请求下载，并保存到指定本机目录。':
    'Upload Excel, request downloads by PO, and save files to the selected local folder.',
  '请求下载 PO 文件': 'Request PO File Downloads',
  '上传 Excel 后按 PO 发起请求下载到本机目录。':
    'Upload Excel and request PO downloads to the local folder.',
  '请求下载 Invoice PDF': 'Request Invoice PDF Downloads',
  '上传 Excel 后按 Invoice Number 发起请求下载到本机目录。':
    'Upload Excel and request downloads by Invoice Number to the local folder.',
  下载模板: 'Download Template',
  '模板下载已开始。': 'Template download started.',
  '模板下载失败。': 'Template download failed.',
  '下载保存目录': 'Download Folder',
  '例如：D:\\Downloads\\InforNexus\\PO': 'Example: D:\\Downloads\\InforNexus\\PO',
  '例如：D:\\Downloads\\InforNexus\\Invoice': 'Example: D:\\Downloads\\InforNexus\\Invoice',
  选择目录: 'Choose Folder',
  手动填写: 'Enter Manually',
  '上传 Excel 并下载 PO 文件': 'Upload Excel and Download PO Files',
  '上传 Excel 并下载 Invoice PDF': 'Upload Excel and Download Invoice PDFs',
  '等待上传 Excel 并填写下载保存目录。': 'Waiting for Excel upload and download folder.',
  '读取 PO No 列生成下载清单。': 'Read the PO No column to build the download list.',
  '读取 INVOICE NUMBER 和 STATUS 列生成下载清单。':
    'Read the INVOICE NUMBER and STATUS columns to build the download list.',
  '请包含 INVOICE NUMBER 和 STATUS 列': 'Include the INVOICE NUMBER and STATUS columns.',
  '选择保存目录': 'Choose Save Folder',
  '文件会直接保存到用户电脑指定目录。': 'Files are saved directly to the selected folder on this computer.',
  请求下载优先: 'Request Download First',
  '本机执行器优先使用登录态发起下载请求。': 'The local executor first uses the login session to request downloads.',
  '查看下载结果': 'Review Download Results',
  '完成数量、失败 PO 和保存路径会返回页面。': 'Completed counts, failed POs, and saved paths are returned to the page.',
  '完成数量、失败 Invoice 和保存路径会返回页面。': 'Completed counts, failed invoices, and saved paths are returned to the page.',
  '当前浏览器环境无法打开系统目录选择器，请手动填写完整本机路径。':
    'The current browser cannot open a system folder picker. Enter the full local path manually.',
  '选择 PO 下载保存目录': 'Choose PO Download Folder',
  '选择 Invoice 下载保存目录': 'Choose Invoice Download Folder',
  '选择目录失败。': 'Failed to choose folder.',
  '正在打开本机目录选择器，请留意系统弹窗。': 'Opening the local folder picker. Watch for the system dialog.',
  '已取消选择目录。': 'Folder selection cancelled.',
  '本机自动化助手版本落后，请下载并安装最新版后重试。':
    'The local automation helper is out of date. Download and install the latest version, then try again.',
  '已选择下载保存目录。': 'Download folder selected.',
  '请选择 .xlsx 或 .xls 文件。': 'Choose an .xlsx or .xls file.',
  'Excel 已选择，等待下载。': 'Excel selected, waiting to download.',
  '请先填写下载保存目录。': 'Enter the download folder first.',
  '正在上传 Excel 并发起 PO 请求下载...': 'Uploading Excel and starting PO request downloads...',
  '正在上传 Excel 并发起 Invoice PDF 请求下载...': 'Uploading Excel and starting Invoice PDF request downloads...',
  'PO 自动下载完成。': 'PO auto download completed.',
  'Invoice PDF 下载完成。': 'Invoice PDF download completed.',
  Infornexus数据同步: 'Infornexus Data Sync',
  'Infornexus 数据同步': 'Infornexus Data Sync',
  跨平台数据自动同步: 'Cross-platform automatic data sync',
  定时抓取Infornexus数据并同步至本地支持增量同步:
    'Fetch Infornexus data on a schedule and sync it locally with incremental sync support.',
  '定时抓取 Infornexus 数据并同步至本地，支持增量同步。':
    'Fetch Infornexus data on a schedule and sync it locally with incremental sync support.',
  邮件报表机器人: 'Email Report Bot',
  自动抓取页面生成报表并发送: 'Automatically capture pages, generate reports, and send them',
  自动生成汇总报表并通过邮件分发: 'Generate summary reports and distribute them by email.',
  '自动生成汇总报表并通过邮件分发。': 'Generate summary reports and distribute them by email.',
  智能表单填充: 'Smart Form Fill',
  AI辅助表单识别与填写: 'AI-assisted form recognition and filling',
  'AI 辅助表单识别与填写': 'AI-assisted form recognition and filling',
  智能识别表单结构匹配Excel列完成批量填充:
    'Recognize form structure and match Excel columns for batch filling.',
  '智能识别表单结构，匹配 Excel 列完成批量填充。':
    'Recognize form structure and match Excel columns for batch filling.',
  自动化场景: 'Automation Scenario',
  网页自动化场景: 'Web Automation Scenario',
  未找到入口: 'Entry Not Found',
  当前入口不存在请返回列表重新选择: 'This entry does not exist. Return to the list and choose again.',
  '当前入口不存在，请返回列表重新选择。': 'This entry does not exist. Return to the list and choose again.',
  入口不存在: 'Entry does not exist',
  请返回网页自动化入口列表重新选择: 'Return to the web automation entry list and choose again.',
  '请返回网页自动化入口列表重新选择。': 'Return to the web automation entry list and choose again.',
  返回: 'Back',
  执行器: 'Executor',
  执行器控制: 'Executor Control',
  启动执行器: 'Start Executor',
  启动中点点点: 'Starting...',
  '启动中...': 'Starting...',
  停止: 'Stop',
  刷新状态: 'Refresh Status',
  刷新中: 'Refreshing',
  操作流程: 'Workflow',
  执行器健康信息: 'Executor Health',
  执行器就绪: 'Executor Ready',
  等待执行器: 'Waiting for Executor',
  搜索并添加InfornexusID: 'Search and Add Infornexus IDs',
  '搜索并添加 Infornexus ID': 'Search and Add Infornexus IDs',
  登录并打开ShipmentScan: 'Log In and Open Shipment Scan',
  '登录并打开 Shipment Scan': 'Log In and Open Shipment Scan',
  '本机执行器会读取 Excel 第二列 ID，登录 Infor Nexus 后自动搜索、勾选和添加。':
    'The local executor reads IDs from the second Excel column, logs in to Infor Nexus, then searches, selects, and adds them automatically.',
  '本机执行器会登录 Infor Nexus，并自动进入 Shipment Scan 弹窗。':
    'The local executor logs in to Infor Nexus and opens the Shipment Scan dialog automatically.',
  '请把 10 位 ID 放在第二列': 'Place 10-digit IDs in the second column',
  '请包含 PO No 列': 'Include the PO No column',
  '上传万代 PO No Excel 执行批量录入': 'Upload Wandai PO No Excel for batch entry',
  '上传万代 PO No Excel 执行批量录入。': 'Upload Wandai PO No Excel for batch entry.',
  上传Excel并执行自动搜索添加: 'Upload Excel and Run Auto Search/Add',
  '上传 Excel 并执行自动搜索添加': 'Upload Excel and Run Auto Search/Add',
  上传Excel并执行Shipping: 'Upload Excel and Run Shipping',
  '上传 Excel 并执行 Shipping': 'Upload Excel and Run Shipping',
  '上传万代 Excel 并执行 Shipping': 'Upload Wandai Excel and Run Shipping',
  '等待上传万代 Excel 并执行 Shipping。': 'Waiting for Wandai Excel upload and Shipping run.',
  输入账号密码: 'Enter Username and Password',
  使用当前页面填写InforNexus登录凭据: 'Enter Infor Nexus login credentials on this page.',
  '使用当前页面填写 Infor Nexus 登录凭据。': 'Enter Infor Nexus login credentials on this page.',
  启动本地执行器: 'Start Local Executor',
  网页端和EXE都会走同一套本机启动器: 'The web app and EXE use the same local launcher.',
  '网页端和 EXE 都会走同一套本机启动器。': 'The web app and EXE use the same local launcher.',
  打开ShipmentScan: 'Open Shipment Scan',
  '打开 Shipment Scan': 'Open Shipment Scan',
  '依次进入 Applications、Print-Scan-Ship、Shipment Scan。':
    'Open Applications, Print-Scan-Ship, then Shipment Scan.',
  后续接入Excel: 'Add Excel Flow Later',
  '后续接入 Excel': 'Add Excel Flow Later',
  这一页后续继续承接Shipping的上传执行链路:
    'This page will continue to host the Shipping upload and execution flow.',
  '这一页后续继续承接 Shipping 的上传执行链路。':
    'This page will continue to host the Shipping upload and execution flow.',
  上传Excel文件: 'Upload Excel File',
  '上传 Excel 文件': 'Upload Excel File',
  '读取第一张表第二列，从第二行开始提取 10 位 ID。':
    'Read the second column of the first sheet and extract 10-digit IDs starting from row 2.',
  '由 3003 执行器启动可视浏览器并登录 Infor Nexus。':
    'Use the 3003 executor to launch a visible browser and log in to Infor Nexus.',
  自动搜索添加: 'Auto Search and Add',
  按Excel顺序逐个搜索勾选并点击添加: 'Search, select, and add each item in Excel order.',
  '按 Excel 顺序逐个搜索、勾选并点击添加。': 'Search, select, and add each item in Excel order.',
  查看结果: 'View Result',
  完成数量和失败明细会在页面下方返回: 'Completion counts and failure details appear below.',
  '完成数量和失败明细会在页面下方返回。': 'Completion counts and failure details appear below.',
  选择包含数据的xlsx或xls文件: 'Choose an .xlsx or .xls file containing data.',
  '选择包含数据的 .xlsx 或 .xls 文件。': 'Choose an .xlsx or .xls file containing data.',
  本地直连执行推荐: 'Local Direct Execution (Recommended)',
  '本地直连执行（推荐）': 'Local Direct Execution (Recommended)',
  前端直接把Excel发给本机执行器不经过n8n:
    'The frontend sends Excel directly to the local executor without n8n.',
  '前端直接把 Excel 发给本机执行器，不经过 n8n。':
    'The frontend sends Excel directly to the local executor without n8n.',
  发送至n8n保留: 'Send to n8n (Reserved)',
  '发送至 n8n（保留）': 'Send to n8n (Reserved)',
  如需编排通知审批数据库联动可继续走n8n链路:
    'Use the n8n path when orchestration, notifications, approvals, or database integration are needed.',
  '如需编排、通知、审批、数据库联动，可继续走 n8n 链路。':
    'Use the n8n path when orchestration, notifications, approvals, or database integration are needed.',
  在下方状态区查看执行结果: 'View execution results in the status area below.',
  '在下方状态区查看执行结果。': 'View execution results in the status area below.',
  本机已保存凭据: 'Stored local credentials',
  '本机已保存凭据。': 'Local credentials are saved.',
  本机未保存凭据首次执行前请填写账号密码并保存:
    'No local credentials are saved. Enter and save the username and password before the first run.',
  '本机未保存凭据。首次执行前请填写账号密码并保存。':
    'No local credentials are saved. Enter and save the username and password before the first run.',
  保存中: 'Saving',
  保存本机凭据: 'Save Local Credentials',
  清除中: 'Clearing',
  清除本机凭据: 'Clear Local Credentials',
  Excel文件: 'Excel File',
  'Excel 文件': 'Excel File',
  点击或拖入Excel文件: 'Click or drop an Excel file',
  '点击或拖入 Excel 文件': 'Click or drop an Excel file',
  释放以上传文件: 'Release to upload',
  执行中点点点: 'Running...',
  '执行中...': 'Running...',
  结果Excel: 'Result Excel',
  '结果 Excel': 'Result Excel',
  失败明细: 'Failure Details',
  运行中: 'Running',
  缺失: 'Missing',
  就绪: 'Ready',
  未连通: 'Disconnected',
  未连接: 'Disconnected',
  未启动: 'Not Started',
  待命: 'Idle',
  未就绪: 'Not Ready',
  执行中: 'Running',
  发送中: 'Sending',
  未完成: 'Incomplete',
  异常: 'Error',
  网络错误: 'Network error',
  等待文件上传并发送: 'Waiting for file upload and send.',
  '等待文件上传并发送。': 'Waiting for file upload and send.',
  '等待上传 Excel，并执行 Shipping 自动化。': 'Waiting for Excel upload and Shipping automation.',
  '等待上传 Excel，并执行 Infornexus 自动搜索添加。':
    'Waiting for Excel upload and Infornexus auto search/add.',
  '等待上传 Excel 并启动 Microsoft Login 自动化。':
    'Waiting for Excel upload and Microsoft Login automation.',
  '本机执行器尚未就绪，请先启动执行器后再试。':
    'The local executor is not ready. Start the executor and try again.',
  '正在上传 Excel，并登录 Infor Nexus 输入 PO No...':
    'Uploading Excel and logging in to Infor Nexus to enter PO No...',
  '正在上传 Excel，并启动 Infornexus 自动搜索添加...':
    'Uploading Excel and starting Infornexus auto search/add...',
  '正在将 Excel 直接发送给本机执行器并启动浏览器自动化...':
    'Sending Excel directly to the local executor and starting browser automation...',
  '正在上传文件到 n8n 并启动 Microsoft Login 自动化...':
    'Uploading the file to n8n and starting Microsoft Login automation...',
  'Shipping 自动化已触发，但未确认全部 PO No 输入完成。':
    'Shipping automation was triggered, but not all PO No entries were confirmed complete.',
  'Infornexus 自动搜索添加已触发，但未确认全部 ID 完成。':
    'Infornexus auto search/add was triggered, but not all IDs were confirmed complete.',
  '本地执行已触发，但未确认成功。': 'Local execution was triggered, but success was not confirmed.',
  '登录未完成，请查看原始响应了解详情。': 'Login is incomplete. Check the raw response for details.',
  运行: 'running',
  个任务: 'tasks',
  控制台信息: 'Console',
  供应方: 'Provider',
  地址: 'Address',
  查看: 'View',
  端口: 'Port',
  暂无已注册的网页自动化应用: 'No registered web automation apps',
  请先确认桌面端控制台模块已正常注册并暴露给当前前端:
    'Confirm the desktop console module is registered and exposed to the current frontend.',
  '请先确认桌面端控制台模块已正常注册并暴露给当前前端。':
    'Confirm the desktop console module is registered and exposed to the current frontend.',
  当前未选择控制台: 'No console selected',
  从上方列表选择一个控制台后这里会显示地址状态和嵌入预览:
    'Select a console above to show its address, status, and embedded preview here.',
  '从上方列表选择一个控制台后，这里会显示地址、状态和嵌入预览。':
    'Select a console above to show its address, status, and embedded preview here.',
  外部打开: 'Open External',
  当前地址: 'Current Address',
  当前状态: 'Current Status',
  '版本 / 端口': 'Version / Port',
  网页自动化控制台: 'Web Automation Console',
  控制台尚未启动: 'Console Not Started',
  启动后会在这里嵌入控制台页面便于你直接验证真实流程:
    'After startup, the console page will be embedded here so the real flow can be verified directly.',
  '启动后会在这里嵌入控制台页面，便于你直接验证真实流程。':
    'After startup, the console page will be embedded here so the real flow can be verified directly.',
  请选择EricInfornexus页面重新选择场景: 'Return to the Eric - Infornexus page and choose a scenario again.',
  '请返回 Eric - Infornexus 页面重新选择场景。': 'Return to the Eric - Infornexus page and choose a scenario again.',
  请选择JaneInfornexus页面重新选择场景: 'Return to the Jane - Infornexus page and choose a scenario again.',
  '请返回 Jane - Infornexus 页面重新选择场景。': 'Return to the Jane - Infornexus page and choose a scenario again.',
  '当前入口不存在，请返回 Jane - Infornexus 页面重新进入。':
    'The current entry does not exist. Return to the Jane - Infornexus page and open the scenario again.',
  '当前入口不存在，请返回 Eric - Infornexus 页面重新进入。':
    'The current entry does not exist. Return to the Eric - Infornexus page and open the scenario again.',
  选择Bulk类型: 'Select Bulk Type',
  '选择 Bulk 类型': 'Select Bulk Type',
  'Unreleased Bulk 和 released Bulk 会进入不同的浏览器自动化逻辑。':
    'Unreleased Bulk and released Bulk use different browser automation flows.',
  上传Excel: 'Upload Excel',
  '上传 Excel': 'Upload Excel',
  每个区域独立选择自己的xlsx或xls文件: 'Choose a separate .xlsx or .xls file for each area.',
  '每个区域独立选择自己的 .xlsx 或 .xls 文件。': 'Choose a separate .xlsx or .xls file for each area.',
  进入对应Bulk页面: 'Open the Matching Bulk Page',
  '进入对应 Bulk 页面': 'Open the Matching Bulk Page',
  '登录后进入 Event Management，并按区域点击 Released Bulk 或 Unreleased Bulk。':
    'After login, open Event Management and click Released Bulk or Unreleased Bulk by area.',
  并行执行: 'Parallel Execution',
  多个自动化任务可以同时运行不会互相占用同一个执行锁:
    'Multiple automation tasks can run at the same time without sharing one execution lock.',
  '多个自动化任务可以同时运行，不会互相占用同一个执行锁。':
    'Multiple automation tasks can run at the same time without sharing one execution lock.',
  Excel输入与启动: 'Excel Input and Launch',
  'Excel 输入与启动': 'Excel Input and Launch',
  选择Excel文件: 'Choose Excel File',
  '选择 Excel 文件': 'Choose Excel File',
  '支持 .xlsx / .xls': 'Supports .xlsx / .xls',
  等待选择Excel文件: 'Waiting for Excel file selection.',
  '等待选择 Excel 文件。': 'Waiting for Excel file selection.',
  执行器未就绪请先启动执行器: 'The executor is not ready. Start it first.',
  '执行器未就绪，请先启动执行器。': 'The executor is not ready. Start it first.',
  'Excel数据处理整合工具 - Eric': 'Excel Data Processing Tool - Eric',
  '核对流程 v0.2.0-alpha.1': 'Reconciliation Flow v0.2.0-alpha.1',
  '将 Pack Size breakdown 生成的 Final_Data 作为过渡明细，并自动解析 YTIC check 完成最终数量核对。':
    'Generate Final_Data from Pack Size breakdown, then parse YTIC check automatically for final quantity reconciliation.',
  '默认流程会输出诊断包：Summary、Size_Check、PO_Check、Final_Data 和 YTIC 审计明细。':
    'The default flow outputs a diagnostics package: Summary, Size_Check, PO_Check, Final_Data, and YTIC audit details.',
  '用于生成 Final_Data': 'Used to generate Final_Data',
  用于提取尺寸目的地和SP核对信息: 'Used to extract size, destination, and SP checks',
  '用于提取尺寸、目的地和 SP 核对信息': 'Used to extract size, destination, and SP checks',
  开始核对: 'Start Reconcile',
  '核对中...': 'Reconciling...',
  仅生成FinalData: 'Generate Final_Data Only',
  '仅生成 Final_Data': 'Generate Final_Data Only',
  下载结果: 'Download Result',
  '下载结果失败，请稍后重试': 'Failed to download the result. Please try again later.',
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
  '上传一个或多个 PDF 后，会在同一个结果 Excel 中追加箱单核对结果':
    'Upload one or more PDFs to append packing-list checks to the same result Excel file.',
  'Jessca 发票文件与参考表自动核对，输出价格差异和缺失款号整理结果。':
    'Automatically compare Jessca invoice files with the reference file and export price differences and missing style cleanup.',
  发票价格与参考表核对: 'Invoice price and reference file reconciliation',
  '处理前会检查必传文件是否齐全。': 'Required files are checked before processing.',
  '输出价格差异和缺失款号整理结果。': 'Outputs price differences and missing style cleanup results.',
  'Sophia & Tina 多类 Excel 文件统一合并，自动生成分析报表。':
    'Merge multiple Sophia & Tina Excel file types and generate analysis reports automatically.',
  '上传一个或多个 TMS 文件。': 'Upload one or more TMS files.',
  '上传一个或多个 Article 文件。': 'Upload one or more Article files.',
  '上传 article-season-cbd-app-hdw 类型文件，用于 Season、Marketing Forecast 和 TMS Price':
    'Upload article-season-cbd-app-hdw files for Season, Marketing Forecast, and TMS Price.',
  '上传一个或多个 Factory Price 文件。': 'Upload one or more Factory Price files.',
  '上传一个或多个 Pack 文件。': 'Upload one or more Pack files.',
  '按 PO 覆盖 Result 中的 Factory；未上传时使用 TMS Factory':
    'Override Result Factory by PO; uses TMS Factory when omitted.',
  '按 PO 覆盖 Shipment Method、PODD 和 Quantity；未上传时使用 TMS 字段':
    'Override Shipment Method, PODD, and Quantity by PO; uses TMS fields when omitted.',
  多类Excel文件统一合并: 'Merge multiple Excel file types',
  '多类 Excel 文件统一合并': 'Merge multiple Excel file types',
  '四类文件都需要至少上传 1 个。': 'Each of the four file groups requires at least one file.',
  'TMS、TMS Price 和 Factory Price 需要至少上传 1 个。':
    'TMS, TMS Price, and Factory Price each require at least one file.',
  'Allocation Factory 和 Shipment Method 未上传时，会使用 TMS 文件中的字段。':
    'When Allocation Factory and Shipment Method are omitted, fields from TMS are used.',
  '请先补齐 TMS、TMS Price 和 Factory Price 文件，再开始合并。':
    'Complete TMS, TMS Price, and Factory Price files before merging.',
  必传就绪: 'Required ready',
  '输出合并后的 Sophia & Tina 分析报表。': 'Exports the merged Sophia & Tina analysis report.',
  '上传客户文件和 country.xlsx 后自动生成标准成品表。':
    'Upload Copy of TMS and country.xlsx to generate the standard finished goods sheet.',
  '上传 Copy of TMS 和 country.xlsx 后自动生成标准成品表。':
    'Upload Copy of TMS and country.xlsx to generate the standard finished goods sheet.',
  'Copy of TMS + 国家区域统计 → 标准成品表':
    'Copy of TMS + Country/Region Statistics -> Standard Finished Goods Sheet',
  '上传 1 个客户原始文件。': 'Upload one Copy of TMS file.',
  '上传 1 个 Copy of TMS 文件。': 'Upload one Copy of TMS file.',
  上传国家区域统计文件: 'Upload the country/region statistics file',
  '上传国家/区域统计文件': 'Upload the country/region statistics file',
  '上传用于国家/区域单别统计的 country.xlsx。':
    'Upload country.xlsx for country/region order statistics.',
  'Working Number 筛选（可选）': 'Working Number Filter (optional)',
  多个WorkingNumber用英文逗号分隔: 'Separate multiple Working Numbers with commas',
  '多个 Working Number 用英文逗号分隔': 'Separate multiple Working Numbers with commas',
  多个值用英文逗号分隔: 'Separate multiple values with commas',
  客户文件生成标准成品表: 'Generate standard finished goods sheet from Copy of TMS',
  'Copy of TMS 生成标准成品表': 'Generate standard finished goods sheet from Copy of TMS',
  '只上传 1 个，支持 .xls / .xlsx': 'Upload exactly 1 file, supports .xls / .xlsx',
  '只上传 1 个，仅支持 .xlsx': 'Upload exactly 1 file, supports .xlsx only',
  'Working Number 筛选为可选项，多个值用英文逗号分隔。':
    'Working Number filter is optional. Separate multiple values with commas.',
  '输出标准成品表和对应统计结果。': 'Exports the standard finished goods sheet and statistics.',
  '上传多个 BOM 文件和 Pack.xlsx，按 Working # + Season 匹配 Pack，并生成 MAIN COMPONENT 汇总表。':
    'Upload multiple BOM files and Pack.xlsx, match Pack by Working # + Season, and generate the MAIN COMPONENT summary.',
  BOM汇总: 'BOM Summary',
  '多 BOM 文件 + Pack 映射 → MAIN COMPONENT 汇总':
    'Multiple BOM Files + Pack Mapping -> MAIN COMPONENT Summary',
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
  PRODUCTION核对: 'PRODUCTION Compare',
  'T1 PRODUCTION × BOM汇总 → PRODUCTION差异核对':
    'T1 PRODUCTION x BOM Summary -> PRODUCTION Difference Check',
  '上传 1 个 T1 PRODUCTION.xlsx，输出会保留原表样式并标红差异。':
    'Upload one T1 PRODUCTION.xlsx. The output keeps the original sheet styling and marks differences in red.',
  输出会保留原表样式并标红差异:
    'The output keeps the original sheet styling and marks differences in red',
  检查CDEEF材料多缺并计算料率:
    'Check C-D-E-F, material differences, and calculate material rate',
  '检查 C-D-E-F、材料多缺并计算料率':
    'Check C-D-E-F, material differences, and calculate material rate',
  '上传 1 个 Jane - BOM汇总 生成的 BOM汇总.xlsx。':
    'Upload one BOM Summary.xlsx generated by Jane BOM Summary.',
  'BOM汇总 生成的材料清单': 'Material list generated by BOM Summary',
  'T1 PRODUCTION 与 BOM 面料核对': 'T1 PRODUCTION and BOM Material Check',
  'T1 PRODUCTION 与 BOM汇总 PRODUCTION核对':
    'T1 PRODUCTION and BOM Summary PRODUCTION Compare',
  '只上传 1 个，支持 .xlsx / .xlsm': 'Upload exactly 1 file, supports .xlsx / .xlsm',
  '按 Style ID + Recording Facility ID 匹配 BOM 的 Article + Factory。':
    'Match BOM Article + Factory by Style ID + Recording Facility ID.',
  '按 Style ID + Recording Facility ID 匹配 BOM汇总 的 Articles + Factory。':
    'Match BOM Summary Articles + Factory by Style ID + Recording Facility ID.',
  '按 Style ID + Production Lot ID 分组检查 C-D-E-F 是否一致。':
    'Check whether C-D-E-F are consistent within each Style ID + Production Lot ID group.',
  '按 Style ID + Recording Facility ID 对比 BOM汇总 的 Articles + Factory 材料集合，多出的材料加删除线，缺少的材料补入新行。':
    'Compare BOM Summary Articles + Factory material sets by Style ID + Recording Facility ID; strike extra materials and insert missing material rows.',
  '按同 Style ID + Production Lot ID + Input Material UID/ID 计算料率。':
    'Calculate material rate by Style ID + Production Lot ID + Input Material UID/ID.',
  '上传 T1 OUTBOUND.xlsx 和 TMS Released Order 报表，按 Style/PO/Line/Factory 核对数量、PODD 和 Working Number。':
    'Upload T1 OUTBOUND.xlsx and Copy of TMS, then compare quantity, PODD, and Working Number by Style/PO/Line/Factory.',
  '上传 T1 OUTBOUND.xlsx 和 Copy of TMS 报表，按 Style/PO/Line/Factory 核对数量、PODD 和 Working Number。':
    'Upload T1 OUTBOUND.xlsx and Copy of TMS, then compare quantity, PODD, and Working Number by Style/PO/Line/Factory.',
  OUTBOUND核对: 'OUTBOUND Compare',
  'T1 OUTBOUND × TMS 报表 → 出库差异核对':
    'T1 OUTBOUND x TMS Report -> Outbound Difference Check',
  '上传 1 个 T1 OUTBOUND.xlsx，输出会保留原表样式并标红差异。':
    'Upload one T1 OUTBOUND.xlsx. The output keeps the original sheet styling and marks differences in red.',
  '上传 1 个包含 Result Set 的 TMS Released Order 报表。':
    'Upload one Copy of TMS report containing Result Set.',
  '上传 1 个包含 Result Set 的 Copy of TMS 报表。':
    'Upload one Copy of TMS report containing Result Set.',
  '包含 Result Set 的 TMS 报表': 'TMS report containing Result Set',
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
  预览参考: 'Preview reference',
  未读取: 'Not read',
  安装版: 'Installed',
  '服务器 / 浏览器': 'Server / Browser',
  开发预览: 'Development / Preview',
  '开发/预览': 'Development / Preview',
  '检查中...': 'Checking...',
  检查更新: 'Check for Updates',
  立即检查: 'Check Now',
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
  系统: 'System',
  版本更新记录: 'Version Update Log',
  查看最近版本更新内容: 'Review recent version updates',
  查看每次更新影响的页面和内容: 'View affected pages and update details',
  '语言、版本更新与自动化助手': 'Language, updates, and automation helper',
  更新管理中心: 'Update Management Center',
  '检查、下载与安装桌面客户端更新': 'Check, download, and install desktop client updates',
  系统更新下载中: 'System update downloading',
  下载中心: 'Download Center',
  推荐下载: 'Recommended',
  '根据您的使用场景，选择部署桌面完整端或安装网页轻量级扩展':
    'Choose a full desktop deployment or lightweight web extension based on your usage scenario',
  独立桌面客户端套件: 'Standalone Desktop Client Suite',
  'TOS 桌面端轻量安装器': 'TOS Desktop Lightweight Installer',
  在线下载: 'Online Download',
  '体积轻巧，首选安装。在线从 MinIO 自动下载完整组件。':
    'Small installer, recommended for most installs. It downloads the full component package from MinIO during installation.',
  '获取中...': 'Preparing...',
  安全下载轻量安装器: 'Download Lightweight Installer',
  'TOS 桌面端全量部署包': 'TOS Desktop Full Deployment Package',
  离线全量: 'Full Offline',
  '集成完整运行环境，完全离线一键部署，适合物理内网环境。':
    'Includes the full runtime for one-click offline deployment, suitable for isolated intranet environments.',
  安全下载离线全量包: 'Download Full Offline Package',
  免安装绿色便携版: 'Portable No-install Edition',
  绿色便携: 'Portable',
  '解压即用，无缝集成运行组件。': 'Unzip and run with integrated runtime components.',
  '准备中...': 'Preparing...',
  获取免安装版: 'Get No-install Version',
  网页自动化助手: 'Web Automation Helper',
  'TOS 网页桥接小助手': 'TOS Web Bridge Helper',
  浏览器扩展: 'Browser Extension',
  完整安装包: 'Full Installer',
  浏览器专属: 'Browser Only',
  '专为 Web 浏览器打造的轻量级桥接组件，网页端直连调度。':
    'A lightweight bridge for web browsers, enabling direct scheduling from the web app.',
  '下载一次即可完整安装，安装阶段不再联网获取组件。':
    'Download once for a complete install. The installer no longer fetches components during setup.',
  '极速搭建：免本地客户端安装': 'Fast setup: no local desktop client install',
  '完整内置：包含小助手运行组件': 'Fully embedded: includes helper runtime components',
  '极速轻量：免去客户端安装': 'Lightweight: no full client install',
  '即开即用：网页与本机无缝桥接': 'Ready to use: bridges the web page and local machine',
  '安全隔离：严格鉴权防越权': 'Secure isolation: strict authorization to prevent privilege overreach',
  '离线安装：安装过程不再依赖公网下载': 'Offline setup: installation no longer depends on public downloads',
  极速下载助手扩展: 'Download Helper Extension',
  下载完整小助手安装包: 'Download Full Helper Installer',
  线上连接中: 'Online',
  '当前运行于 Web 服务器 / 浏览器沙盒中。当您登录桌面客户端时，本面板将自动启用增量更新检测。':
    'Running in the web server / browser sandbox. When you sign in to the desktop client, this panel automatically enables incremental update checks.',
  云端服务: 'Cloud Server',
  连接正常: 'Connected',
  网页应用: 'Web App',
  运行参数: 'Runtime Parameters',
  轻量安装器版本: 'Lightweight Installer Version',
  离线全量包版本: 'Offline Full Package Version',
  网页小助手版本: 'Web Helper Version',
  桌面客户端更新: 'Desktop Client Updates',
  '当前运行在服务器 / 浏览器环境，桌面客户端会显示自动更新能力。':
    'The current runtime is server / browser mode. Automatic update controls are shown in the desktop client.',
  'TOS 应用安装包': 'TOS App Installer',
  '下载完整桌面版，安装后连接服务器后端，并保留本机自动化能力。':
    'Download the full desktop app. It connects to the server backend and keeps local automation capabilities.',
  'TOS 完整安装包': 'TOS Full Installer',
  '下载单个完整安装包，安装阶段不再连接 MinIO 下载组件。':
    'Download one complete installer. Installation no longer connects to MinIO to fetch components.',
  '已打开 TOS 完整安装包下载。': 'TOS full installer download opened.',
  'TOS 完整安装包下载失败': 'Failed to download the TOS full installer',
  '已打开 TOS 应用安装包下载。': 'TOS app installer download opened.',
  'TOS 应用安装包下载失败': 'Failed to download the TOS app installer',
  自动化助手安装包: 'Automation Helper Installer',
  '新用户安装后即可在浏览器页面启动本机自动化助手。':
    'After installation, new users can start the local automation helper from browser pages.',
  下载安装包: 'Download Installer',
  版本与环境: 'Version and Environment',
  安装并重启: 'Install and Restart',
  '安装中...': 'Installing...',
  下载: 'Download',
  已打开自动化助手安装包下载: 'Automation helper installer download opened',
  '已打开自动化助手安装包下载。': 'Automation helper installer download opened.',
  自动化助手安装包下载失败: 'Failed to download the automation helper installer',
  运行信息: 'Runtime Information',
  本机自动化: 'Local Automation',
  桌面客户端: 'Desktop Client',
  更新操作: 'Update Actions',
  导出运行参数: 'Export Runtime Parameters',
  更新内容: 'Update Details',
  全部: 'All',
  新功能: 'New Features',
  问题修复: 'Fixes',
  体验优化: 'Experience Improvements',
  探索我们每一次的演进功能迭代页面优化与系统修复:
    'Explore each release: feature iteration, page improvements, and system fixes',
  '探索我们每一次的演进：功能迭代、页面优化与系统修复。':
    'Explore each release: feature iteration, page improvements, and system fixes.',
  同步中: 'Syncing',
  刷新记录: 'Refresh Records',
  总计记录数: 'Total Records',
  涉及页面: 'Affected Pages',
  最新版本: 'Latest Version',
  重新尝试: 'Try Again',
  '正在获取最新的版本动态...': 'Loading the latest version updates...',
  暂无相关记录: 'No matching records',
  '当前筛选条件下没有找到版本更新日志。': 'No version update logs match the current filter.',
  '本次更新带来了一些性能提升与细节优化。': 'This update includes performance improvements and detail refinements.',
  全局通用: 'Global',
  '获取版本记录失败，请检查网络后重试。': 'Failed to load version records. Check the network and try again.',
  本地版本说明: 'Local release notes',
  '后端未连接，当前显示本地版本说明。': 'Backend is not connected. Showing local release notes.',
  无法连接后端服务: 'Unable to connect to the backend service',
  '版本更新记录页本地 fallback 支持展示内置历史版本记录。':
    'The Version Update Log local fallback now shows built-in historical release records.',
  '修复 Draft & Packing List 核对结果中 Goods Description 误带入 PDF 免责声明和页码的问题。':
    'Fixed Draft & Packing List results including PDF disclaimer text and page numbers in Goods Description.',
  '修复版本更新记录页在浏览器模式且后端未启动时显示 Failed to fetch 的问题，改为展示本地版本说明。':
    'Fixed the Version Update Log showing Failed to fetch in browser mode when the backend is not running; it now shows local release notes.',
  '优化处理记录面板为内部滚动，避免长记录撑高页面。':
    'Optimized the processing history panel with internal scrolling to prevent long records from stretching the page.',
  '修正 Draft & Packing List 核对结果中字段缺失状态，只显示“需反馈”，不再附带 Nydia。':
    'Fixed the Draft & Packing List missing-field status to show only "Feedback required" without appending Nydia.',
  '优化 Draft & Packing List 核对结果分隔行样式，组间空白行改用浅色填充，避免误判为空白问题行。':
    'Optimized the Draft & Packing List result separator rows with a light fill so blank group dividers are not mistaken for issue rows.',
  '请先配置正式更新地址，再下载免安装版。': 'Configure the update source before downloading the no-install version.',
  '更新源暂未提供免安装版下载。': 'The update source has not provided a no-install download.',
  '更新源暂未提供 changelog.json': 'The update source has not provided changelog.json',
  检查到新版本后会显示新增优化和修复内容: 'Added, improved, and fixed items will appear after a new version is found',
  '检查到新版本后会显示新增、优化和修复内容': 'Added, improved, and fixed items will appear after a new version is found',
  '侧边栏新增收起/展开能力，Excel、浏览器自动化和网页数据爬取支持分组折叠。':
    'The sidebar now supports hide/show, and Excel, Browser Automation, and Web Data Collection support collapsible groups.',
  'Excel 处理下新增 Jane - 表格制作分组，统一收纳成品表生成和 Jane - BOM汇总。':
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
  'TMS 财务追加结果统计，显示追加行、重复跳过、相似已追加、Sales/Purchase 追加数量。':
    'TMS Finance append results now show appended rows, skipped duplicates, similar appended rows, and Sales/Purchase appended counts.',
  '内销对账表从“回填已有行”调整为向未清账追加缺失行，避免覆盖已有数据。':
    'Internal reconciliation now appends missing rows to the open-item sheet instead of backfilling existing rows, avoiding accidental overwrites.',
  'Work Sales 调整为“BULK Sales 导出表 + TURNOVER 目标表”的追加流程。':
    'Work Sales now uses a BULK Sales export plus a TURNOVER target workbook for the append workflow.',
  'Work Sales 调整为从 BULK Sales 导出表重建 TURNOVER Turnover Details 明细。':
    'Work Sales now rebuilds TURNOVER Turnover Details from the BULK Sales export.',
  'Work Sales 改为从 BULK Sales 导出表重建 TURNOVER 的 Turnover Details 明细，目标表旧明细会先清空再按源行写入。':
    'Work Sales now rebuilds TURNOVER Turnover Details from the BULK Sales export, clearing old target rows before writing source rows.',
  '重建 Work Sales 明细': 'Rebuild Work Sales Details',
  '文件上传支持拖拽追加多文件，拖拽状态更稳定。':
    'File upload now supports drag-and-drop appending for multiple files with more stable drag state handling.',
  '修复 TMS 财务追加时重复识别、格式复制、公式平移和小计范围更新不稳定的问题。':
    'Fixed unstable duplicate detection, format copying, formula translation, and subtotal range updates in TMS Finance append processing.',
  '服务器/浏览器模式下的系统设置页改为只展示版本、运行环境和语言。':
    'In server/browser mode, Settings now shows only version, runtime, and language.',
  '英文模式面包屑改为使用完整页面标题，避免只显示左侧导航短名。':
    'English breadcrumbs now use full page titles instead of sidebar short labels.',
  'Jane、TMS Finance、Infornexus、adidas Materials 等页面补齐英文业务文案。':
    'Added English business copy for Jane, TMS Finance, Infornexus, adidas Materials, and related pages.',
  '修复浏览器/服务器模式仍显示桌面安装包更新入口和诊断包按钮的问题。':
    'Fixed browser/server mode still showing desktop installer update controls and the diagnostics package button.',
  TMS财务表格数据处理: 'TMS Finance Spreadsheet Processing',
  内销对账单数据写入: 'Internal Reconciliation Data Fill',
  Turnover数据写入: 'Turnover Data Fill',
  'Sample/Bulk 来源文件 → 内销对账大表尾部追加':
    'Sample/Bulk Source Files -> Append to Internal Reconciliation Workbook',
  'BULK Sales 导出表 → TURNOVER Turnover Details 尾部追加':
    'BULK Sales Export -> Append to TURNOVER Turnover Details',
  'BULK Sales 导出表 → 写入 TURNOVER Turnover Details':
    'BULK Sales Export -> Fill TURNOVER Turnover Details',
  追加进度: 'Append Progress',
  写入进度: 'Fill Progress',
  开始写入: 'Start Fill',
  '追加中...': 'Appending...',
  '写入中...': 'Filling...',
  'BULK Sales 导出表': 'BULK Sales Export',
  'iPLEX 导出表': 'iPLEX Export Workbook',
  '上传从 iPlex 导出的 bulk sales 表，系统会读取对应列追加到 TURNOVER':
    'Upload the bulk sales export from iPlex; the system reads matching columns and appends them to TURNOVER.',
  '上传从 iPlex 导出的 bulk sales 表，系统会读取对应列写入 TURNOVER':
    'Upload the bulk sales export from iPlex; the system reads matching columns and fills TURNOVER.',
  'TURNOVER 目标表': 'TURNOVER Target Workbook',
  'Turnover Excel': 'Turnover Workbook',
  '上传要追加 Turnover Details 明细的 TURNOVER 工作簿':
    'Upload the TURNOVER workbook that will receive Turnover Details rows.',
  '上传要重建 Turnover Details 明细的 TURNOVER 工作簿':
    'Upload the TURNOVER workbook whose Turnover Details will be rebuilt.',
  'Sample/Bulk 来源文件': 'Sample/Bulk Source Files',
  可一次上传多个合并Sample合并BULK工作簿按上传顺序追加缺失行:
    'Upload multiple merged Sample and merged BULK workbooks; missing rows are appended in upload order.',
  '可一次上传多个合并Sample、合并BULK工作簿，按上传顺序追加缺失行':
    'Upload multiple merged Sample and merged BULK workbooks; missing rows are appended in upload order.',
  内销对账单: 'Internal Reconciliation Workbook',
  上传要追加缺失数据的内销对账大表:
    'Upload the internal reconciliation workbook that will receive missing rows.',
  '请先按预检查提示补齐文件。': 'Complete the file precheck before processing.',
  '请先上传 Sample/Bulk 来源文件和内销对账单。':
    'Upload the Sample/Bulk source files and internal reconciliation workbook first.',
  '请先上传 BULK Sales 导出表。': 'Upload the BULK Sales export first.',
  '请先上传 TURNOVER 目标表。': 'Upload the TURNOVER target workbook first.',
  '请先上传 iPLEX 导出表。': 'Upload the iPLEX export workbook first.',
  '请先上传 Turnover Excel。': 'Upload the Turnover workbook first.',
  内销对账表数据提取: 'Internal Reconciliation Data Extraction',
  WorkSales数据追加: 'Work Sales Data Append',
  'Work Sales 数据追加': 'Work Sales Data Append',
  WorkSales数据写入: 'Work Sales Data Fill',
  'Work Sales 数据写入': 'Work Sales Data Fill',
  来源提取行: 'Extracted Source Rows',
  'Sample 行': 'Sample Rows',
  'Bulk 行': 'Bulk Rows',
  重复跳过: 'Skipped Duplicates',
  相似已追加: 'Similar Rows Already Appended',
  目标处理行: 'Processed Target Rows',
  排除行: 'Excluded Rows',
  排除列: 'Excluded Columns',
  'QTY 合计': 'QTY Total',
  'Purchase 合计': 'Purchase Total',
  'Sales 含税合计': 'Sales Total With Tax',
  诊断项: 'Diagnostics',
  源行: 'Source Rows',
  写入行: 'Written Rows',
  'Sales 追加': 'Sales Appended',
  'Purchase 追加': 'Purchase Appended',
  'Sales 写入': 'Sales Written',
  'Purchase 写入': 'Purchase Written',
  清空旧行: 'Cleared Rows',
  Infornexus子应用: 'Infornexus Sub-Application',
  'Infornexus 子应用': 'Infornexus Sub-Application',
  当前运行环境不支持外部子应用管理:
    'The current runtime does not support external sub-application management',
  当前运行环境不支持启动外部子应用:
    'The current runtime does not support launching external sub-applications',
  外部Electron子应用: 'External Electron Sub-Application',
  '外部 Electron 子应用': 'External Electron Sub-Application',
  启动应用: 'Launch App',
  模块详情: 'Module Details',
  基本信息: 'Basic Information',
  模块ID: 'Module ID',
  '模块 ID': 'Module ID',
  模块名称: 'Module Name',
  接入方式: 'Integration Mode',
  部署信息: 'Deployment Information',
  入口文件: 'Entry File',
  运行状态: 'Run Status',
  备注: 'Notes',
  部署时请保留完整运行时目录: 'Keep the complete runtime directory when deploying',
  Electron子应用: 'Electron Sub-Application',
  'Electron 子应用': 'Electron Sub-Application',
  '已检测到 Infornexus 外部应用。': 'Infornexus external app detected.',
  '未找到 Infornexus 整包，请确认 external-apps/infornexus 目录完整。':
    'Infornexus package was not found. Confirm external-apps/infornexus is complete.',
  读取状态失败: 'Failed to read status',
  'Infornexus 已启动。': 'Infornexus launched.',
  启动失败: 'Launch failed',
  整包缺失: 'Package Missing',
  模块信息: 'Module Information',
  运行方式: 'Run Mode',
  当前按外部Electron子应用方式接入: 'Currently integrated as an external Electron sub-application',
  '当前按外部 Electron 子应用方式接入。':
    'Currently integrated as an external Electron sub-application.',
  网页数据爬取: 'Web Data Collection',
  'adidas 材料数据收集器': 'adidas Materials Data Collector',
  '通过外部浏览器登录后自动监听 Materials 接口，批量采集并本地落盘。':
    'After login in an external browser, automatically listen to Materials API responses, collect in batches, and save locally.',
  打开外部浏览器: 'Open External Browser',
  操作提示: 'Operation Tips',
  运行流程: 'Workflow',
  采集方式: 'Collection Method',
  浏览器监听: 'Browser Listener',
  '外部 Edge/Chrome 登录后监听 Materials 接口响应':
    'Listen to Materials API responses after login in external Edge/Chrome',
  保存策略: 'Save Strategy',
  自动落盘: 'Auto Save',
  '默认每 2000 条保存 JSON 与 CSV 双格式': 'By default, save both JSON and CSV every 2,000 records',
  恢复能力: 'Recovery',
  断点续传: 'Resume Support',
  '本地保存去重 ID 与待保存批次，支持恢复':
    'Deduplicated IDs and pending batches are saved locally for recovery',
  '采集器运行在外部浏览器窗口中，不会在主应用里直接请求 adidas 页面。':
    'The collector runs in an external browser window and does not request adidas pages directly from the main app.',
  '登录入口、账号权限和 Materials 列表页路径都按业务实际操作为准。':
    'The login entry, account permissions, and Materials list path follow the actual business workflow.',
  '采集结束前先保存当前批次，避免剩余数据只在内存里。':
    'Save the current batch before ending collection so remaining data is not only kept in memory.',
  '打开外部 Edge/Chrome，在右侧"网页地址"输入登录入口并前往':
    'Open external Edge/Chrome, enter the login URL in the Web Address field on the right, and navigate.',
  '在外部浏览器里完成账号登录，并按正常路径进入 Materials 列表页':
    'Complete account login in the external browser, then navigate to the Materials list through the normal path.',
  '进入 Materials 列表页，确认右上角显示"接口捕获：已启用"':
    'On the Materials list page, confirm the top-right indicator shows "API Capture: Enabled".',
  '点击"获取当前页"或"开始自动翻页"':
    'Click "Get Current Page" or "Start Auto Pagination".',
  '结束前点击"保存当前批次"，避免剩余数据未落盘':
    'Before ending, click "Save Current Batch" so remaining data is written to disk.',
  '打开 adidas 外部浏览器失败': 'Failed to open the adidas external browser',
  'adidas 外部浏览器已在运行': 'The adidas external browser is already running',
  'adidas 外部浏览器已打开': 'The adidas external browser has opened',
  '本机后台启动器版本过旧，缺少 adidas 网页端启动接口。请重启或更新后台启动器后再试。':
    'The local backend launcher is outdated and lacks the adidas web launcher API. Restart or update the backend launcher and try again.',
  '无法一键启动本机后台启动器。请确认已安装新版 TOS，且浏览器允许打开 tos://automation/launcher/start。':
    'Unable to start the local backend launcher automatically. Confirm the latest TOS is installed and the browser allows tos://automation/launcher/start.',
  'TOS 自动化助手更新': 'TOS Automation Helper Update',
  '优先检查并热更新本机小助手功能模块；如果提示壳子版本过旧，请到下载中心安装最新完整包。':
    'Check and hot update local helper modules first. If the shell version is too old, install the latest full package from the Download Center.',
  '功能模块热更新': 'Module Hot Update',
  已检查: 'Checked',
  已更新: 'Updated',
  已最新: 'Latest',
  待切换: 'Pending Switch',
  受限: 'Blocked',
  '检查并热更新功能模块': 'Check and Hot Update Modules',
  '热更新中...': 'Hot Updating...',
  热更新中: 'Hot Updating',
  热更新失败: 'Hot Update Failed',
  热更新完成: 'Hot Update Complete',
  检查失败: 'Check Failed',
  壳子需更新: 'Shell Update Required',
  壳子有新版: 'Shell Update Available',
  本机较新: 'Local Version Is Newer',
  可热更新: 'Ready for Hot Update',
  服务器未知: 'Server Version Unknown',
  部分失败: 'Partially Failed',
  已下载待切换: 'Downloaded, Pending Switch',
  '正在检测服务器自动化模块，并把最新功能逻辑同步到本机小助手。':
    'Checking server automation modules and syncing the latest logic to the local helper.',
  '正在读取本机小助手壳子版本和服务器功能模块清单。':
    'Reading the local helper shell version and server module manifest.',
  '服务器功能模块要求更高版本的小助手壳子，请到下载中心安装最新完整包。':
    'Server modules require a newer helper shell. Install the latest full package from the Download Center.',
  '部分自动化功能模块热更新失败，请稍后重试。':
    'Some automation modules failed to hot update. Try again later.',
  '新功能逻辑已下载。当前有执行器正在运行，本次任务结束后会自动切换到新模块。':
    'New logic has been downloaded. A runner is active, so it will switch after the current task finishes.',
  '新功能逻辑已下载。当前有执行器正在运行，任务结束后会自动切换。':
    'New logic has been downloaded. A runner is active, so it will switch after the current task finishes.',
  '自动化功能逻辑已同步到本机小助手，无需重新下载安装包。':
    'Automation logic has been synced to the local helper. No reinstall is required.',
  '自动化功能逻辑已经和服务器保持一致，无需重新下载安装包。':
    'Automation logic is already aligned with the server. No reinstall is required.',
  '点击检查并热更新后，会先检测小助手壳子，再同步服务器最新功能逻辑。':
    'Click hot update to check the helper shell first, then sync the latest server-side logic.',
  '暂时无法读取服务器小助手版本，请稍后重新检查。':
    'The server helper version cannot be read right now. Check again later.',
  '服务器已有新版小助手壳子。壳子能力变化无法靠热更新完成，请到下载中心安装最新完整包。':
    'A newer helper shell is available on the server. Shell capability changes need the latest full package from the Download Center.',
  '本机小助手版本高于服务器记录，请确认服务器安装包清单是否已经更新。':
    'The local helper is newer than the server record. Confirm the server installer manifest is up to date.',
  '当前小助手壳子版本一致，可直接热更新里面的自动化功能逻辑。':
    'The helper shell version matches, so the automation logic can be hot updated directly.',
  '部分模块要求更新小助手壳子，请到下载中心安装最新完整包。':
    'Some modules require a newer helper shell. Install the latest full package from the Download Center.',
  '自动化功能模块热更新完成。':
    'Automation modules were hot updated successfully.',
  '自动化功能模块已经是最新。':
    'Automation modules are already up to date.',
  '自动化功能模块热更新失败。':
    'Automation module hot update failed.',
  自动化功能模块热更新失败: 'Automation module hot update failed',
  '未检测到正在运行的本机小助手。请先启动小助手；如果仍然失败，请到下载中心安装最新完整包。':
    'No running local helper was detected. Start the helper first. If it still fails, install the latest full package from the Download Center.',
  '本机小助手壳子版本低于服务器最新版本。壳子能力变化不能热更新，请到下载中心安装最新完整包。':
    'The local helper shell version is older than the server version. Shell capability changes cannot be hot updated. Install the latest full package from the Download Center.',
}

const normalizedStaticTextTranslations: Record<string, string> = Object.fromEntries(
  Object.entries(staticTextTranslations).map(([key, value]) => [normalizeStaticText(key), value]),
)

export function setAppLanguage(language: AppLanguage): void {
  currentLanguage.value = language

  try {
    const globalStore = useGlobalStore()
    const koiLanguage = appLanguageToKoiLanguage(language)
    if (globalStore.language !== koiLanguage) {
      globalStore.setGlobalState('language', koiLanguage)
    }
  } catch (_error) {
    // Pinia is not active during isolated module tests; the local ref still drives legacy i18n.
  }
}

export function syncAppLanguageFromKoi(language: KoiLanguage): void {
  const nextLanguage = koiLanguageToAppLanguage(language)
  if (currentLanguage.value !== nextLanguage) {
    currentLanguage.value = nextLanguage
  }
}

export function translateText(key: TranslationKey, language = currentLanguage.value): string {
  return translations[key][language]
}

export function translateStaticText(value: string, language = currentLanguage.value): string {
  if (language === 'zh-CN' || !value) {
    return value
  }

  const directTranslation = staticTextTranslations[value] ?? normalizedStaticTextTranslations[normalizeStaticText(value)]
  if (directTranslation !== undefined) {
    return directTranslation
  }

  const installerUpdateTitleMatch = value.match(/^发现安装包更新 (.+)，点击下载最新版完整安装包$/)
  if (installerUpdateTitleMatch) {
    return `Installer update ${installerUpdateTitleMatch[1]} available. Click to download the latest full installer.`
  }

  const serverInstallerUpdateMatch = value.match(/^服务器已有 (.+)，可从右上角下载最新版完整安装包。$/)
  if (serverInstallerUpdateMatch) {
    return `Server has ${serverInstallerUpdateMatch[1]}; download the latest full installer from the top right.`
  }

  const installerDownloadStartedMatch = value.match(/^正在下载 (.+) 完整安装包，下载完成后请按安装向导覆盖安装。$/)
  if (installerDownloadStartedMatch) {
    return `Downloading the ${installerDownloadStartedMatch[1]} full installer. After it finishes, follow the installer to overwrite the current version.`
  }

  const templateCountMatch = value.match(/^(\d+) 个模板$/)
  if (templateCountMatch) {
    return `${templateCountMatch[1]} templates`
  }

  const rowCountMatch = value.match(/^(\d+) 行$/)
  if (rowCountMatch) {
    return `${rowCountMatch[1]} rows`
  }

  const disableTemplateConfirmMatch = value.match(/^确定停用模板「(.+)」吗？停用后该模板将不再出现在下载选项中。$/)
  if (disableTemplateConfirmMatch) {
    return `Disable template "${disableTemplateConfirmMatch[1]}"? It will no longer appear in download options.`
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

  const requiredGroupBadgeMatch = value.match(/^(\d+) 组必传$/)
  if (requiredGroupBadgeMatch) {
    return `${requiredGroupBadgeMatch[1]} required groups`
  }

  const optionalGroupBadgeMatch = value.match(/^(\d+) 组可选$/)
  if (optionalGroupBadgeMatch) {
    return `${optionalGroupBadgeMatch[1]} optional groups`
  }

  const mixedGroupBadgeMatch = value.match(/^(\d+) 组必传 \+ (\d+) 组可选$/)
  if (mixedGroupBadgeMatch) {
    return `${mixedGroupBadgeMatch[1]} required groups + ${mixedGroupBadgeMatch[2]} optional groups`
  }

  const rejectedFilesMatch = value.match(/^不支持的文件格式：(.+)$/)
  if (rejectedFilesMatch) {
    return `Unsupported file format: ${rejectedFilesMatch[1]}`
  }

  const selectedLaunchMatch = value.match(/^(.+) 已选择，等待启动。$/)
  if (selectedLaunchMatch) {
    return `${selectedLaunchMatch[1]} selected. Waiting to launch.`
  }

  const bulkLaunchMatch = value.match(/^(.+) 正在启动\.\.\.$/)
  if (bulkLaunchMatch) {
    return `${bulkLaunchMatch[1]} is launching...`
  }

  const bulkStartedMatch = value.match(/^(.+) 已启动。$/)
  if (bulkStartedMatch) {
    return `${bulkStartedMatch[1]} started.`
  }

  const localHttpFailureMatch = value.match(/^本地执行失败，HTTP (\d+)。$/)
  if (localHttpFailureMatch) {
    return `Local execution failed, HTTP ${localHttpFailureMatch[1]}.`
  }

  const requestHttpFailureMatch = value.match(/^请求失败，HTTP (\d+)。$/)
  if (requestHttpFailureMatch) {
    return `Request failed, HTTP ${requestHttpFailureMatch[1]}.`
  }

  const launcherHttpFailureMatch = value.match(/^本机启动器请求失败，HTTP (\d+)$/)
  if (launcherHttpFailureMatch) {
    return `Local launcher request failed, HTTP ${launcherHttpFailureMatch[1]}`
  }

  const shippingCompleteMatch = value.match(/^Shipping 自动化完成。已输入 (.+) 个 PO No。$/)
  if (shippingCompleteMatch) {
    return `Shipping automation completed. Entered ${shippingCompleteMatch[1]} PO No.`
  }

  const infornexusCompleteMatch = value.match(/^Infornexus 自动搜索添加完成。已处理 (.+) 个 ID。$/)
  if (infornexusCompleteMatch) {
    return `Infornexus auto search/add completed. Processed ${infornexusCompleteMatch[1]} IDs.`
  }

  const directCompleteMatch = value.match(/^本地直连执行成功。已处理 (.+) 行数据。$/)
  if (directCompleteMatch) {
    return `Local direct execution completed. Processed ${directCompleteMatch[1]} rows.`
  }

  const loginCompleteMatch = value.match(/^登录成功。已处理 (.+) 行数据。$/)
  if (loginCompleteMatch) {
    return `Login succeeded. Processed ${loginCompleteMatch[1]} rows.`
  }

  const localExceptionMatch = value.match(/^本地执行异常：(.+)$/)
  if (localExceptionMatch) {
    return `Local execution error: ${translateStaticText(localExceptionMatch[1], language)}`
  }

  const sendExceptionMatch = value.match(/^发送异常：(.+)$/)
  if (sendExceptionMatch) {
    return `Send error: ${translateStaticText(sendExceptionMatch[1], language)}`
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
