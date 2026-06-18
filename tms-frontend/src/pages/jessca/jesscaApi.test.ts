import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postFormData } from '../../shared/api/backendClient'
import { processJesscaFiles } from './jesscaApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('jesscaApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
  })

  it('keeps the original two-file request when packing PDF is not provided', async () => {
    vi.mocked(postFormData).mockResolvedValue({ success: true, message: 'ok' })
    const invoiceFile = new File(['invoice'], 'invoice.xls', { type: 'application/vnd.ms-excel' })
    const referenceFile = new File(['reference'], 'reference.xlsx')

    await processJesscaFiles(
      {
        invoiceFiles: [invoiceFile],
        referenceFile,
      },
      () => undefined,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jessca/process')
    expect(request?.formData.getAll('invoices')).toEqual([invoiceFile])
    expect(request?.formData.get('reference_file')).toBe(referenceFile)
    expect(request?.formData.has('packing_file')).toBe(false)
  })

  it('posts the optional packing PDF when provided', async () => {
    vi.mocked(postFormData).mockResolvedValue({ success: true, message: 'ok' })
    const invoiceFile = new File(['invoice'], 'invoice.xls', { type: 'application/vnd.ms-excel' })
    const referenceFile = new File(['reference'], 'reference.xlsx')
    const packingFile = new File(['packing'], 'packing.pdf', { type: 'application/pdf' })

    await processJesscaFiles(
      {
        invoiceFiles: [invoiceFile],
        referenceFile,
        packingFile,
      },
      () => undefined,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.formData.get('packing_file')).toBe(packingFile)
  })
})
