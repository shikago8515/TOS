import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readDashboardSource(): string {
  return readFileSync(new URL('./composables/useHomeDashboard.ts', import.meta.url), 'utf8')
}

describe('useHomeDashboard source', () => {
  it('queries and loads process history by history module ids instead of catalog ids', () => {
    const source = readDashboardSource()

    expect(source).toContain('homeDashboardHistoryModuleIds')
    expect(source).not.toContain('homeDashboardHistoryModules.map((module) => module.id)')
    expect(source).not.toContain('loadModuleHistory(module.id)')
    expect(source).not.toContain('homeDashboardModules.map((module) => module.id)')
    expect(source).not.toContain('return homeDashboardModules')
  })

  it('refreshes cached home tabs on activation without double loading the first mount', () => {
    const source = readDashboardSource()

    expect(source).toContain('onActivated')
    expect(source).toContain('hasLoadedOnce')
    expect(source).toContain('if (hasLoadedOnce.value)')
  })
})
