import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./JesscaPage.vue', import.meta.url), 'utf8')
}

function extractUploadFieldsBlock(source: string): string {
  const match = source.match(/const uploadFields = computed<ExcelFileField\[\]>\(\(\) => \[[\s\S]*?\]\)/u)
  return match?.[0] ?? ''
}

describe('JesscaPage source', () => {
  it('uses the invoice compare title without the Jessica prefix', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain('title="Invoice 核对"')
    expect(pageSource).not.toContain('title="jessica')
    expect(pageSource).not.toContain('title="Jessica')
  })

  it('does not render helper copy under upload field labels', () => {
    const uploadFieldsBlock = extractUploadFieldsBlock(readPageSource())

    expect(uploadFieldsBlock).toContain("id: 'invoice'")
    expect(uploadFieldsBlock).toContain("id: 'reference'")
    expect(uploadFieldsBlock).toContain("id: 'packing'")
    expect(uploadFieldsBlock).not.toContain('hint:')
  })
})
