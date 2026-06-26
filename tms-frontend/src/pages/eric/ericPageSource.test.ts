import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./EricPage.vue', import.meta.url), 'utf8')
}

function extractUploadFieldsBlock(source: string): string {
  const match = source.match(/const uploadFields = computed<ExcelFileField\[\]>\(\(\) => \[[\s\S]*?\]\)/u)
  return match?.[0] ?? ''
}

describe('EricPage source', () => {
  it('uses the plain data processing title without the Eric prefix', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain('title="数据处理"')
    expect(pageSource).not.toContain('title="Eric')
  })

  it('does not render helper copy under upload field labels', () => {
    const uploadFieldsBlock = extractUploadFieldsBlock(readPageSource())

    expect(uploadFieldsBlock).toContain("id: 'pack'")
    expect(uploadFieldsBlock).toContain("id: 'ytic'")
    expect(uploadFieldsBlock).not.toContain('hint:')
  })
})
