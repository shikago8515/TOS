import { describe, expect, it } from 'vitest'

import { filterAcceptedFiles } from './fileAcceptance'

describe('fileAcceptance', () => {
  it('keeps files matching accepted extensions and reports rejected names', () => {
    const result = filterAcceptedFiles(
      [
        { name: 'iplix.xls' },
        { name: 'summary.xlsx' },
        { name: 'macro.XLSM' },
        { name: 'notes.csv' },
      ],
      '.xls,.xlsx,.xlsm',
    )

    expect(result.accepted.map((file) => file.name)).toEqual([
      'iplix.xls',
      'summary.xlsx',
      'macro.XLSM',
    ])
    expect(result.rejectedNames).toEqual(['notes.csv'])
  })

  it('does not reject files when no accept rule is configured', () => {
    const result = filterAcceptedFiles([{ name: 'anything.csv' }], '')

    expect(result.accepted.map((file) => file.name)).toEqual(['anything.csv'])
    expect(result.rejectedNames).toEqual([])
  })
})
