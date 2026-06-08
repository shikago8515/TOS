import type { Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { tosRouteDefinitions, tosRouteRedirects } from './routeCatalog'
import AdidasMaterialsPage from '../pages/adidas-materials/AdidasMaterialsPage.vue'
import BrowserPluginsPage from '../pages/browser-plugins/BrowserPluginsPage.vue'
import EricPage from '../pages/eric/EricPage.vue'
import EricInfornexusPage from '../pages/eric-infornexus/EricInfornexusPage.vue'
import HomePage from '../pages/home/HomePage.vue'
import InfornexusPage from '../pages/infornexus/InfornexusPage.vue'
import ItInvoicePdfReorderPage from '../pages/it-invoice-pdf-reorder/ItInvoicePdfReorderPage.vue'
import JaneBomComparePage from '../pages/jane-bom-compare/JaneBomComparePage.vue'
import JaneBomSummaryPage from '../pages/jane-bom-summary/JaneBomSummaryPage.vue'
import JaneOutboundComparePage from '../pages/jane-outbound-compare/JaneOutboundComparePage.vue'
import JanePage from '../pages/jane/JanePage.vue'
import JaneSapPage from '../pages/jane-sap/JaneSapPage.vue'
import JesscaPage from '../pages/jessca/JesscaPage.vue'
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import SettingsPage from '../pages/settings/SettingsPage.vue'
import ShippingAutomation2Page from '../pages/shipping-automation-2/ShippingAutomation2Page.vue'
import SophiaTinaPage from '../pages/sophia-tina/SophiaTinaPage.vue'
import WebAutomationScenarioPage from '../pages/web-automation/WebAutomationScenarioPage.vue'

const routeComponents: Partial<Record<string, Component>> = {
  home: HomePage,
  jessca: JesscaPage,
  jane: JanePage,
  'jane-bom-summary': JaneBomSummaryPage,
  'jane-bom-compare': JaneBomComparePage,
  'jane-outbound-compare': JaneOutboundComparePage,
  eric: EricPage,
  'it-invoice-pdf-reorder': ItInvoicePdfReorderPage,
  'jane-sap': JaneSapPage,
  'eric-infornexus': EricInfornexusPage,
  'sophia-tina': SophiaTinaPage,
  'browser-plugins': BrowserPluginsPage,
  infornexus: InfornexusPage,
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
    path: '/web-automation/scenarios/shipping-automation-2',
    name: 'web-automation-scenario-shipping-automation-2',
    component: ShippingAutomation2Page,
    meta: {
      title: 'shipping 2 自动化',
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

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [...redirectRoutes, ...scenarioRoutes, ...moduleRoutes],
})
