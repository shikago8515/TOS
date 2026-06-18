import { describe, expect, it } from 'vitest'

import { formatAutomationLauncherErrorMessage } from './webAutomationApi'

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
})
