import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = fileURLToPath(new URL('./components/AutomationCredentialsPanel.vue', import.meta.url))
const poAutoDownloadSource = readWorkspaceSource('../po-auto-download/components/PoAutoDownloadWorkspace.vue')
const shippingAutomationSource = readWorkspaceSource('../shipping-automation/components/ShippingAutomationWorkspace.vue')
const xinlongtaiShippingSource = readWorkspaceSource('../xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue')

function readWorkspaceSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('AutomationCredentialsPanel source integration', () => {
  it('provides a shared automation credentials panel component', () => {
    expect(existsSync(componentPath)).toBe(true)
  })

  it('uses the shared credentials panel in the adopted Jessica automation pages', () => {
    for (const source of [
      poAutoDownloadSource,
      shippingAutomationSource,
    ]) {
      expect(source).toContain('AutomationCredentialsPanel')
    }
  })

  it('keeps the standalone Xinlongtai account profile controls', () => {
    expect(xinlongtaiShippingSource).toContain('账号档案')
    expect(xinlongtaiShippingSource).toContain('保存名称')
    expect(xinlongtaiShippingSource).toContain('deleteCredentialProfile')
    expect(xinlongtaiShippingSource).toContain('pendingCredentialDeleteKey')
    expect(xinlongtaiShippingSource).toContain('sa-cred-profile-grid')
    expect(xinlongtaiShippingSource).toContain('sa-profile-')
  })

  it('loads selectable credential options in Wandai and Xinlongtai shipping pages', () => {
    for (const source of [shippingAutomationSource, xinlongtaiShippingSource]) {
      expect(source).toContain('fetchExecutorCredentialOptions')
      expect(source).toContain('selectCredentialOption')
      expect(source).toContain('credentialOptions')
      expect(source).toContain('selectedCredentialKey')
    }
  })
})
