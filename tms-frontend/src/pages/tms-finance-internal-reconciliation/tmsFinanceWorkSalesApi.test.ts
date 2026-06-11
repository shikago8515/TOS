import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postFormData } from '../../shared/api/backendClient'
import { processTmsFinanceWorkSalesFiles } from './tmsFinanceWorkSalesApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('tmsFinanceWorkSalesApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
  })

  it('posts BULK Sales and TURNOVER files with the new multipart field names', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      success: true,
      message: 'ok',
    })
    const bulkSalesFile = new File(['bulk'], 'bulk sales.xls')
    const turnoverFile = new File(['turnover'], 'TURNOVER.xlsx')
    const onProgress = vi.fn()

    await processTmsFinanceWorkSalesFiles(
      {
        bulkSalesFile,
        turnoverFile,
      },
      onProgress,
    )

    expect(postFormData).toHaveBeenCalledTimes(1)
    const request = vi.mocked(postFormData).mock.calls[0]?.[0]

    expect(request?.path).toBe('/api/tms-finance/work-sales/process')
    expect(request?.onProgress).toBe(onProgress)
    expect(request?.formData.get('bulk_sales_file')).toBe(bulkSalesFile)
    expect(request?.formData.get('turnover_file')).toBe(turnoverFile)
    expect(request?.formData.has('iplix_file')).toBe(false)
    expect(request?.formData.has('reference_file')).toBe(false)
  })
})
