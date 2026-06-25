import { describe, expect, it } from 'vitest'

import { homeModuleCards, homeShortcutModules } from './homeModel'

describe('homeModel', () => {
  it('exposes the Jason PDF reorder shortcut through the canonical route', () => {
    const module = homeShortcutModules.find((entry) => entry.id === 'jason-pdf-reorder')

    expect(module?.path).toBe('/jason/pdf-reorder')
    expect(module?.routeName).toBe('jason-pdf-reorder')
  })

  it('uses the Eric Infornexus canonical route for module cards', () => {
    const ericCard = homeModuleCards.find((entry) => entry.module.id === 'eric-infornexus')
    const jessicaCard = homeModuleCards.find((entry) => entry.module.id === 'jessica-infornexus')
    const browserPluginsShortcut = homeShortcutModules.find((entry) => String(entry.id) === 'browser-plugins')

    expect(ericCard?.module.path).toBe('/eric-infornexus')
    expect(ericCard?.module.routeName).toBe('eric-infornexus')
    expect(ericCard?.iconName).toBe('globe')
    expect(jessicaCard).toBeUndefined()
    expect(browserPluginsShortcut).toBeUndefined()
  })
})
