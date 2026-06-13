import { describe, expect, it } from 'vitest'

import {
  buildExtractionRegex,
  buildMatchRows,
  extractNumbersFromText,
  parsePoList,
} from './jasonPdfReorderModel'

describe('jasonPdfReorderModel', () => {
  it('parses unique ten digit PO numbers in source order', () => {
    expect(parsePoList('4501749160\nabc 4501749225, 4501749160\n123')).toEqual([
      '4501749160',
      '4501749225',
    ])
  })

  it('builds local extraction regexes compatible with backend search types', () => {
    expect(extractNumbersFromText('090123 451234 778899', buildExtractionRegex('090|45', 'startsWith'))).toEqual([
      '090123',
      '451234',
    ])
    expect(extractNumbersFromText('12345 45123 999', buildExtractionRegex('45', 'contains'))).toEqual([
      '12345',
      '45123',
    ])
    expect(extractNumbersFromText('090 0901 45', buildExtractionRegex('090|45', 'exact'))).toEqual([
      '090',
      '45',
    ])
  })

  it('builds match rows from invoice entries and PO pages without mutating order', () => {
    const rows = buildMatchRows({
      poOrderText: '4501749160\n4501749225',
      invoiceEntries: [
        {
          index: 1,
          po: '4501749160',
          invoicePages: [1],
          poPages: [],
          articleNo: 'A1',
          quantity: '12',
          totalAmount: '99',
          status: 'missing',
        },
      ],
      poPages: new Map([
        ['4501749160', [3]],
        ['4501749999', [7]],
      ]),
    })

    expect(rows).toEqual([
      {
        po: '4501749160',
        pages: [3],
        articleNo: 'A1',
        quantity: '12',
        totalAmount: '99',
        found: true,
      },
      {
        po: '4501749225',
        pages: [],
        articleNo: undefined,
        quantity: undefined,
        totalAmount: undefined,
        found: false,
      },
    ])
  })
})
