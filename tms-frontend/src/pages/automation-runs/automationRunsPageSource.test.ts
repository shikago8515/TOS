import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./AutomationRunsPage.vue', import.meta.url), 'utf8')
}

describe('AutomationRunsPage source', () => {
  it('reads archive records, details, deletes, and file downloads from the remote backend', () => {
    const source = readPageSource()

    expect(source).toContain("const automationRunsBackendTarget = 'remote' as const")
    expect(source).toContain('backendTarget: automationRunsBackendTarget')
    expect(source).toContain('fetchAutomationRunDetail(run.runId, { backendTarget: automationRunsBackendTarget })')
    expect(source).toContain('deleteAutomationRunRecord(run.runId, { backendTarget: automationRunsBackendTarget })')
    expect(source).toContain(':backend-target="automationRunsBackendTarget"')
  })
})
