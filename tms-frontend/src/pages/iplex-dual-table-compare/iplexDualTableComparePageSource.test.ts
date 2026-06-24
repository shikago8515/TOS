import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./IplexDualTableComparePage.vue', import.meta.url), 'utf8')
}

function extractUploadFieldsBlock(source: string): string {
  const match = source.match(/const uploadFields = computed<ExcelFileField\[\]>\(\(\) => \[[\s\S]*?\]\)/u)
  return match?.[0] ?? ''
}

describe('IplexDualTableComparePage source', () => {
  it('does not render helper copy under upload field labels', () => {
    const uploadFieldsBlock = extractUploadFieldsBlock(readPageSource())

    expect(uploadFieldsBlock).toContain("id: 'main'")
    expect(uploadFieldsBlock).toContain("id: 'lookup'")
    expect(uploadFieldsBlock).not.toContain('hint:')
  })

  it('does not render helper copy under the mismatch preview title', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain('核对异常列表')
    expect(pageSource).not.toContain('只显示差值不为 0 或未匹配的 RC 行。')
  })
})
