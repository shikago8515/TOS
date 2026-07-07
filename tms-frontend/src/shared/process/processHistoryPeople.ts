import {
  getModulesByGroup,
  tosNavGroups,
  type TosModuleDefinition,
  type TosModuleGroup,
} from '../../domain/moduleCatalog'

export interface ProcessHistoryPerson {
  id: string
  group: TosModuleGroup
  label: string
  labelEn: string
  modules: ProcessHistoryModuleDefinition[]
}

export interface ProcessHistoryModuleDefinition extends TosModuleDefinition {
  catalogId: string
  historyModuleIds: string[]
}

const excelHistoryCategories = new Set(['excel', 'reconciliation'])

const processHistoryModuleIdByCatalogId: Partial<Record<string, string>> = {
  'draft-packing-compare': 'pdf-draft-packing-compare',
  jessca: 'excel-jessca',
  jane: 'excel-jane',
  'jane-bom-compare': 'excel-jane-bom-compare',
  'jane-bom-summary': 'excel-jane-bom-summary',
  'jane-outbound-compare': 'excel-jane-outbound-compare',
  'sophia-tina': 'excel-sophia-tina',
  'tms-finance-internal-reconciliation': 'excel-tms-finance-internal-reconciliation',
  'tms-finance-work-sales': 'excel-tms-finance-work-sales',
}

const processHistoryModuleAliasesByCatalogId: Partial<Record<string, string[]>> = {
  'draft-packing-compare': ['draft-packing-compare'],
  jessca: ['jessca'],
  jane: ['jane'],
  'jane-bom-compare': ['jane-bom-compare'],
  'jane-bom-summary': ['jane-bom-summary'],
  'jane-outbound-compare': ['jane-outbound-compare'],
  'sophia-tina': ['sophia-tina'],
  'tms-finance-internal-reconciliation': ['tms-finance-internal-reconciliation'],
  'tms-finance-work-sales': ['tms-finance-work-sales'],
}

const processHistoryPersonGroups: Array<{
  id: string
  group: TosModuleGroup
}> = [
  { id: 'jessica', group: 'jessica' },
  { id: 'sophia', group: 'sophia' },
  { id: 'jane', group: 'jane' },
  { id: 'eric', group: 'eric' },
  { id: 'jason', group: 'jason' },
  { id: 'lucia', group: 'finance-excel' },
  { id: 'general-tools', group: 'general-tools' },
]

const groupLabels = new Map(
  tosNavGroups.map((group) => [group.id, { label: group.label, labelEn: group.labelEn }]),
)

function uniqueModuleIds(moduleIds: string[]): string[] {
  return Array.from(new Set(moduleIds.filter(Boolean)))
}

function toProcessHistoryModule(module: TosModuleDefinition): ProcessHistoryModuleDefinition {
  const historyModuleId = processHistoryModuleIdByCatalogId[module.id] ?? module.id

  return {
    ...module,
    catalogId: module.id,
    id: historyModuleId,
    historyModuleIds: uniqueModuleIds([
      historyModuleId,
      ...(processHistoryModuleAliasesByCatalogId[module.id] ?? []),
    ]),
  }
}

export const processHistoryPeople: ProcessHistoryPerson[] = processHistoryPersonGroups
  .map((person) => {
    const label = groupLabels.get(person.group)
    const modules = getModulesByGroup(person.group).filter(
      (module) =>
        module.stage !== 'placeholder'
        && excelHistoryCategories.has(module.category),
    ).map(toProcessHistoryModule)

    return {
      ...person,
      label: label?.label || person.id,
      labelEn: label?.labelEn || person.id,
      modules,
    }
  })
  .filter((person) => person.modules.length > 0)

export function findProcessHistoryPersonById(personId?: string): ProcessHistoryPerson | undefined {
  if (!personId) return undefined
  return processHistoryPeople.find((person) => person.id === personId)
}

function findProcessHistoryModuleMatch(moduleId?: string): {
  person: ProcessHistoryPerson
  module: ProcessHistoryModuleDefinition
} | undefined {
  if (!moduleId) return undefined

  for (const person of processHistoryPeople) {
    const module = person.modules.find(
      (candidate) =>
        candidate.id === moduleId
        || candidate.catalogId === moduleId
        || candidate.routeName === moduleId
        || candidate.historyModuleIds.includes(moduleId),
    )
    if (module) return { person, module }
  }

  return undefined
}

export function findProcessHistoryPersonByModuleId(moduleId?: string): ProcessHistoryPerson | undefined {
  return findProcessHistoryModuleMatch(moduleId)?.person
}

export function findProcessHistoryModuleByModuleId(moduleId?: string): ProcessHistoryModuleDefinition | undefined {
  return findProcessHistoryModuleMatch(moduleId)?.module
}

export function getProcessHistoryModulesForPerson(personId?: string): ProcessHistoryModuleDefinition[] {
  return findProcessHistoryPersonById(personId)?.modules ?? []
}

export function getProcessHistoryModuleIdsForQuery(moduleId?: string): string[] {
  if (!moduleId) return []
  return findProcessHistoryModuleByModuleId(moduleId)?.historyModuleIds ?? [moduleId]
}

export function buildProcessHistoryPersonRoute(
  moduleId: string,
): { path: string; query: { moduleId: string } } | null {
  const match = findProcessHistoryModuleMatch(moduleId)
  if (!match) return null
  return {
    path: `/process-history/${match.person.id}`,
    query: { moduleId: match.module.id },
  }
}
