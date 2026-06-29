import { routeRedirects, tosModules } from '../domain/moduleCatalog'
import { getDocumentTitle as getLocalizedDocumentTitle } from '../languages/menuLanguage'

export interface TosRouteDefinition {
  path: string
  name: string
  title: string
}

export interface TosRouteRedirect {
  from: string
  to: string
}

export const tosRouteDefinitions: readonly TosRouteDefinition[] = tosModules.map(
  (module) => ({
    path: module.path,
    name: module.routeName,
    title: module.title,
  }),
)

export const tosRouteRedirects: readonly TosRouteRedirect[] = routeRedirects

export function getDocumentTitle(routeTitle?: string): string {
  return getLocalizedDocumentTitle(routeTitle)
}
