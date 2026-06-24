import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  fileURLToPath(new URL('./DraftPackingComparePage.vue', import.meta.url)),
  'utf8',
)

function getUploadFieldsBlock(): string {
  const match = pageSource.match(
    /const uploadFields = computed<ExcelFileField\[\]>\(\(\) => \[(?<fields>[\s\S]*?)\]\)/,
  )

  return match?.groups?.fields ?? ''
}

describe('DraftPackingComparePage source', () => {
  it('uses the origin certificate module title instead of the legacy draft title', () => {
    expect(pageSource).toContain(':title="draftPackingCompareModuleName"')
    expect(pageSource).not.toContain('Draft & Packing List 核对')
  })

  it('does not render helper copy under upload field labels', () => {
    const uploadFieldsBlock = getUploadFieldsBlock()

    expect(uploadFieldsBlock).toContain("id: 'draft'")
    expect(uploadFieldsBlock).toContain("id: 'packing'")
    expect(uploadFieldsBlock).not.toContain('hint:')
  })
})
