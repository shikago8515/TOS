import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readDashboardSource(): string {
  return readFileSync(new URL('./composables/useHomeDashboard.ts', import.meta.url), 'utf8')
}

describe('useHomeDashboard source', () => {
  it('queries and loads process history by history module ids instead of catalog ids', () => {
    const source = readDashboardSource()

    expect(source).toContain('homeDashboardHistoryModules.map((module) => module.id)')
    expect(source).toContain('homeDashboardHistoryModules')
    expect(source).not.toContain('homeDashboardModules.map((module) => module.id)')
    expect(source).not.toContain('return homeDashboardModules')
  })
})
