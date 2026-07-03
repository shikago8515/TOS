import { defineComponent, h, type Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { nprogress } from '../utils/nprogress'
import { getDocumentTitle, tosRouteDefinitions, tosRouteRedirects } from './routeCatalog'
import AdidasMaterialsPage from '../pages/adidas-materials/AdidasMaterialsPage.vue'
import AutomationRunsPage from '../pages/automation-runs/AutomationRunsPage.vue'
import AutomationTemplatesPage from '../pages/automation-templates/AutomationTemplatesPage.vue'
import DraftPackingComparePage from '../pages/draft-packing-compare/DraftPackingComparePage.vue'
import EricPage from '../pages/eric/EricPage.vue'
import ExcelTemplateMapperTestPage from '../pages/excel-template-mapper-test/ExcelTemplateMapperTestPage.vue'
import HomePage from '../pages/home/HomePage.vue'
import IplexDualTableComparePage from '../pages/iplex-dual-table-compare/IplexDualTableComparePage.vue'
import InfornexusAutoAddPage from '../pages/infornexus-auto-add/InfornexusAutoAddPage.vue'
import JasonPdfReorderPage from '../pages/jason-pdf-reorder/JasonPdfReorderPage.vue'
import JaneBomComparePage from '../pages/jane-bom-compare/JaneBomComparePage.vue'
import JaneBomSummaryPage from '../pages/jane-bom-summary/JaneBomSummaryPage.vue'
import JaneInfornexusPage from '../pages/jane-infornexus/JaneInfornexusPage.vue'
import JaneOutboundComparePage from '../pages/jane-outbound-compare/JaneOutboundComparePage.vue'
import JanePage from '../pages/jane/JanePage.vue'
import JaneSapPage from '../pages/jane-sap/JaneSapPage.vue'
import JesscaPage from '../pages/jessca/JesscaPage.vue'
import PackingListAutoDownloadPage from '../pages/packing-list-auto-download/PackingListAutoDownloadPage.vue'
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import ReleaseUpdatesPage from '../pages/release-updates/ReleaseUpdatesPage.vue'
import ProcessHistoryResultsPage from '../pages/process-history/ProcessHistoryResultsPage.vue'
import SettingsPage from '../pages/settings/SettingsPage.vue'
import ShippingAutomationPage from '../pages/shipping-automation/ShippingAutomationPage.vue'
import ShippingAutomation2Page from '../pages/shipping-automation-2/ShippingAutomation2Page.vue'
import TcInvAutomationPage from '../pages/tc-inv-automation/TcInvAutomationPage.vue'
import XinlongtaiShippingAutomationPage from '../pages/xinlongtai-shipping-automation/XinlongtaiShippingAutomationPage.vue'
import PoAutoDownloadPage from '../pages/po-auto-download/PoAutoDownloadPage.vue'
import SophiaTinaPage from '../pages/sophia-tina/SophiaTinaPage.vue'
import TmsFinanceInternalReconciliationPage from '../pages/tms-finance-internal-reconciliation/TmsFinanceInternalReconciliationPage.vue'
import WebAutomationPage from '../pages/web-automation/WebAutomationPage.vue'
import WebAutomationScenarioPage from '../pages/web-automation/WebAutomationScenarioPage.vue'

const routeComponentNameMap = new WeakMap<object, string>()

function bindRouteComponentName(routeName: string, component: Component): Component {
  if ((typeof component !== 'object' && typeof component !== 'function') || component === null) {
    return component
  }

  const componentRecord = component as object
  const existingRouteName = routeComponentNameMap.get(componentRecord)

  if (!existingRouteName || existingRouteName === routeName) {
    routeComponentNameMap.set(componentRecord, routeName)

    try {
      Object.defineProperty(componentRecord, 'name', {
        value: routeName,
        configurable: true,
      })
      return component
    } catch (_error) {
      // Fall through to a named wrapper when the imported component object is not writable.
    }
  }

  return defineComponent({
    name: routeName,
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h(component, attrs, slots)
    },
  })
}

const routeComponents: Partial<Record<string, Component>> = {
  home: bindRouteComponentName('home', HomePage),
  jessca: bindRouteComponentName('jessca', JesscaPage),
  jane: bindRouteComponentName('jane', JanePage),
  'jane-bom-summary': bindRouteComponentName('jane-bom-summary', JaneBomSummaryPage),
  'jane-bom-compare': bindRouteComponentName('jane-bom-compare', JaneBomComparePage),
  'jane-outbound-compare': bindRouteComponentName('jane-outbound-compare', JaneOutboundComparePage),
  'jane-infornexus': bindRouteComponentName('jane-infornexus', JaneInfornexusPage),
  eric: bindRouteComponentName('eric', EricPage),
  'excel-template-mapper-test': bindRouteComponentName(
    'excel-template-mapper-test',
    ExcelTemplateMapperTestPage,
  ),
  'eric-infornexus': bindRouteComponentName('eric-infornexus', InfornexusAutoAddPage),
  'jason-pdf-reorder': bindRouteComponentName('jason-pdf-reorder', JasonPdfReorderPage),
  'web-automation-scenario-shipping-automation': bindRouteComponentName(
    'web-automation-scenario-shipping-automation',
    ShippingAutomationPage,
  ),
  'web-automation-scenario-xinlongtai-shipping-automation': bindRouteComponentName(
    'web-automation-scenario-xinlongtai-shipping-automation',
    XinlongtaiShippingAutomationPage,
  ),
  'web-automation-scenario-tc-inv-automation': bindRouteComponentName(
    'web-automation-scenario-tc-inv-automation',
    TcInvAutomationPage,
  ),
  'web-automation-scenario-po-auto-download': bindRouteComponentName(
    'web-automation-scenario-po-auto-download',
    PoAutoDownloadPage,
  ),
  'web-automation-scenario-packing-list-auto-download': bindRouteComponentName(
    'web-automation-scenario-packing-list-auto-download',
    PackingListAutoDownloadPage,
  ),
  'draft-packing-compare': bindRouteComponentName('draft-packing-compare', DraftPackingComparePage),
  'tms-finance-internal-reconciliation': bindRouteComponentName(
    'tms-finance-internal-reconciliation',
    TmsFinanceInternalReconciliationPage,
  ),
  'tms-finance-work-sales': bindRouteComponentName(
    'tms-finance-work-sales',
    TmsFinanceInternalReconciliationPage,
  ),
  'iplex-dual-table-compare': bindRouteComponentName(
    'iplex-dual-table-compare',
    IplexDualTableComparePage,
  ),
  'jane-sap': bindRouteComponentName('jane-sap', JaneSapPage),
  'sophia-tina': bindRouteComponentName('sophia-tina', SophiaTinaPage),
  'web-automation': bindRouteComponentName('web-automation', WebAutomationPage),
  'adidas-materials': bindRouteComponentName('adidas-materials', AdidasMaterialsPage),
  'automation-runs': bindRouteComponentName('automation-runs', AutomationRunsPage),
  'automation-templates': bindRouteComponentName('automation-templates', AutomationTemplatesPage),
  settings: bindRouteComponentName('settings', SettingsPage),
}

const redirectRoutes: RouteRecordRaw[] = tosRouteRedirects.map((redirect) => ({
  path: redirect.from,
  redirect: redirect.to,
}))

const moduleRoutes: RouteRecordRaw[] = tosRouteDefinitions.map((route) => ({
  path: route.path,
  name: route.name,
  component: routeComponents[route.name] ?? bindRouteComponentName(route.name, RoutePlaceholder),
  props: {
    routeTitle: route.title,
  },
  meta: {
    title: route.title,
    keepAliveName: route.name,
    isAffix: route.path === '/' ? '1' : '0',
    isKeepAlive: '1',
    isVisible: '1',
  },
}))

const scenarioRoutes: RouteRecordRaw[] = [
  {
    path: '/web-automation/scenarios/shipping-automation',
    name: 'web-automation-scenario-shipping-automation',
    component: ShippingAutomationPage,
    meta: {
      title: 'VENT',
    },
  },
  {
    path: '/web-automation/scenarios/xinlongtai-shipping-automation',
    name: 'web-automation-scenario-xinlongtai-shipping-automation',
    component: XinlongtaiShippingAutomationPage,
    meta: {
      title: 'YUEN TAI+XO',
    },
  },
  {
    path: '/web-automation/scenarios/tc-inv-automation',
    name: 'web-automation-scenario-tc-inv-automation',
    component: TcInvAutomationPage,
    meta: {
      title: 'Trade Card INV amount',
    },
  },
  {
    path: '/web-automation/scenarios/shipping-automation-2',
    name: 'web-automation-scenario-shipping-automation-2',
    component: ShippingAutomation2Page,
    meta: {
      title: 'released Bulk 自动化',
    },
  },
  {
    path: '/web-automation/scenarios/infornexus-auto-add',
    name: 'web-automation-scenario-infornexus-auto-add',
    component: InfornexusAutoAddPage,
    meta: {
      title: 'Infornexus 自动搜索添加',
    },
  },
  {
    path: '/web-automation/scenarios/po-auto-download',
    name: 'web-automation-scenario-po-auto-download',
    component: PoAutoDownloadPage,
    meta: {
      title: 'Invoice 下载',
    },
  },
  {
    path: '/web-automation/scenarios/packing-list-auto-download',
    name: 'web-automation-scenario-packing-list-auto-download',
    component: PackingListAutoDownloadPage,
    meta: {
      title: 'Packing List 下载',
    },
  },
  {
    path: '/web-automation/scenarios/:scenarioId',
    name: 'web-automation-scenario',
    component: WebAutomationScenarioPage,
    meta: {
      title: '网页自动化场景',
    },
  },
]

const utilityRoutes: RouteRecordRaw[] = [
  {
    path: '/release-updates',
    name: 'release-updates',
    component: ReleaseUpdatesPage,
    meta: {
      title: '版本更新记录',
    },
  },
  {
    path: '/process-history/:personId',
    name: 'process-history-results',
    component: ProcessHistoryResultsPage,
    meta: {
      title: '历史结果',
    },
  },
]

function withRouteCacheMeta(route: RouteRecordRaw): RouteRecordRaw {
  if (!route.name) {
    return route
  }

  const routeName = String(route.name)
  const routeWithComponent = route as RouteRecordRaw & { component?: Component }
  const component = routeWithComponent.component

  return {
    ...routeWithComponent,
    component: component ? bindRouteComponentName(routeName, component) : component,
    meta: {
      ...route.meta,
      keepAliveName: route.meta?.keepAliveName ?? routeName,
      isAffix: route.meta?.isAffix ?? (route.path === '/' ? '1' : '0'),
      isKeepAlive: route.meta?.isKeepAlive ?? '1',
      isVisible: route.meta?.isVisible ?? '1',
    },
  } as RouteRecordRaw
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [...redirectRoutes, ...scenarioRoutes, ...utilityRoutes, ...moduleRoutes].map(withRouteCacheMeta),
})

router.beforeEach(() => {
  nprogress.start()
})

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    document.title = getDocumentTitle(typeof to.meta.title === 'string' ? to.meta.title : undefined)
  }
  nprogress.done()
})

router.onError(() => {
  nprogress.done()
})
