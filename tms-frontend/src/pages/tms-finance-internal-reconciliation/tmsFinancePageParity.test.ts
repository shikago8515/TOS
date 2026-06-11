import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pageSourcePath = fileURLToPath(
  new URL('./TmsFinanceInternalReconciliationPage.vue', import.meta.url),
)
const parityDocPath = fileURLToPath(
  new URL('../../../../docs/frontend-tms-finance-parity.md', import.meta.url),
)

describe('tms finance page parity', () => {
  it('keeps process switching in the sidebar instead of page content cards', () => {
    const pageSource = readFileSync(pageSourcePath, 'utf8')
    const parityDoc = readFileSync(parityDocPath, 'utf8')

    expect(pageSource).not.toContain('tms-finance-switcher')
    expect(pageSource).not.toContain('switchProcess(')
    expect(pageSource).not.toContain('useRouter')
    expect(parityDoc).toContain('left sidebar submenu and route are the only process-switching entry points')
  })
})
