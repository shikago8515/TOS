import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readComponentSource(): string {
  return readFileSync(new URL('./ResultSummary.vue', import.meta.url), 'utf8')
}

describe('ResultSummary source', () => {
  it('renders archive warnings near successful result summaries', () => {
    const source = readComponentSource()

    expect(source).toContain('warnings?: string[]')
    expect(source).toContain('result-summary__warning')
    expect(source).toContain('结果已生成，但历史结果未归档，不会出现在历史结果页')
  })
})
