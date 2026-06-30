import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildBackendDownloadUrl, postFormData } from '../../shared/api/backendClient'
import {
  downloadExcelTemplateMapperResult,
  inspectExcelTemplateMapperWorkbook,
  processExcelTemplateMapperFiles,
} from './excelTemplateMapperApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  postFormData: vi.fn(),
}))

describe('excelTemplateMapperApi', () => {
  beforeEach(() => {
    vi.mocked(postFormData).mockReset()
    vi.mocked(buildBackendDownloadUrl).mockReset()
  })

  it('posts a workbook to inspect headers with sheet and header row options', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      sheets: [],
      selected_sheet: {
        name: 'Sheet1',
        header_row: 2,
        max_row: 10,
        max_column: 3,
        data_row_count: 8,
        headers: [],
        sample_rows: [],
      },
    })
    const file = new File(['source'], 'source.xlsx')

    await inspectExcelTemplateMapperWorkbook({
      file,
      sheetName: 'Sheet1',
      headerRow: 2,
    })

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/excel-template-mapper/inspect')
    expect(request?.formData.get('excel_file')).toBe(file)
    expect(request?.formData.get('sheet_name')).toBe('Sheet1')
    expect(request?.formData.get('header_row')).toBe('2')
  })

  it('posts source, template and mapping config for processing', async () => {
    vi.mocked(postFormData).mockResolvedValue({
      success: true,
      message: 'ok',
      output_file: 'excel_template_mapper_result.xlsx',
    })
    const sourceFile = new File(['source'], 'source.xlsx')
    const templateFile = new File(['template'], 'template.xlsx')
    const onProgress = vi.fn()

    await processExcelTemplateMapperFiles(
      {
        sourceFile,
        templateFile,
        config: {
          source_sheet_name: 'Source',
          template_sheet_name: 'Template',
          source_header_row: 1,
          source_data_start_row: 2,
          template_header_row: 1,
          template_data_start_row: 2,
          mappings: [
            { target_column: 1, source_column: 1, target_header: 'Order', required: true },
          ],
        },
      },
      onProgress,
    )

    const request = vi.mocked(postFormData).mock.calls[0]?.[0]
    expect(request?.path).toBe('/api/excel-template-mapper/process')
    expect(request?.onProgress).toBe(onProgress)
    expect(request?.formData.get('source_file')).toBe(sourceFile)
    expect(request?.formData.get('template_file')).toBe(templateFile)
    expect(JSON.parse(String(request?.formData.get('config_json')))).toMatchObject({
      source_sheet_name: 'Source',
      template_sheet_name: 'Template',
      mappings: [{ target_column: 1, source_column: 1, target_header: 'Order', required: true }],
    })
  })

  it('builds the result download URL from the mapper download endpoint', async () => {
    vi.mocked(buildBackendDownloadUrl).mockResolvedValue('http://localhost/download/result.xlsx')

    await downloadExcelTemplateMapperResult('result.xlsx')

    expect(buildBackendDownloadUrl).toHaveBeenCalledWith('/api/excel-template-mapper/download/result.xlsx')
  })
})
