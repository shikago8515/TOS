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

  it('allows multiple origin certificate and packing PDFs', () => {
    const uploadFieldsBlock = getUploadFieldsBlock()

    expect(pageSource).toContain('badge="每类至少 1 份 PDF"')
    expect(uploadFieldsBlock).toContain("label: '产地证PDF（可多选）'")
    expect(uploadFieldsBlock).toContain("label: 'Packing List PDF（可多选）'")
    expect(uploadFieldsBlock.match(/multiple: true/g)).toHaveLength(2)
    expect(uploadFieldsBlock).not.toContain('expectedCount: 1')
  })

  it('sends all selected files to the process API', () => {
    expect(pageSource).toContain('draftFiles: draftFiles.value')
    expect(pageSource).toContain('packingFiles: packingFiles.value')
    expect(pageSource).not.toContain('draftFile: draftFiles.value[0]')
    expect(pageSource).not.toContain('packingFile: packingFiles.value[0]')
  })
})
