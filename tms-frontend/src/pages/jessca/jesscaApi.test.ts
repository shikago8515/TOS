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

  it('keeps the original two-file request when TC INV PDF is not provided', async () => {
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
    expect(request?.requireRuntimeVersion).toBe(true)
    expect(request?.formData.getAll('invoices')).toEqual([invoiceFile])
    expect(request?.formData.get('reference_file')).toBe(referenceFile)
    expect(request?.formData.has('tc_invoice_file')).toBe(false)
    expect(request?.formData.has('packing_file')).toBe(false)
  })

  it('posts one optional TC INV PDF when provided', async () => {
    vi.mocked(postFormData).mockResolvedValue({ success: true, message: 'ok' })
    const invoiceFile = new File(['invoice'], 'invoice.xls', { type: 'application/vnd.ms-excel' })
    const referenceFile = new File(['reference'], 'reference.xlsx')
    const tcInvoiceFile = new File(['tc'], 'tc.pdf', { type: 'application/pdf' })

    await processJesscaFiles(
      {
        invoiceFiles: [invoiceFile],
        referenceFile,
        tcInvoiceFiles: [tcInvoiceFile],
      },
      () => undefined,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.formData.getAll('tc_invoice_file')).toEqual([tcInvoiceFile])
    expect(request?.formData.has('packing_file')).toBe(false)
  })

  it('posts multiple optional TC INV PDFs with repeated tc_invoice_file fields', async () => {
    vi.mocked(postFormData).mockResolvedValue({ success: true, message: 'ok' })
    const invoiceFile = new File(['invoice'], 'invoice.xls', { type: 'application/vnd.ms-excel' })
    const referenceFile = new File(['reference'], 'reference.xlsx')
    const firstTcFile = new File(['tc-a'], 'tc-a.pdf', { type: 'application/pdf' })
    const secondTcFile = new File(['tc-b'], 'tc-b.pdf', { type: 'application/pdf' })

    await processJesscaFiles(
      {
        invoiceFiles: [invoiceFile],
        referenceFile,
        tcInvoiceFiles: [firstTcFile, secondTcFile],
      },
      () => undefined,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.formData.getAll('tc_invoice_file')).toEqual([
      firstTcFile,
      secondTcFile,
    ])
  })
})
