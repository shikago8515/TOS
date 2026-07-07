import { describe, expect, it } from 'vitest'

import { buildJesscaSummary, jesscaModuleName } from './jesscaModel'

describe('jesscaModel', () => {
  it('uses the invoice compare module name for new history records', () => {
    expect(jesscaModuleName).toBe('Invoice 核对')
  })

  it('adds TC INV PDF summary fields when TC records are returned', () => {
    const summary = buildJesscaSummary(
      {
        success: true,
        message: 'ok',
        invoice_count: 1,
        total_items: 2,
        matches: { 一致: 2, 不一致: 0, 未找到: 0 },
        diagnostics: { 一致: 2 },
        tc_count: 2,
        tc_matched_count: 1,
        tc_issue_count: 1,
        tc_summary_count: 1,
        tc_summary_issue_count: 1,
        tc_total_issue_count: 2,
        output_file: 'result.xlsx',
      },
      1,
      1,
    )

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'TC INV PDF', value: '1' }),
        expect.objectContaining({ label: 'TC核对记录', value: '2' }),
        expect.objectContaining({ label: 'TC异常', value: '2' }),
      ]),
    )
  })

  it('adds amount words summary fields when amount words stats are returned', () => {
    const summary = buildJesscaSummary(
      {
        success: true,
        message: 'ok',
        invoice_count: 1,
        total_items: 2,
        matches: { 一致: 2, 不一致: 0, 未找到: 0 },
        diagnostics: { 一致: 2 },
        amount_words_count: 1,
        amount_words_matched_count: 0,
        amount_words_issue_count: 1,
        output_file: 'result.xlsx',
      },
      1,
      0,
    )

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '大写金额核对', value: '1' }),
        expect.objectContaining({ label: '大写金额异常', value: '1' }),
      ]),
    )
  })
})
