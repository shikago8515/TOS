import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readPageSource(): string {
  return readFileSync(new URL('./JanePage.vue', import.meta.url), 'utf8')
}

describe('JanePage history archive warning source', () => {
  it('passes backend history warnings into the shared result summary', () => {
    const source = readPageSource()

    expect(source).toContain(':warnings="historyWarnings"')
    expect(source).toContain('const historyWarnings = ref<string[]>([])')
    expect(source).toContain('historyWarnings.value = historyMetadata.historyWarnings ?? []')
  })
})
