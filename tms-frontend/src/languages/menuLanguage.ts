import type { RouteLocationNormalizedLoaded } from 'vue-router'

import { tosModules, getLocalizedModuleTitle } from '../domain/moduleCatalog'
import { translateStaticText } from '../shared/i18n/appLanguage'
import { i18n } from './index'
import { koiLanguageToAppLanguage, type KoiLanguage } from './language'

function getCurrentLanguage(): KoiLanguage {
  return i18n.global.locale.value === 'en' ? 'en' : 'zh'
}

export function getMenuLanguage(title?: string): string {
  if (!title) {
    return i18n.global.t('menu.untitled')
  }

  if (title.startsWith('menu.')) {
    return i18n.global.t(title)
  }

  const language = getCurrentLanguage()
  const module = tosModules.find(
    (item) =>
      item.title === title ||
      item.titleEn === title ||
      item.navLabel === title ||
      item.navLabelEn === title,
  )

  if (module) {
    return getLocalizedModuleTitle(module, koiLanguageToAppLanguage(language))
  }

  if (title === 'Release Updates' || title === '版本更新记录') {
    return i18n.global.t('menu.releaseUpdates')
  }

  return translateStaticText(title, koiLanguageToAppLanguage(language))
}

export function getRouteMenuLanguage(route: Pick<RouteLocationNormalizedLoaded, 'meta'>): string {
  return getMenuLanguage(typeof route.meta.title === 'string' ? route.meta.title : undefined)
}

export function getDocumentTitle(routeTitle?: string): string {
  const localizedTitle = getMenuLanguage(routeTitle)
  return localizedTitle ? `${localizedTitle} - TOS` : 'TOS'
}

