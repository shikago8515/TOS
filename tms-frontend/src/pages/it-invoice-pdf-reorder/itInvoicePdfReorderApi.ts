import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export const IT_INVOICE_PDF_REORDER_API_PREFIX = '/api/it-invoice-pdf-reorder'

export type ItInvoiceExtractSearchType =
  | 'startsWith'
  | 'contains'
  | 'exact'
  | 'regex'

export interface ItInvoiceEntry {
  index: number
  po: string
  invoicePages?: number[]
  poPages?: number[]
  workingNo?: string
  articleNo?: string
  description?: string
  quantity?: string | null
  unitPrice?: string | null
  totalAmount?: string | null
  netAmount?: string | null
  shasVasPrice?: string | null
  merchandiseAmount?: string | null
  totalAdjustment?: string | null
  totalTaxes?: string | null
  orderTotal?: string | null
  status?: 'found' | 'missing' | string
}

export interface ItInvoiceSummary {
  invoicePoCount?: number
  outputPoCount?: number
  missingPoNumbers?: string[]
  extraPoNumbers?: string[]
  totalQuantity?: string | null
  totalAmount?: string | null
  totalNetAmount?: string | null
  totalShasVasPrice?: string | null
  totalMerchandiseAmount?: string | null
  totalAdjustment?: string | null
  totalTaxes?: string | null
  orderTotal?: string | null
  invoiceTotals?: Record<string, string | null>
}

export interface ItInvoicePreviewResponse {
  entries: ItInvoiceEntry[]
  summary: ItInvoiceSummary
  logs?: string[]
}

export interface ItPoPageGroup {
  po: string
  pages: number[]
}

export interface ItPoPreviewResponse {
  poPages: ItPoPageGroup[]
  poCount: number
  pageCount: number
  logs?: string[]
}

export interface ItInvoiceExtractPage {
  pageNum: number
  numbers: string[]
}

export interface ItInvoiceExtractFile {
  fileName: string
  pages: ItInvoiceExtractPage[]
}

export interface ItInvoiceExtractResponse {
  files: ItInvoiceExtractFile[]
  numbers: string[]
  count: number
  logs?: string[]
}

export interface ItInvoiceExtractRequest {
  files: File[]
  pattern: string
  searchType: ItInvoiceExtractSearchType
}

export interface ItInvoiceProcessRequest {
  invoiceFile: File
  poFile: File
  poOrderText?: string
  printCurrentOnly: boolean
  printNextPage: boolean
  includeNotFound: boolean
}

export interface ItInvoiceProcessResponse {
  jobId: string
  fileName: string
  downloadUrl: string
  summary: ItInvoiceSummary
  entries: ItInvoiceEntry[]
  logs?: string[]
}

export function previewItInvoice(
  invoiceFile: File,
): Promise<ItInvoicePreviewResponse> {
  const formData = new FormData()
  formData.append('invoice_pdf', invoiceFile)

  return postFormData<ItInvoicePreviewResponse>({
    path: `${IT_INVOICE_PDF_REORDER_API_PREFIX}/preview-invoice`,
    formData,
  })
}

export function previewItPo(poFile: File): Promise<ItPoPreviewResponse> {
  const formData = new FormData()
  formData.append('po_pdf', poFile)

  return postFormData<ItPoPreviewResponse>({
    path: `${IT_INVOICE_PDF_REORDER_API_PREFIX}/preview-po`,
    formData,
  })
}

export function extractItInvoiceNumbers(
  request: ItInvoiceExtractRequest,
): Promise<ItInvoiceExtractResponse> {
  const formData = new FormData()

  request.files.forEach((file) => {
    formData.append('files', file)
  })
  formData.append('pattern', request.pattern)
  formData.append('search_type', request.searchType)

  return postFormData<ItInvoiceExtractResponse>({
    path: `${IT_INVOICE_PDF_REORDER_API_PREFIX}/extract-numbers`,
    formData,
  })
}

export function processItInvoicePdfReorder(
  request: ItInvoiceProcessRequest,
): Promise<ItInvoiceProcessResponse> {
  const formData = new FormData()

  formData.append('invoice_pdf', request.invoiceFile)
  formData.append('po_pdf', request.poFile)
  formData.append('po_order_text', request.poOrderText?.trim() ?? '')
  formData.append('print_current_only', String(request.printCurrentOnly))
  formData.append('print_next_page', String(request.printNextPage))
  formData.append('include_not_found', String(request.includeNotFound))

  return postFormData<ItInvoiceProcessResponse>({
    path: `${IT_INVOICE_PDF_REORDER_API_PREFIX}/process`,
    formData,
  })
}

export function buildItInvoicePdfDownloadUrl(path: string): Promise<string> {
  return buildBackendDownloadUrl(path)
}
