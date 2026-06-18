import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildBackendDownloadUrl, postFormData } from '../../shared/api/backendClient'
import {
  inspectIplexDualTableWorkbook,
  processIplexDualTableCompareFiles,
} from './iplexDualTableCompareApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('iplexDualTableCompareApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
    vi.mocked(buildBackendDownloadUrl).mockReset()
  })

  it('posts a single workbook to inspect headers with sheet and header row options', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      sheets: [],
      selected_sheet: {
        name: 'Sheet1',
        header_row: 2,
        max_row: 10,
        max_column: 3,
        data_row_count: 8,
        headers: [],
      },
    })
    const file = new File(['main'], 'main.xlsx')

    await inspectIplexDualTableWorkbook({
      file,
      sheetName: 'Sheet1',
      headerRow: 2,
    })

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/iplex/dual-table-compare/inspect')
    expect(request?.formData.get('excel_file')).toBe(file)
    expect(request?.formData.get('sheet_name')).toBe('Sheet1')
    expect(request?.formData.get('header_row')).toBe('2')
  })

  it('posts both workbooks and one-based column config as JSON for processing', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      success: true,
      message: 'ok',
    })
    const mainFile = new File(['main'], 'main.xlsx')
    const lookupFile = new File(['lookup'], 'lookup.xls')
    const onProgress = vi.fn()

    await processIplexDualTableCompareFiles(
      {
        mainFile,
        lookupFile,
        config: {
          main_sheet_name: 'Main',
          lookup_sheet_name: 'Lookup',
          main_header_row: 1,
          lookup_header_row: 1,
          main_key_column: 1,
          lookup_key_column: 3,
          four_digit_main_column: 31,
          four_digit_lookup_column: 7,
          two_digit_main_column: 32,
          two_digit_lookup_column: 10,
        },
      },
      onProgress,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/iplex/dual-table-compare/process')
    expect(request?.onProgress).toBe(onProgress)
    expect(request?.formData.get('main_file')).toBe(mainFile)
    expect(request?.formData.get('lookup_file')).toBe(lookupFile)
    expect(JSON.parse(String(request?.formData.get('config_json')))).toMatchObject({
      main_key_column: 1,
      lookup_key_column: 3,
      four_digit_main_column: 31,
      two_digit_lookup_column: 10,
    })
  })
})
