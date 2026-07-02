import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildBackendDownloadUrl,
  downloadUrlAsFile,
} from '../api/backendClient'
import { downloadCurrentProcessResult } from './processHistory'

vi.mock('../api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  downloadUrlAsFile: vi.fn(),
  requestBackendJson: vi.fn(),
}))

describe('downloadCurrentProcessResult', () => {
  beforeEach(() => {
    vi.mocked(buildBackendDownloadUrl).mockReset()
    vi.mocked(downloadUrlAsFile).mockReset()
  })

  it('prefers archived process history result files over legacy module downloads', async () => {
    vi.mocked(buildBackendDownloadUrl).mockResolvedValue('https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/files/42/download')

    await downloadCurrentProcessResult({
      outputFile: 'local-result.xlsx',
      resultDownloadPath: '/api/process-history/files/42/download',
      resultDownloadBackendTarget: 'remote',
      resultFile: {
        id: 42,
        filename: 'archived-result.xlsx',
        downloadPath: '/api/process-history/files/42/download',
      },
      legacyDownloadPath: (filename) => `/api/jane/download/${encodeURIComponent(filename)}`,
    })

    expect(buildBackendDownloadUrl).toHaveBeenCalledWith(
      '/api/process-history/files/42/download',
      'remote',
    )
    expect(downloadUrlAsFile).toHaveBeenCalledWith(
      'https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/files/42/download',
      'archived-result.xlsx',
    )
  })

  it('falls back to the legacy module download when no archived result is available', async () => {
    vi.mocked(buildBackendDownloadUrl).mockResolvedValue('http://127.0.0.1:8000/api/jane/download/local%20result.xlsx')

    await downloadCurrentProcessResult({
      outputFile: 'local result.xlsx',
      legacyDownloadPath: (filename) => `/api/jane/download/${encodeURIComponent(filename)}`,
      fallbackFilename: 'jane_result.xlsx',
    })

    expect(buildBackendDownloadUrl).toHaveBeenCalledWith(
      '/api/jane/download/local%20result.xlsx',
    )
    expect(downloadUrlAsFile).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/jane/download/local%20result.xlsx',
      'local result.xlsx',
    )
  })

  it('rejects with a readable message when neither archived nor legacy result is available', async () => {
    await expect(
      downloadCurrentProcessResult({
        outputFile: '',
        legacyDownloadPath: (filename) => `/api/jane/download/${encodeURIComponent(filename)}`,
      }),
    ).rejects.toThrow('当前结果文件未生成，无法下载。')
  })
})
