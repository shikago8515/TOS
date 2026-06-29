import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = fileURLToPath(new URL('./components/AutomationCredentialsPanel.vue', import.meta.url))
const accountProfileManagerPath = fileURLToPath(new URL('./components/AutomationAccountProfileManager.vue', import.meta.url))
const accountProfileManagerSource = readWorkspaceSource('./components/AutomationAccountProfileManager.vue')
const packingListAutoDownloadSource = readWorkspaceSource('../packing-list-auto-download/components/PackingListAutoDownloadWorkspace.vue')
const poAutoDownloadSource = readWorkspaceSource('../po-auto-download/components/PoAutoDownloadWorkspace.vue')
const shippingAutomationSource = readWorkspaceSource('../shipping-automation/components/ShippingAutomationWorkspace.vue')
const tcInvAutomationSource = readWorkspaceSource('../tc-inv-automation/components/TcInvAutomationWorkspace.vue')
const xinlongtaiShippingSource = readWorkspaceSource('../xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue')

function readWorkspaceSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('AutomationCredentialsPanel source integration', () => {
  it('provides a shared automation credentials panel component', () => {
    expect(existsSync(componentPath)).toBe(true)
  })

  it('provides a shared account profile manager component', () => {
    expect(existsSync(accountProfileManagerPath)).toBe(true)
    expect(accountProfileManagerSource).toContain('账号档案')
    expect(accountProfileManagerSource).toContain('保存名称')
    expect(accountProfileManagerSource).toContain('profileCaches')
    expect(accountProfileManagerSource).toContain('resolveCredentials')
  })

  it('uses the shared credentials panel in the adopted Jessica shipping automation page', () => {
    expect(shippingAutomationSource).toContain('AutomationCredentialsPanel')
  })

  it('uses the shared account profile manager in Invoice, packing list, Xinlongtai, and TC INV pages', () => {
    for (const source of [poAutoDownloadSource, packingListAutoDownloadSource, xinlongtaiShippingSource, tcInvAutomationSource]) {
      expect(source).toContain('AutomationAccountProfileManager')
      expect(source).toContain('credentialProfileRef')
      expect(source).toContain('handleCredentialState')
      expect(source).not.toContain('saveCredentialEditor')
      expect(source).not.toContain('deleteCredentialProfile')
      expect(source).not.toContain('pendingCredentialDeleteKey')
    }
    expect(poAutoDownloadSource).not.toContain('AutomationCredentialsPanel')
  })

  it('loads selectable credential options through shared account profile manager', () => {
    expect(accountProfileManagerSource).toContain('fetchExecutorCredentialOptions')
    expect(accountProfileManagerSource).toContain('selectCredentialOption')
    expect(accountProfileManagerSource).toContain('credentialOptions')
    expect(accountProfileManagerSource).toContain('selectedCredentialKey')
    expect(shippingAutomationSource).toContain('fetchExecutorCredentialOptions')
  })

  it('checks PO template availability before opening the download endpoint', () => {
    expect(poAutoDownloadSource).toContain('/api/system/config/po-auto-download/template/status')
    expect(poAutoDownloadSource).toContain('/api/system/config/po-auto-download/template/download')
    expect(poAutoDownloadSource.indexOf('TEMPLATE_STATUS_PATH')).toBeLessThan(
      poAutoDownloadSource.indexOf('TEMPLATE_DOWNLOAD_PATH'),
    )
  })

  it('does not resolve encrypted passwords while merely switching account profiles', () => {
    const applyStart = accountProfileManagerSource.indexOf('async function applyCredentialKey')
    const applyEnd = accountProfileManagerSource.indexOf('function applyResolvedCredential')
    expect(applyStart).toBeGreaterThan(-1)
    expect(applyEnd).toBeGreaterThan(applyStart)
    const applyCredentialKeySource = accountProfileManagerSource.slice(applyStart, applyEnd)
    expect(applyCredentialKeySource).not.toContain('resolveAutomationCredentials')
  })
})
