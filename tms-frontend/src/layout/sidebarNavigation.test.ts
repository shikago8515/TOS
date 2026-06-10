import { describe, expect, it } from 'vitest'

import { resolveSidebarParentActivation } from './sidebarNavigation'

const childModules = [
  {
    path: '/tms-finance-internal-reconciliation',
    routeName: 'tms-finance-internal-reconciliation',
  },
  {
    path: '/tms-finance-work-sales',
    routeName: 'tms-finance-work-sales',
  },
]

describe('sidebarNavigation', () => {
  it('opens a parent and navigates to the first child when no child is active', () => {
    const result = resolveSidebarParentActivation({
      parentId: 'tms-finance-processing',
      childModules,
      activeRouteName: 'settings',
      expandedParentIds: new Set<string>(),
    })

    expect(result.targetPath).toBe('/tms-finance-internal-reconciliation')
    expect([...result.expandedParentIds]).toEqual(['tms-finance-processing'])
  })

  it('toggles an active parent without navigating away from its active child', () => {
    const result = resolveSidebarParentActivation({
      parentId: 'tms-finance-processing',
      childModules,
      activeRouteName: 'tms-finance-work-sales',
      expandedParentIds: new Set<string>(['tms-finance-processing']),
    })

    expect(result.targetPath).toBeUndefined()
    expect(result.expandedParentIds.has('tms-finance-processing')).toBe(false)
  })
})
