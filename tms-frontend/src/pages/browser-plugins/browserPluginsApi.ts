import type {
  BrowserPluginInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = '浏览器插件'

const browserPluginPreviewModules: BrowserPluginInfo[] = [
  {
    id: 'infornexus-auto-add',
    name: 'Infornexus 自动搜索并添加',
    provider: 'Infornexus',
    category: 'Chrome 扩展',
    version: '1.0',
    available: true,
    browserAvailable: false,
    previewOnly: true,
    targetUrl: 'https://network.infornexus.com/',
    matchPatterns: ['https://network.infornexus.com/*'],
    description:
      '在 Infornexus 页面读取 XLS/XLSX 的指定 ID，并自动执行搜索、勾选和添加操作。',
  },
]

export function hasBrowserPluginBridge(): boolean {
  return Boolean(window.electronAPI?.getBrowserPlugins)
}

export async function fetchBrowserPlugins(): Promise<BrowserPluginInfo[]> {
  if (!window.electronAPI?.getBrowserPlugins) {
    return browserPluginPreviewModules
  }

  return window.electronAPI.getBrowserPlugins()
}

export async function launchBrowserPlugin(pluginId: string): Promise<ElectronActionResult> {
  if (!window.electronAPI?.launchBrowserPlugin) {
    throw new Error('当前运行环境不支持启动浏览器插件')
  }

  await recordBrowserPluginEvent('launch-start', { pluginId })
  const result = await window.electronAPI.launchBrowserPlugin(pluginId)
  await recordBrowserPluginEvent(result.success ? 'launch-success' : 'launch-failure', {
    pluginId,
    result,
  })

  return result
}

export async function openBrowserPluginTarget(url: string): Promise<ElectronActionResult> {
  if (!window.electronAPI?.openExternal) {
    throw new Error('当前运行环境不支持打开外部网页')
  }

  await recordBrowserPluginEvent('open-target', { url })
  return window.electronAPI.openExternal(url)
}

export async function recordBrowserPluginEvent(
  action: string,
  payload?: DiagnosticEvent['payload'],
): Promise<void> {
  try {
    await window.electronAPI?.recordDiagnosticEvent?.({
      module: moduleName,
      action,
      payload,
    })
  } catch {
    // Diagnostics must never block the user action.
  }
}
