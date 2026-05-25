import type {
  DiagnosticEvent,
  ElectronActionResult,
  ExternalModuleInfo,
} from '../../types/electronApi'

export const infornexusModuleId = 'infornexus'

const moduleName = 'Infornexus 子应用'

export async function fetchInfornexusExternalModule(): Promise<ExternalModuleInfo> {
  if (!window.electronAPI?.getExternalModules) {
    throw new Error('当前运行环境不支持外部子应用管理')
  }

  const modules = await window.electronAPI.getExternalModules()
  const moduleInfo = modules.find((module) => module.id === infornexusModuleId)

  if (!moduleInfo) {
    return {
      id: infornexusModuleId,
      name: 'Infornexus',
      description: '外部 Electron 子应用',
      available: false,
    }
  }

  return moduleInfo
}

export async function launchInfornexusExternalModule(): Promise<ElectronActionResult> {
  if (!window.electronAPI?.launchExternalModule) {
    throw new Error('当前运行环境不支持启动外部子应用')
  }

  await recordInfornexusEvent('launch-start', { moduleId: infornexusModuleId })
  const result = await window.electronAPI.launchExternalModule(infornexusModuleId)
  await recordInfornexusEvent(result.success ? 'launch-success' : 'launch-failure', {
    moduleId: infornexusModuleId,
    result,
  })

  return result
}

export async function recordInfornexusEvent(
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
