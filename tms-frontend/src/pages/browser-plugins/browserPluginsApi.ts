import type {
  BrowserPluginInfo,
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = '浏览器插件'

export async function fetchBrowserPlugins(): Promise<BrowserPluginInfo[]> {
  if (!window.electronAPI?.getBrowserPlugins) {
    throw new Error('当前运行环境不支持浏览器插件管理')
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
