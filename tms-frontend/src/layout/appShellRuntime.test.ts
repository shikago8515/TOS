import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ElectronApi } from '../types/electronApi'
import { hasDesktopDiagnosticsSupport } from './appShellRuntime'

function stubWindow(electronAPI?: Partial<ElectronApi>): void {
  vi.stubGlobal('window', { electronAPI })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('appShellRuntime', () => {
  it('hides diagnostics export in browser/server mode', () => {
    stubWindow()

    expect(hasDesktopDiagnosticsSupport()).toBe(false)
  })

  it('shows diagnostics export when the Electron diagnostics bridge exists', () => {
    stubWindow({
      exportDiagnosticsPackage: vi.fn(),
    })

    expect(hasDesktopDiagnosticsSupport()).toBe(true)
  })
})
