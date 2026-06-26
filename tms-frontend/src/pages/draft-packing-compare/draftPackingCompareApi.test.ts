import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postFormData } from '../../shared/api/backendClient'
import { processDraftPackingCompareFiles } from './draftPackingCompareApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('draftPackingCompareApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
  })

  it('posts multiple origin and packing PDFs with repeated legacy field names', async () => {
    vi.mocked(postFormData).mockResolvedValue({ success: true, message: 'ok' })
    const firstDraftFile = new File(['draft-a'], 'draft-a.pdf', { type: 'application/pdf' })
    const secondDraftFile = new File(['draft-b'], 'draft-b.pdf', { type: 'application/pdf' })
    const firstPackingFile = new File(['packing-a'], 'packing-a.pdf', { type: 'application/pdf' })
    const secondPackingFile = new File(['packing-b'], 'packing-b.pdf', {
      type: 'application/pdf',
    })

    await processDraftPackingCompareFiles(
      {
        draftFiles: [firstDraftFile, secondDraftFile],
        packingFiles: [firstPackingFile, secondPackingFile],
      },
      () => undefined,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/draft-packing-compare/process')
    expect(request?.formData.getAll('draft_file')).toEqual([
      firstDraftFile,
      secondDraftFile,
    ])
    expect(request?.formData.getAll('packing_file')).toEqual([
      firstPackingFile,
      secondPackingFile,
    ])
  })
})
