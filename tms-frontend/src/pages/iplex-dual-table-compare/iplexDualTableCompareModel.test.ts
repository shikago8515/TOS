import { describe, expect, it } from 'vitest'

import {
  buildAutoIplexDualTableCompareProcessRequest,
  buildIplexDualTableCompareProcessRequest,
  buildIplexDualTableCompareSummary,
  findSuggestedColumn,
  getIplexDualTablePreviewRows,
  iplexDualTableCompareModuleId,
} from './iplexDualTableCompareModel'

describe('iplexDualTableCompareModel', () => {
  it('summarizes processing counts for result display', () => {
    const summary = buildIplexDualTableCompareSummary({
      success: true,
      message: 'ok',
      output_file: 'iplex.xlsx',
      main_row_count: 10,
      lookup_row_count: 2,
      matched_count: 7,
      unmatched_count: 3,
      four_digit_mismatch_count: 1,
      two_digit_mismatch_count: 2,
    })

    expect(iplexDualTableCompareModuleId).toBe('iplex-dual-table-compare')
    expect(summary).toEqual([
      { label: 'RC输出行数', value: '10' },
      { label: 'PO查找行数', value: '2' },
      { label: '匹配行数', value: '7' },
      { label: '未匹配行数', value: '3' },
      { label: '4位小数差异', value: '1' },
      { label: '2位小数差异', value: '2' },
      { label: '结果文件', value: '已生成' },
    ])
  })

  it('finds recommended one-based columns by exact header label', () => {
    const headers = [
      { index: 1, label: 'PO #', letter: 'A', sample_value: '0901' },
      { index: 2, label: 'Total Adjustment Amount', letter: 'B', sample_value: '10.00' },
      { index: 32, label: 'Total Adjustment Amount', letter: 'AF', sample_value: '9.61' },
    ]

    expect(findSuggestedColumn(headers, 'PO #')).toBe(1)
    expect(findSuggestedColumn(headers, 'total adjustment amount')).toBe(2)
    expect(findSuggestedColumn(headers, 'total adjustment amount', { preferredLetter: 'AF' })).toBe(32)
    expect(findSuggestedColumn(headers, 'total adjustment amount', { preferLast: true })).toBe(32)
    expect(findSuggestedColumn(headers, 'Missing')).toBe(0)
  })

  it('maps PO adjustment columns into the RC output table for processing', () => {
    const poFile = new File(['po'], 'PO with Adjustment 3LP.xlsx')
    const rcFile = new File(['rc'], 'RC2620OW014 AD YTIC.xls')

    const request = buildIplexDualTableCompareProcessRequest({
      poFile,
      rcFile,
      poSheetName: 'PO',
      rcSheetName: 'RC',
      poHeaderRow: 1,
      rcHeaderRow: 1,
      poKeyColumn: 1,
      rcKeyColumn: 3,
      poFourDigitColumn: 31,
      rcFourDigitColumn: 7,
      poTwoDigitColumn: 32,
      rcTwoDigitColumn: 10,
    })

    expect(request.mainFile).toBe(rcFile)
    expect(request.lookupFile).toBe(poFile)
    expect(request.config).toMatchObject({
      main_sheet_name: 'RC',
      lookup_sheet_name: 'PO',
      main_header_row: 1,
      lookup_header_row: 1,
      main_key_column: 3,
      lookup_key_column: 1,
      four_digit_main_column: 7,
      four_digit_lookup_column: 31,
      two_digit_main_column: 10,
      two_digit_lookup_column: 32,
      four_digit_result_header: 'SHAS PRICE PER UNIT 差值',
      two_digit_result_header: 'TOTAL ADJUSTMENT 差值',
    })
  })

  it('builds processing config from fixed iPlex business columns automatically', () => {
    const poFile = new File(['po'], 'PO with Adjustment 3LP.xlsx')
    const rcFile = new File(['rc'], 'RC2620OW014 AD YTIC.xls')

    const request = buildAutoIplexDualTableCompareProcessRequest({
      poFile,
      rcFile,
      poInspection: {
        sheets: [],
        selected_sheet: {
          name: 'PO Sheet',
          header_row: 1,
          max_row: 10,
          max_column: 32,
          data_row_count: 9,
          headers: [
            { index: 1, letter: 'A', label: 'PO #', sample_value: '0901' },
            { index: 8, letter: 'H', label: 'Total Adjustment Amount', sample_value: '9.61' },
            { index: 31, letter: 'AE', label: 'Adjustment_per_unit', sample_value: '0.0155' },
            { index: 32, letter: 'AF', label: 'Total Adjustment Amount', sample_value: '9.61' },
          ],
        },
      },
      rcInspection: {
        sheets: [],
        selected_sheet: {
          name: 'RC Sheet',
          header_row: 1,
          max_row: 10,
          max_column: 10,
          data_row_count: 9,
          headers: [
            { index: 3, letter: 'C', label: 'BUYER ORDER NO.', sample_value: '0902893220' },
            { index: 7, letter: 'G', label: 'SHAS PRICE PER UNIT', sample_value: '0.0855' },
            { index: 10, letter: 'J', label: 'TOTAL ADJUSTMENT', sample_value: '31.81' },
          ],
        },
      },
    })

    expect(request.mainFile).toBe(rcFile)
    expect(request.lookupFile).toBe(poFile)
    expect(request.config).toMatchObject({
      main_sheet_name: 'RC Sheet',
      lookup_sheet_name: 'PO Sheet',
      main_header_row: 1,
      lookup_header_row: 1,
      main_key_column: 3,
      lookup_key_column: 1,
      four_digit_main_column: 7,
      four_digit_lookup_column: 31,
      two_digit_main_column: 10,
      two_digit_lookup_column: 32,
    })
  })

  it('reports missing fixed iPlex business columns before processing', () => {
    const poFile = new File(['po'], 'PO with Adjustment 3LP.xlsx')
    const rcFile = new File(['rc'], 'RC2620OW014 AD YTIC.xls')

    expect(() => buildAutoIplexDualTableCompareProcessRequest({
      poFile,
      rcFile,
      poInspection: {
        sheets: [],
        selected_sheet: {
          name: 'PO Sheet',
          header_row: 1,
          max_row: 10,
          max_column: 1,
          data_row_count: 9,
          headers: [
            { index: 1, letter: 'A', label: 'PO #', sample_value: '0901' },
          ],
        },
      },
      rcInspection: {
        sheets: [],
        selected_sheet: {
          name: 'RC Sheet',
          header_row: 1,
          max_row: 10,
          max_column: 1,
          data_row_count: 9,
          headers: [
            { index: 7, letter: 'G', label: 'SHAS PRICE PER UNIT', sample_value: '0.0855' },
            { index: 10, letter: 'J', label: 'TOTAL ADJUSTMENT', sample_value: '31.81' },
          ],
        },
      },
    })).toThrow('RC 表 Key 列：未找到 C / BUYER ORDER NO.')
  })

  it('returns only backend-provided mismatch preview rows', () => {
    const rows = getIplexDualTablePreviewRows({
      success: true,
      message: 'ok',
      preview_rows: [
        {
          row_number: 3,
          key: '0902893237',
          status: '不一致',
          four_digit: {
            main_value: '0.2501',
            lookup_value: '0.2500',
            difference: '0.0001',
          },
          two_digit: {
            main_value: '25.49',
            lookup_value: '25.50',
            difference: '-0.01',
          },
        },
      ],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('不一致')
    expect(rows[0]?.four_digit.difference).toBe('0.0001')
    expect(getIplexDualTablePreviewRows({ success: true, message: 'ok' })).toEqual([])
  })
})
