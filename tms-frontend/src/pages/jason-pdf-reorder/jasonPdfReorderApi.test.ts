import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'
import {
  buildJasonPdfReorderDownloadUrl,
  extractJasonPdfReorderNumbers,
  previewJasonPdfReorderInvoice,
  previewJasonPdfReorderPo,
  processJasonPdfReorder,
} from './jasonPdfReorderApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('jasonPdfReorderApi', () => {
  beforeEach(() => {
    vi.mocked(buildBackendDownloadUrl).mockReset()
    vi.mocked(postFormData).mockReset()
  })

  it('posts invoice preview with the FastAPI multipart field name', async () => {
    vi.mocked(postFormData).mockResolvedValue({ entries: [], summary: {}, logs: [] })
    const invoiceFile = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })

    await previewJasonPdfReorderInvoice(invoiceFile)

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jason/pdf-reorder/preview-invoice')
    expect(request?.formData.get('invoice_pdf')).toBe(invoiceFile)
  })

  it('posts PO preview and custom extraction without legacy paths', async () => {
    vi.mocked(postFormData).mockResolvedValueOnce({ poPages: [], poCount: 0, pageCount: 0, logs: [] })
    vi.mocked(postFormData).mockResolvedValueOnce({ files: [], numbers: [], count: 0, logs: [] })
    const poFile = new File(['po'], 'po.pdf', { type: 'application/pdf' })

    await previewJasonPdfReorderPo(poFile)
    await extractJasonPdfReorderNumbers({
      files: [poFile],
      pattern: '090|45',
      searchType: 'startsWith',
    })

    const poRequest = vi.mocked(postFormData).mock.calls[0]?.[0]
    const extractRequest = vi.mocked(postFormData).mock.calls[1]?.[0]

    expect(poRequest?.path).toBe('/api/jason/pdf-reorder/preview-po')
    expect(poRequest?.formData.get('po_pdf')).toBe(poFile)
    expect(extractRequest?.path).toBe('/api/jason/pdf-reorder/extract-numbers')
    expect(extractRequest?.formData.getAll('files')).toEqual([poFile])
    expect(extractRequest?.formData.get('pattern')).toBe('090|45')
    expect(extractRequest?.formData.get('search_type')).toBe('startsWith')
  })

  it('posts process options with stable backend field names and builds download URLs', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      jobId: 'abc',
      fileName: 'result.pdf',
      downloadUrl: '/api/jason/pdf-reorder/download/abc',
      summary: {},
      entries: [],
      logs: [],
    })
    vi.mocked(buildBackendDownloadUrl).mockResolvedValue('http://127.0.0.1:8000/api/jason/pdf-reorder/download/abc')
    const invoiceFile = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })
    const poFile = new File(['po'], 'po.pdf', { type: 'application/pdf' })

    await processJasonPdfReorder({
      invoiceFile,
      poFile,
      poOrderText: '4501749160',
      printCurrentOnly: true,
      printNextPage: false,
      includeNotFound: true,
    })
    const downloadUrl = await buildJasonPdfReorderDownloadUrl('/api/jason/pdf-reorder/download/abc')

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jason/pdf-reorder/process')
    expect(request?.formData.get('invoice_pdf')).toBe(invoiceFile)
    expect(request?.formData.get('po_pdf')).toBe(poFile)
    expect(request?.formData.get('po_order_text')).toBe('4501749160')
    expect(request?.formData.get('print_current_only')).toBe('true')
    expect(request?.formData.get('print_next_page')).toBe('false')
    expect(request?.formData.get('include_not_found')).toBe('true')
    expect(downloadUrl).toBe('http://127.0.0.1:8000/api/jason/pdf-reorder/download/abc')
  })

  it('allows manual PO order processing without invoice PDF', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      jobId: 'manual',
      fileName: 'result.pdf',
      downloadUrl: '/api/jason/pdf-reorder/download/manual',
      summary: {},
      entries: [],
      logs: [],
    })
    const poFile = new File(['po'], 'po.pdf', { type: 'application/pdf' })

    await processJasonPdfReorder({
      invoiceFile: null,
      poFile,
      poOrderText: '4501749160\n4501749225',
      printCurrentOnly: true,
      printNextPage: true,
      includeNotFound: false,
    })

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/jason/pdf-reorder/process')
    expect(request?.formData.has('invoice_pdf')).toBe(false)
    expect(request?.formData.get('po_pdf')).toBe(poFile)
    expect(request?.formData.get('po_order_text')).toBe('4501749160\n4501749225')
  })
})
