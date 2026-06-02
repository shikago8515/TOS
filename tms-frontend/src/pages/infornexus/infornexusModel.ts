import type { ExternalModuleInfo } from '../../types/electronApi'

export type InfornexusNoticeTone = 'info' | 'success' | 'warning' | 'error'

export const expectedInfornexusEntry =
  'tms-electron-app/external-apps/infornexus/electron-app.exe'

export const infornexusStageMessage =
  'Infornexus 当前按外部子应用接入：TOS 只负责检测和启动，不拆分、不反编译，也不内嵌它的压缩运行包。'

export const infornexusNotes = [
  '部署时需要保留完整的 win-unpacked 目录内容，不能只复制 electron-app.exe 或 resources/app.asar。',
  '外部子应用会在独立窗口中运行，登录态、缓存和运行时能力仍由原 Infornexus 包自行管理。',
  '如果后续要做成 TOS 内部页面，应按 Vue 3 + TypeScript 在 tms-frontend/src 中重建，而不是直接合并压缩 bundle。',
] as const

export function getInfornexusStatusLabel(moduleInfo: ExternalModuleInfo | null): string {
  if (!moduleInfo) {
    return '未读取'
  }

  return moduleInfo.available ? '可启动' : '整包缺失'
}

export function getInfornexusStatusTone(
  moduleInfo: ExternalModuleInfo | null,
): InfornexusNoticeTone {
  if (!moduleInfo) {
    return 'info'
  }

  return moduleInfo.available ? 'success' : 'warning'
}
