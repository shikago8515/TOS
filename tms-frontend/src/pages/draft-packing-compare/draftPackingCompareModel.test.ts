import { describe, expect, it } from 'vitest'

import {
  buildDraftPackingCompareSummary,
  draftPackingCompareModuleName,
} from './draftPackingCompareModel'

describe('draftPackingCompareModel', () => {
  it('uses the short PDF compare name for history records', () => {
    expect(draftPackingCompareModuleName).toBe('PDF核对')
  })

  it('uses origin certificate labels in result summaries', () => {
    const summary = buildDraftPackingCompareSummary(
      {
        success: true,
        message: 'ok',
        draft_count: 2,
        packing_count: 2,
        group_count: 2,
        issue_count: 0,
        mismatch_count: 0,
        missing_field_count: 0,
        output_file: 'result.xlsx',
      },
      {
        draft: 1,
        packing: 1,
      },
    )

    expect(summary.map((item) => item.label)).toContain('产地证PDF')
    expect(summary.map((item) => item.label)).toContain('产地证记录')
    expect(summary.map((item) => item.label)).not.toContain('Draft Form E PDF')
    expect(summary.map((item) => item.label)).not.toContain('Draft 记录')
  })
})
