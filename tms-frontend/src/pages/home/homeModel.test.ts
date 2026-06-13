import { describe, expect, it } from 'vitest'

import { homeShortcutModules } from './homeModel'

describe('homeModel', () => {
  it('exposes the Jason PDF reorder shortcut through the canonical route', () => {
    const module = homeShortcutModules.find((entry) => entry.id === 'jason-pdf-reorder')

    expect(module?.path).toBe('/jason/pdf-reorder')
    expect(module?.routeName).toBe('jason-pdf-reorder')
  })
})
