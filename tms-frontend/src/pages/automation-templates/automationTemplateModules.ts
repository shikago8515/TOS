import { getWebAutomationEntry } from '../web-automation/webAutomationModel'

export interface AutomationTemplateModuleOption {
  id: string
  navLabel: string
  order: number
  templateTypes: readonly AutomationTemplateTypeOption[]
}

export interface AutomationTemplateTypeOption {
  key: string
  label: string
}

const defaultTemplateTypes: readonly AutomationTemplateTypeOption[] = [
  { key: 'default', label: '默认模板' },
] as const

const templateModuleDefinitions = [
  { id: 'microsoft-login-n8n', templateTypes: defaultTemplateTypes },
  { id: 'shipping-automation', templateTypes: defaultTemplateTypes },
  { id: 'xinlongtai-shipping-automation', templateTypes: defaultTemplateTypes },
  { id: 'tc-inv-automation', templateTypes: defaultTemplateTypes },
  {
    id: 'shipping-automation-2',
    templateTypes: [
      { key: 'released', label: 'Released Bulk 模板' },
      { key: 'unreleased', label: 'Unreleased Bulk 模板' },
    ],
  },
  { id: 'infornexus-auto-add', templateTypes: defaultTemplateTypes },
  { id: 'po-auto-download', templateTypes: defaultTemplateTypes },
  { id: 'packing-list-auto-download', templateTypes: defaultTemplateTypes },
] as const

export const automationTemplateModuleIds = templateModuleDefinitions.map((definition) => definition.id)

export const automationTemplateModules: AutomationTemplateModuleOption[] = templateModuleDefinitions.map(
  (definition, index) => {
    const id = definition.id
    const entry = getWebAutomationEntry(id)
    return {
      id,
      navLabel: entry?.title || id,
      order: index + 1,
      templateTypes: definition.templateTypes,
    }
  },
)

export function findAutomationTemplateModule(moduleId: string): AutomationTemplateModuleOption | undefined {
  return automationTemplateModules.find((module) => module.id === moduleId)
}

export function getDefaultTemplateKey(moduleId: string): string {
  return findAutomationTemplateModule(moduleId)?.templateTypes[0]?.key || 'default'
}

export function getTemplateTypeLabel(moduleId: string, templateKey: string): string {
  const type = findAutomationTemplateModule(moduleId)?.templateTypes.find(
    (option) => option.key === templateKey,
  )
  return type?.label || templateKey || '默认模板'
}

export function normalizeTemplateKeyForModule(moduleId: string, templateKey: string): string {
  const module = findAutomationTemplateModule(moduleId)
  if (!module) return templateKey || 'default'
  return module.templateTypes.some((option) => option.key === templateKey)
    ? templateKey
    : getDefaultTemplateKey(moduleId)
}
