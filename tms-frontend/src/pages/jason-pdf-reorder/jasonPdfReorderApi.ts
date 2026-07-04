import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export const JASON_PDF_REORDER_API_PREFIX = '/api/jason/pdf-reorder'

export type JasonPdfReorderExtractSearchType =
  | 'startsWith'
  | 'contains'
  | 'exact'
  | 'regex'

export interface JasonPdfReorderEntry {
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

export interface JasonPdfReorderSummary {
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

export interface JasonPdfReorderPreviewResponse {
  entries: JasonPdfReorderEntry[]
  summary: JasonPdfReorderSummary
  logs?: string[]
}

export interface JasonPdfReorderPoPageGroup {
  po: string
  pages: number[]
}

export interface JasonPdfReorderPoPreviewResponse {
  poPages: JasonPdfReorderPoPageGroup[]
  poCount: number
  pageCount: number
  logs?: string[]
}

export interface JasonPdfReorderExtractPage {
  pageNum: number
  numbers: string[]
}

export interface JasonPdfReorderExtractFile {
  fileName: string
  pages: JasonPdfReorderExtractPage[]
}

export interface JasonPdfReorderExtractResponse {
  files: JasonPdfReorderExtractFile[]
  numbers: string[]
  count: number
  logs?: string[]
}

export interface JasonPdfReorderExtractRequest {
  files: File[]
  pattern: string
  searchType: JasonPdfReorderExtractSearchType
}

export interface JasonPdfReorderProcessRequest {
  invoiceFile?: File | null
  poFile: File
  poOrderText?: string
  printCurrentOnly: boolean
  printNextPage: boolean
  includeNotFound: boolean
}

export interface JasonPdfReorderProcessResponse {
  jobId: string
  fileName: string
  downloadUrl: string
  summary: JasonPdfReorderSummary
  entries: JasonPdfReorderEntry[]
  logs?: string[]
}

export function previewJasonPdfReorderInvoice(
  invoiceFile: File,
): Promise<JasonPdfReorderPreviewResponse> {
  const formData = new FormData()
  formData.append('invoice_pdf', invoiceFile)

  return postFormData<JasonPdfReorderPreviewResponse>({
    path: `${JASON_PDF_REORDER_API_PREFIX}/preview-invoice`,
    formData,
  })
}

export function previewJasonPdfReorderPo(poFile: File): Promise<JasonPdfReorderPoPreviewResponse> {
  const formData = new FormData()
  formData.append('po_pdf', poFile)

  return postFormData<JasonPdfReorderPoPreviewResponse>({
    path: `${JASON_PDF_REORDER_API_PREFIX}/preview-po`,
    formData,
  })
}

export function extractJasonPdfReorderNumbers(
  request: JasonPdfReorderExtractRequest,
): Promise<JasonPdfReorderExtractResponse> {
  const formData = new FormData()

  request.files.forEach((file) => {
    formData.append('files', file)
  })
  formData.append('pattern', request.pattern)
  formData.append('search_type', request.searchType)

  return postFormData<JasonPdfReorderExtractResponse>({
    path: `${JASON_PDF_REORDER_API_PREFIX}/extract-numbers`,
    formData,
  })
}

export function processJasonPdfReorder(
  request: JasonPdfReorderProcessRequest,
): Promise<JasonPdfReorderProcessResponse> {
  const formData = new FormData()

  if (request.invoiceFile) {
    formData.append('invoice_pdf', request.invoiceFile)
  }
  formData.append('po_pdf', request.poFile)
  formData.append('po_order_text', request.poOrderText?.trim() ?? '')
  formData.append('print_current_only', String(request.printCurrentOnly))
  formData.append('print_next_page', String(request.printNextPage))
  formData.append('include_not_found', String(request.includeNotFound))

  return postFormData<JasonPdfReorderProcessResponse>({
    path: `${JASON_PDF_REORDER_API_PREFIX}/process`,
    formData,
  })
}

export function buildJasonPdfReorderDownloadUrl(path: string): Promise<string> {
  return buildBackendDownloadUrl(path)
}
