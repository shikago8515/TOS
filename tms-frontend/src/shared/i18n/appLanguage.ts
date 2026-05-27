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
    'zh-CN': '对账核对 / 报表合并 / Jane-表格制作 / Eric',
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
    'zh-CN': '自动化试验区',
    'en-US': 'Automation Lab',
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
    'zh-CN': '对账核对',
    'en-US': 'Reconciliation',
  },
  'app.module.open': {
    'zh-CN': '打开',
    'en-US': 'Open',
  },
} as const

export type TranslationKey = keyof typeof translations

export function setAppLanguage(language: AppLanguage): void {
  currentLanguage.value = language
}

export function translateText(key: TranslationKey, language = currentLanguage.value): string {
  return translations[key][language]
}

export function useAppLanguage() {
  return {
    currentLanguage,
    languageOptions: [
      { value: 'zh-CN', label: '中文' },
      { value: 'en-US', label: 'English' },
    ] as const,
    isEnglish: computed(() => currentLanguage.value === 'en-US'),
    setAppLanguage,
    t: translateText,
  }
}
