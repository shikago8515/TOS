import type { Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { tosRouteDefinitions, tosRouteRedirects } from './routeCatalog'
import BrowserPluginsPage from '../pages/browser-plugins/BrowserPluginsPage.vue'
import EricPage from '../pages/eric/EricPage.vue'
import HomePage from '../pages/home/HomePage.vue'
import JanePage from '../pages/jane/JanePage.vue'
import JesscaPage from '../pages/jessca/JesscaPage.vue'
import SophiaTinaPage from '../pages/sophia-tina/SophiaTinaPage.vue'
import RoutePlaceholder from '../pages/RoutePlaceholder.vue'

const routeComponents: Partial<Record<string, Component>> = {
  home: HomePage,
  jessca: JesscaPage,
  jane: JanePage,
  eric: EricPage,
  'sophia-tina': SophiaTinaPage,
  'browser-plugins': BrowserPluginsPage,
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
