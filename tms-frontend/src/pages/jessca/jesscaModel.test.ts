import { describe, expect, it } from 'vitest'

import { jesscaModuleName } from './jesscaModel'

describe('jesscaModel', () => {
  it('uses the invoice compare module name for new history records', () => {
    expect(jesscaModuleName).toBe('Invoice 核对')
  })
})
