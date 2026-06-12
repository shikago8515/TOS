export function hasDesktopDiagnosticsSupport(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.exportDiagnosticsPackage)
}
