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

  it('posts Result Set workbook and target month with backend field names', async () => {
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
        targetMonth: '2026-07',
      },
      onProgress,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jason/result-set-excel/process')
    expect(request?.onProgress).toBe(onProgress)
    expect(request?.formData.get('result_set_file')).toBe(file)
    expect(request?.formData.get('target_month')).toBe('2026-07')
  })
})
