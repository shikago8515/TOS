import type { Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { tosRouteDefinitions, tosRouteRedirects } from './routeCatalog'
import AdidasMaterialsPage from '../pages/adidas-materials/AdidasMaterialsPage.vue'
import DraftPackingComparePage from '../pages/draft-packing-compare/DraftPackingComparePage.vue'
import EricPage from '../pages/eric/EricPage.vue'
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
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import ReleaseUpdatesPage from '../pages/release-updates/ReleaseUpdatesPage.vue'
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

const routeComponents: Partial<Record<string, Component>> = {
  home: HomePage,
  jessca: JesscaPage,
  jane: JanePage,
  'jane-bom-summary': JaneBomSummaryPage,
  'jane-bom-compare': JaneBomComparePage,
  'jane-outbound-compare': JaneOutboundComparePage,
  'jane-infornexus': JaneInfornexusPage,
  eric: EricPage,
  'eric-infornexus': InfornexusAutoAddPage,
  'jason-pdf-reorder': JasonPdfReorderPage,
  'web-automation-scenario-shipping-automation': ShippingAutomationPage,
  'web-automation-scenario-xinlongtai-shipping-automation': XinlongtaiShippingAutomationPage,
  'web-automation-scenario-tc-inv-automation': TcInvAutomationPage,
  'web-automation-scenario-po-auto-download': PoAutoDownloadPage,
  'draft-packing-compare': DraftPackingComparePage,
  'tms-finance-internal-reconciliation': TmsFinanceInternalReconciliationPage,
  'tms-finance-work-sales': TmsFinanceInternalReconciliationPage,
  'iplex-dual-table-compare': IplexDualTableComparePage,
  'jane-sap': JaneSapPage,
  'sophia-tina': SophiaTinaPage,
  'web-automation': WebAutomationPage,
  'adidas-materials': AdidasMaterialsPage,
  settings: SettingsPage,
}

const redirectRoutes: RouteRecordRaw[] = tosRouteRedirects.map((redirect) => ({
  path: redirect.from,
  redirect: redirect.to,
}))

const moduleRoutes: RouteRecordRaw[] = tosRouteDefinitions.map((route) => ({
  path: route.path,
  name: route.name,
  component: routeComponents[route.name] ?? RoutePlaceholder,
  props: {
    routeTitle: route.title,
  },
  meta: {
    title: route.title,
  },
}))

const scenarioRoutes: RouteRecordRaw[] = [
  {
    path: '/web-automation/scenarios/shipping-automation',
    name: 'web-automation-scenario-shipping-automation',
    component: ShippingAutomationPage,
    meta: {
      title: '万代shipping 自动化',
    },
  },
  {
    path: '/web-automation/scenarios/xinlongtai-shipping-automation',
    name: 'web-automation-scenario-xinlongtai-shipping-automation',
    component: XinlongtaiShippingAutomationPage,
    meta: {
      title: '新龙泰-shipping 自动化',
    },
  },
  {
    path: '/web-automation/scenarios/tc-inv-automation',
    name: 'web-automation-scenario-tc-inv-automation',
    component: TcInvAutomationPage,
    meta: {
      title: 'TC INV 自动化',
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
      title: 'Invoice 自动下载',
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
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [...redirectRoutes, ...scenarioRoutes, ...utilityRoutes, ...moduleRoutes],
})
