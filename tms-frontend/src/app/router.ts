import type { Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { tosRouteDefinitions, tosRouteRedirects } from './routeCatalog'
import AdidasMaterialsPage from '../pages/adidas-materials/AdidasMaterialsPage.vue'
import BrowserPluginsPage from '../pages/browser-plugins/BrowserPluginsPage.vue'
import EricPage from '../pages/eric/EricPage.vue'
import HomePage from '../pages/home/HomePage.vue'
import InfornexusPage from '../pages/infornexus/InfornexusPage.vue'
import JaneBomComparePage from '../pages/jane-bom-compare/JaneBomComparePage.vue'
import JaneBomSummaryPage from '../pages/jane-bom-summary/JaneBomSummaryPage.vue'
import JaneOutboundComparePage from '../pages/jane-outbound-compare/JaneOutboundComparePage.vue'
import JanePage from '../pages/jane/JanePage.vue'
import JesscaPage from '../pages/jessca/JesscaPage.vue'
import SettingsPage from '../pages/settings/SettingsPage.vue'
import SophiaTinaPage from '../pages/sophia-tina/SophiaTinaPage.vue'
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'
import WebAutomationPage from '../pages/web-automation/WebAutomationPage.vue'

const routeComponents: Partial<Record<string, Component>> = {
  home: HomePage,
  jessca: JesscaPage,
  jane: JanePage,
  'jane-bom-summary': JaneBomSummaryPage,
  'jane-bom-compare': JaneBomComparePage,
  'jane-outbound-compare': JaneOutboundComparePage,
  eric: EricPage,
  'sophia-tina': SophiaTinaPage,
  'browser-plugins': BrowserPluginsPage,
  'web-automation': WebAutomationPage,
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

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [...redirectRoutes, ...moduleRoutes],
})
