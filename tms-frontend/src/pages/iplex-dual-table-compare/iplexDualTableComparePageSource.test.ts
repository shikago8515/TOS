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

  it('labels the second upload field as the target workbook', () => {
    const uploadFieldsBlock = extractUploadFieldsBlock(readPageSource())

    expect(uploadFieldsBlock).toContain("label: 'Total Adjustment & Shas Vas Price 汇总表'")
    expect(uploadFieldsBlock).toContain("label: '目标表'")
  })

  it('uses business workbook names in mismatch preview headings', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain("text('目标表行号')")
    expect(pageSource).toContain("text('目标表单价')")
    expect(pageSource).toContain("text('汇总表单价')")
    expect(pageSource).toContain("text('目标表金额')")
    expect(pageSource).toContain("text('汇总表金额')")
    expect(pageSource).not.toContain("text('RC 行号')")
    expect(pageSource).not.toContain("text('RC 单价')")
    expect(pageSource).not.toContain("text('PO 单价')")
    expect(pageSource).not.toContain("text('RC 金额')")
    expect(pageSource).not.toContain("text('PO 金额')")
  })

  it('does not render helper copy under the mismatch preview title', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain('核对异常列表')
    expect(pageSource).not.toContain('只显示差值不为 0 或未匹配的 RC 行。')
  })
})
