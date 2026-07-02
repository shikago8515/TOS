import {
  getModulesByGroup,
  tosModules,
  tosNavGroups,
  type TosModuleDefinition,
  type TosModuleGroup,
} from '../../domain/moduleCatalog'
import {
  findProcessHistoryModuleByModuleId,
  processHistoryPeople,
  type ProcessHistoryModuleDefinition,
} from '../../shared/process/processHistoryPeople'

export type HomePersonGroupId = Extract<
  TosModuleGroup,
  'jessica' | 'sophia' | 'jane' | 'eric' | 'jason' | 'finance-excel'
>

export interface HomePersonGroup {
  id: HomePersonGroupId
  label: string
  labelEn: string
  modules: TosModuleDefinition[]
  primaryModule?: TosModuleDefinition
}

export const homePersonGroupIds = [
  'jessica',
  'sophia',
  'jane',
  'eric',
  'jason',
  'finance-excel',
] as const satisfies readonly HomePersonGroupId[]

const homeGroupLabels = new Map(
  tosNavGroups.map((group) => [group.id, { label: group.label, labelEn: group.labelEn }]),
)

export const homePeople: HomePersonGroup[] = homePersonGroupIds.map((groupId) => {
  const group = homeGroupLabels.get(groupId)
  const modules = getModulesByGroup(groupId).filter((module) => module.stage !== 'placeholder')

  return {
    id: groupId,
    label: group?.label || groupId,
    labelEn: group?.labelEn || groupId,
    modules,
    primaryModule: modules[0],
  }
})

export const homeDashboardModules = homePeople.flatMap((person) => person.modules)
const homePersonGroupIdSet = new Set<TosModuleGroup>(homePersonGroupIds)

export const homeDashboardHistoryModules: ProcessHistoryModuleDefinition[] = processHistoryPeople
  .flatMap((person) => person.modules)
  .filter((module) => homePersonGroupIdSet.has(module.group))

export const homeDashboardHistoryModuleIds: string[] = uniqueModuleIds(
  homeDashboardHistoryModules.flatMap((module) => module.historyModuleIds),
)

export function findHomeModuleByActivityId(activityId?: string): TosModuleDefinition | undefined {
  if (!activityId) return undefined
  return tosModules.find((module) => module.id === activityId || module.routeName === activityId)
    || findProcessHistoryModuleByModuleId(activityId)
}

export function findHomePersonByModuleId(moduleId?: string): HomePersonGroup | undefined {
  const module = findHomeModuleByActivityId(moduleId)
  if (!module) return undefined
  return homePeople.find((person) => person.id === module.group)
}

export function getHomePersonLabel(person: HomePersonGroup, isEnglish: boolean): string {
  return isEnglish ? person.labelEn : person.label
}

export function getHomeModuleLabel(module: TosModuleDefinition, isEnglish: boolean): string {
  return isEnglish ? module.navLabelEn : module.navLabel
}

function uniqueModuleIds(moduleIds: string[]): string[] {
  return Array.from(new Set(moduleIds.filter(Boolean)))
}
