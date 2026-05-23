import type {
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = 'adidas 材料'

export async function launchAdidasMaterialsCollector(): Promise<ElectronActionResult> {
  if (!window.electronAPI?.launchAdidasMaterialCollector) {
    throw new Error('当前运行环境不支持打开 adidas 外部浏览器')
  }

  await recordAdidasMaterialsEvent('launch-start')
  const result = await window.electronAPI.launchAdidasMaterialCollector()
  await recordAdidasMaterialsEvent(result.success ? 'launch-success' : 'launch-failure', {
    result,
  })

  return result
}

export async function recordAdidasMaterialsEvent(
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
