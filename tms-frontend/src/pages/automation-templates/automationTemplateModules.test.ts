import { describe, expect, it } from 'vitest'
import {
  automationTemplateModuleIds,
  automationTemplateModules,
  getDefaultTemplateKey,
  getTemplateTypeLabel,
  normalizeTemplateKeyForModule,
} from './automationTemplateModules'

describe('automationTemplateModules', () => {
  it('only exposes automation pages that have Excel templates', () => {
    expect(automationTemplateModuleIds).toEqual([
      'microsoft-login-n8n',
      'shipping-automation',
      'xinlongtai-shipping-automation',
      'tc-inv-automation',
      'shipping-automation-2',
      'infornexus-auto-add',
      'po-auto-download',
      'packing-list-auto-download',
      'excel-template-mapper-test',
    ])
    expect(automationTemplateModuleIds).not.toContain('jane-sap')
    expect(automationTemplateModuleIds).not.toContain('jane-infornexus')
    expect(automationTemplateModuleIds).not.toContain('eric-infornexus')
    expect(automationTemplateModuleIds).not.toContain('web-automation')
    expect(automationTemplateModuleIds).not.toContain('ticket-owner-statistics')
  })

  it('uses scenario labels instead of broad navigation labels', () => {
    const labels = automationTemplateModules.map((module) => module.navLabel)

    expect(labels).toContain('Microsoft Login / SAP BTP')
    expect(labels).toContain('released Bulk 自动化')
    expect(labels).toContain('Infornexus 自动搜索并添加')
    expect(labels).not.toContain('SAP')
    expect(labels.filter((label) => label === 'Infornexus')).toHaveLength(0)
  })

  it('hides internal keys behind user-facing template type labels', () => {
    expect(getDefaultTemplateKey('shipping-automation')).toBe('default')
    expect(getDefaultTemplateKey('shipping-automation-2')).toBe('released')
    expect(getTemplateTypeLabel('shipping-automation', 'default')).toBe('默认模板')
    expect(getTemplateTypeLabel('shipping-automation-2', 'released')).toBe('Released Bulk 模板')
    expect(getTemplateTypeLabel('shipping-automation-2', 'unreleased')).toBe('Unreleased Bulk 模板')
    expect(normalizeTemplateKeyForModule('shipping-automation', 'unreleased')).toBe('default')
    expect(normalizeTemplateKeyForModule('shipping-automation-2', 'unreleased')).toBe('unreleased')
    expect(getDefaultTemplateKey('excel-template-mapper-test')).toBe('default')
  })
})
