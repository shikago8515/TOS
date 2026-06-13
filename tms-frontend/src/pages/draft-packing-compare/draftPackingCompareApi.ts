import {
  buildBackendDownloadUrl,
  postFormData,
} from '../../shared/api/backendClient'

export interface DraftPackingCompareProcessRequest {
  draftFile: File
  packingFile: File
}

export interface DraftPackingCompareProcessResponse {
  success: boolean
  message: string
  output_file?: string
  group_count?: number
  issue_count?: number
  mismatch_count?: number
  missing_field_count?: number
  draft_count?: number
  packing_count?: number
  logs?: string[]
}

export async function processDraftPackingCompareFiles(
  request: DraftPackingCompareProcessRequest,
  onProgress: (percentage: number) => void,
): Promise<DraftPackingCompareProcessResponse> {
  const formData = new FormData()

  formData.append('draft_file', request.draftFile)
  formData.append('packing_file', request.packingFile)

  return postFormData<DraftPackingCompareProcessResponse>({
    path: '/api/draft-packing-compare/process',
    formData,
    onProgress,
  })
}

export async function downloadDraftPackingCompareResult(filename: string): Promise<void> {
  const downloadUrl = await buildBackendDownloadUrl(
    `/api/draft-packing-compare/download/${encodeURIComponent(filename)}`,
  )
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = 'draft_packing_compare.xlsx'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
