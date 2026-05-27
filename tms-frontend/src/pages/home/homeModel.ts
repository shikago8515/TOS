import {
  getModuleById,
  getModulesByGroup,
  type TosModuleId,
} from '../../domain/moduleCatalog'
import type { TranslationKey } from '../../shared/i18n/appLanguage'

const excelModules = getModulesByGroup('excel')
const collectorModules = getModulesByGroup('collector')
const automationModules = getModulesByGroup('automation')

export const homeMetricTiles = [
  {
    labelKey: 'app.home.metricExcel',
    value: excelModules.length,
    detailKey: 'app.home.metricExcelDetail',
    tone: 'blue',
  },
  {
    labelKey: 'app.home.metricCollector',
    value: collectorModules.length,
    detailKey: 'app.home.metricCollectorDetail',
    tone: 'green',
  },
  {
    labelKey: 'app.home.metricTesting',
    value: automationModules.length,
    detailKey: null,
    tone: 'amber',
  },
] as const satisfies readonly {
  labelKey: TranslationKey
  value: number
  detailKey: TranslationKey | null
  tone: 'blue' | 'green' | 'amber'
}[]

export const homeShortcutModuleIds = [
  'jessca',
  'sophia-tina',
  'jane',
  'jane-bom-summary',
  'eric',
  'browser-plugins',
  'web-automation',
  'infornexus',
  'adidas-materials',
] as const satisfies readonly TosModuleId[]

export const homeShortcutModules = homeShortcutModuleIds.map(getModuleById)

export const serviceStatusItems = [
  {
    labelKey: 'app.home.serviceBackend',
    descriptionKey: 'app.home.serviceBackendDesc',
    statusKey: 'app.home.serviceBackendStatus',
    tone: 'online',
  },
  {
    labelKey: 'app.home.serviceDiagnostics',
    descriptionKey: 'app.home.serviceDiagnosticsDesc',
    statusKey: 'app.home.serviceDiagnosticsStatus',
    tone: 'ready',
  },
  {
    labelKey: 'app.home.serviceAutomation',
    descriptionKey: 'app.home.serviceAutomationDesc',
    statusKey: 'app.home.serviceAutomationStatus',
    tone: 'working',
  },
  {
    labelKey: 'app.home.serviceFiles',
    descriptionKey: 'app.home.serviceFilesDesc',
    statusKey: 'app.home.serviceFilesStatus',
    tone: 'ready',
  },
] as const satisfies readonly {
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  statusKey: TranslationKey
  tone: 'online' | 'ready' | 'working'
}[]
