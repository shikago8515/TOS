import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = fileURLToPath(new URL('./components/AutomationCredentialsPanel.vue', import.meta.url))
const accountProfileManagerPath = fileURLToPath(new URL('./components/AutomationAccountProfileManager.vue', import.meta.url))
const accountProfileManagerSource = readWorkspaceSource('./components/AutomationAccountProfileManager.vue')
const webAutomationScenarioSource = readWorkspaceSource('./WebAutomationScenarioPage.vue')
const packingListAutoDownloadSource = readWorkspaceSource('../packing-list-auto-download/components/PackingListAutoDownloadWorkspace.vue')
const poAutoDownloadSource = readWorkspaceSource('../po-auto-download/components/PoAutoDownloadWorkspace.vue')
const shippingAutomationSource = readWorkspaceSource('../shipping-automation/components/ShippingAutomationWorkspace.vue')
const shippingAutomation2Source = readWorkspaceSource('../shipping-automation-2/components/ShippingAutomation2Workspace.vue')
const tcInvAutomationSource = readWorkspaceSource('../tc-inv-automation/components/TcInvAutomationWorkspace.vue')
const xinlongtaiShippingSource = readWorkspaceSource('../xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue')
const infornexusAutoAddSource = readWorkspaceSource('../infornexus-auto-add/components/InfornexusAutoAddWorkspace.vue')

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

  it('uses the account profile manager in generic web automation scenarios too', () => {
    expect(webAutomationScenarioSource).toContain('AutomationAccountProfileManager')
    expect(webAutomationScenarioSource).toContain('credentialProfileRef')
    expect(webAutomationScenarioSource).toContain(':username-mode="credentialUsernameMode"')
  })

  it('uses the shared account profile manager in all direct Infor Nexus automation pages', () => {
    for (const source of [shippingAutomationSource, shippingAutomation2Source, poAutoDownloadSource, packingListAutoDownloadSource, xinlongtaiShippingSource, tcInvAutomationSource, infornexusAutoAddSource]) {
      expect(source).toContain('AutomationAccountProfileManager')
      expect(source).toContain('credentialProfileRef')
      expect(source).toContain('handleCredentialState')
      expect(source).not.toContain('saveCredentialEditor')
      expect(source).not.toContain('deleteCredentialProfile')
      expect(source).not.toContain('pendingCredentialDeleteKey')
    }
    expect(shippingAutomationSource).not.toContain('AutomationCredentialsPanel')
    expect(shippingAutomation2Source).not.toContain('AutomationCredentialsPanel')
    expect(poAutoDownloadSource).not.toContain('AutomationCredentialsPanel')
  })

  it('loads selectable credential options through shared account profile manager', () => {
    expect(accountProfileManagerSource).toContain('fetchExecutorCredentialOptions')
    expect(accountProfileManagerSource).toContain('selectCredentialOption')
    expect(accountProfileManagerSource).toContain('credentialOptions')
    expect(accountProfileManagerSource).toContain('selectedCredentialKey')
    expect(shippingAutomationSource).toContain('resolveCredentials')
    expect(shippingAutomation2Source).toContain('resolveCredentials')
  })

  it('waits for local executor health after launching shipping automation apps', () => {
    for (const source of [webAutomationScenarioSource, shippingAutomationSource, xinlongtaiShippingSource, infornexusAutoAddSource]) {
      expect(source).toContain('async function waitForExecutorHealthReady')
      expect(source).toContain('executor-health-wait-timeout')
      expect(source).toContain('const executorReady = await waitForExecutorHealthReady')
      expect(source).not.toContain('await refreshExecutorState(true)\n    if (!silent)')
    }
  })

  it('does not block shipping runs with Desktop Utility preflight warnings', () => {
    for (const source of [shippingAutomationSource, xinlongtaiShippingSource]) {
      expect(source).not.toContain('v-if="showDesktopBridgeWarning"')
      expect(source).not.toContain('desktopBridgeWarning.value')
      expect(source).not.toContain('getInforNexusDesktopBridgeWarning')
    }
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
