import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postFormData } from '../../shared/api/backendClient'
import { processJasonResultSetExcel } from './jasonResultSetExcelApi'

vi.mock('../../shared/api/backendClient', () => ({
  postFormData: vi.fn(),
}))

describe('jasonResultSetExcelApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
  })

  it('posts Result Set workbook, date range, and order type with backend field names', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      success: true,
      message: 'ok',
      output_file: 'result.xlsx',
    })
    const file = new File(['result-set'], 'To ERIC 2026-06-30.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const onProgress = vi.fn()

    await processJasonResultSetExcel(
      {
        resultSetFile: file,
        dateFilterMode: 'range',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        orderTypeFilter: 'bulk',
      },
      onProgress,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jason/result-set-excel/process')
    expect(request?.onProgress).toBe(onProgress)
    expect(request?.formData.get('result_set_file')).toBe(file)
    expect(request?.formData.get('date_filter_mode')).toBe('range')
    expect(request?.formData.get('date_from')).toBe('2026-07-01')
    expect(request?.formData.get('date_to')).toBe('2026-07-31')
    expect(request?.formData.get('order_type_filter')).toBe('bulk')
    expect(request?.formData.get('target_month')).toBeNull()
  })

  it('posts no date range when the optional date filter is cleared', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      success: true,
      message: 'ok',
      output_file: 'result.xlsx',
    })
    const file = new File(['result-set'], 'To ERIC 2026-06-30.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await processJasonResultSetExcel(
      {
        resultSetFile: file,
        dateFilterMode: 'none',
        dateFrom: '',
        dateTo: '',
        orderTypeFilter: 'sample',
      },
      vi.fn(),
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.formData.get('date_filter_mode')).toBe('none')
    expect(request?.formData.get('date_from')).toBeNull()
    expect(request?.formData.get('date_to')).toBeNull()
    expect(request?.formData.get('order_type_filter')).toBe('sample')
  })
})
