import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  fileURLToPath(new URL('./JasonPdfReorderPage.vue', import.meta.url)),
  'utf8',
)

describe('JasonPdfReorderPage source', () => {
  it('is implemented as a Vue page instead of executing raw recovered HTML', () => {
    expect(pageSource).not.toContain('original-index.html?raw')
    expect(pageSource).not.toContain('new Function')
    expect(pageSource).not.toContain('attachShadow')
    expect(pageSource).not.toContain('innerHTML')
  })
})
