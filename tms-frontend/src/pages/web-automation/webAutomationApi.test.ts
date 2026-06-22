import { describe, expect, it } from 'vitest'

import type { AutomationAppInfo } from '../../types/electronApi'
import {
  formatAutomationLauncherErrorMessage,
  getAutomationHelperUpdateMessage,
  minimumAutomationHelperVersion,
} from './webAutomationApi'

const compatibleHelperVersion = '0.9.8-beta.3.19'

describe('webAutomationApi', () => {
  it('formats missing local automation app errors for users', () => {
    expect(formatAutomationLauncherErrorMessage(
      'Unknown automation app: shipping-automation-demo',
      'shipping-automation-demo',
    )).toContain('本机自动化助手版本过旧或安装不完整')
    expect(formatAutomationLauncherErrorMessage(
      'Unknown automation app: shipping-automation-demo',
      'shipping-automation-demo',
    )).toContain('Shipping 执行器')
  })

  it('does not require the helper to match a newer TOS app version', () => {
    const activeApp = createAutomationApp({
      version: '0.9.8-beta.3.28',
    })

    expect(minimumAutomationHelperVersion).toBe(compatibleHelperVersion)
    expect(getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: compatibleHelperVersion,
    }, activeApp)).toBe('')
  })

  it('prompts when the helper is below the default minimum feature version', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: '0.9.8-beta.3.18',
    }, createAutomationApp())

    expect(message).toContain('0.9.8-beta.3.18')
    expect(message).toContain(compatibleHelperVersion)
  })

  it('does not use the automation app version as the helper version fallback', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
    }, createAutomationApp({
      version: '0.9.8-beta.3.28',
    }))

    expect(message).toContain(compatibleHelperVersion)
  })

  it('uses an app-specific helper requirement when present', () => {
    const message = getAutomationHelperUpdateMessage({
      ok: true,
      helperVersion: compatibleHelperVersion,
    }, createAutomationApp({
      requiredHelperVersion: '0.9.8-beta.3.27',
    }))

    expect(message).toContain(compatibleHelperVersion)
    expect(message).toContain('0.9.8-beta.3.27')
  })
})

function createAutomationApp(overrides: Partial<AutomationAppInfo> = {}): AutomationAppInfo {
  return {
    id: 'shipping-automation-demo',
    name: 'Shipping Automation Demo',
    description: 'Bundled shipping executor.',
    provider: 'Playwright',
    category: 'web automation',
    version: '0.9.8-beta.3.28',
    available: true,
    running: false,
    port: 3003,
    url: 'http://127.0.0.1:3003',
    ...overrides,
  }
}
