import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  fileURLToPath(new URL('./TmsFinanceInternalReconciliationPage.vue', import.meta.url)),
  'utf8',
)

describe('TmsFinanceInternalReconciliationPage source', () => {
  it('uses the active process label as the page title without a subtitle', () => {
    expect(pageSource).toContain(':title="activeProcess.label"')
    expect(pageSource).not.toContain('title="TMS财务表格数据处理"')
    expect(pageSource).not.toContain(':subtitle=')
    expect(pageSource).toContain("'请先上传 iPLEX 导出表。'")
    expect(pageSource).toContain("'请先上传 Turnover Excel。'")
    expect(pageSource).not.toContain("'请先上传 BULK Sales 导出表。'")
    expect(pageSource).not.toContain("'请先上传 TURNOVER 目标表。'")
  })
})
