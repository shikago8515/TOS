import { describe, expect, it } from 'vitest'

import {
  buildAutoFieldMappings,
  normalizeExcelFieldLabel,
  type ExcelTemplateMapperHeader,
} from './excelTemplateMapperModel'

const sourceHeaders: ExcelTemplateMapperHeader[] = [
  { index: 1, letter: 'A', label: 'PO Number', sample_value: 'PO-001' },
  { index: 2, letter: 'B', label: 'Style_Name', sample_value: 'Jacket' },
  { index: 3, letter: 'C', label: 'Qty', sample_value: '12' },
]

describe('excelTemplateMapperModel', () => {
  it('normalizes case, whitespace and underscores for matching', () => {
    expect(normalizeExcelFieldLabel(' Style_Name ')).toBe('stylename')
    expect(normalizeExcelFieldLabel('style name')).toBe('stylename')
    expect(normalizeExcelFieldLabel('STYLE-NAME')).toBe('stylename')
  })

  it('builds exact and normalized automatic field mappings', () => {
    const mappings = buildAutoFieldMappings(sourceHeaders, [
      { index: 1, letter: 'A', label: 'PO Number', sample_value: '' },
      { index: 2, letter: 'B', label: 'Style Name', sample_value: '' },
      { index: 3, letter: 'C', label: 'Quantity', sample_value: '' },
    ])

    expect(mappings).toEqual([
      { targetColumn: 1, targetHeader: 'PO Number', sourceColumn: 1, sourceHeader: 'PO Number', required: true },
      { targetColumn: 2, targetHeader: 'Style Name', sourceColumn: 2, sourceHeader: 'Style_Name', required: true },
      { targetColumn: 3, targetHeader: 'Quantity', sourceColumn: 0, sourceHeader: '', required: true },
    ])
  })
})
