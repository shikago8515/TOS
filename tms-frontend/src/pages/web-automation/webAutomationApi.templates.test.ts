import { describe, expect, it, vi } from 'vitest'

import {
  buildBackendDownloadUrl,
  postFormData,
  requestBackendJson,
} from '../../shared/api/backendClient'
import {
  buildAutomationTemplateDownloadUrl,
  deleteAutomationTemplate,
  fetchAllAutomationTemplates,
  fetchAutomationTemplates,
  updateAutomationTemplate,
  uploadAutomationTemplate,
} from './webAutomationApi'

vi.mock('../../shared/api/backendClient', () => ({
  buildBackendDownloadUrl: vi.fn(),
  downloadUrlAsFile: vi.fn(),
  postFormData: vi.fn(),
  readResponseMessage: vi.fn(),
  requestBackendJson: vi.fn(),
}))

const template = {
  id: 42,
  moduleId: 'shipping-automation-demo',
  templateKey: 'default',
  displayName: 'Shipping Template',
  originalFilename: 'shipping-template.xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  fileSize: 1024,
  sha256: 'abc123',
  isActive: true,
  downloadPath: '/api/automation/templates/42/download',
}

describe('webAutomationApi template routing', () => {
  it('routes template management APIs through the remote backend target', async () => {
    vi.mocked(requestBackendJson)
      .mockResolvedValueOnce({ templates: [template] })
      .mockResolvedValueOnce({ templates: [template] })
      .mockResolvedValueOnce({ template })
      .mockResolvedValueOnce({})
    vi.mocked(postFormData).mockResolvedValue({ template })
    vi.mocked(buildBackendDownloadUrl).mockResolvedValue('https://ai.tomwell.net:56130/tos/desktop-api/api/automation/templates/42/download')

    await expect(fetchAutomationTemplates('shipping-automation-demo')).resolves.toEqual([template])
    await expect(fetchAllAutomationTemplates(true)).resolves.toEqual([template])
    await expect(uploadAutomationTemplate({
      moduleId: 'shipping-automation-demo',
      templateKey: 'default',
      displayName: 'Shipping Template',
      file: new File(['template'], 'shipping-template.xlsx'),
    })).resolves.toEqual(template)
    await expect(updateAutomationTemplate(42, { isActive: false })).resolves.toEqual(template)
    await expect(deleteAutomationTemplate(42)).resolves.toBeUndefined()
    await expect(buildAutomationTemplateDownloadUrl(template)).resolves.toBe(
      'https://ai.tomwell.net:56130/tos/desktop-api/api/automation/templates/42/download',
    )

    expect(requestBackendJson).toHaveBeenNthCalledWith(1, {
      path: '/api/automation/templates?moduleId=shipping-automation-demo',
      backendTarget: 'remote',
    })
    expect(requestBackendJson).toHaveBeenNthCalledWith(2, {
      path: '/api/automation/templates?includeInactive=true',
      backendTarget: 'remote',
    })
    expect(postFormData).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/automation/templates',
      backendTarget: 'remote',
    }))
    expect(requestBackendJson).toHaveBeenNthCalledWith(3, {
      method: 'PATCH',
      path: '/api/automation/templates/42',
      body: { isActive: false },
      backendTarget: 'remote',
    })
    expect(requestBackendJson).toHaveBeenNthCalledWith(4, {
      method: 'DELETE',
      path: '/api/automation/templates/42',
      backendTarget: 'remote',
    })
    expect(buildBackendDownloadUrl).toHaveBeenCalledWith(
      '/api/automation/templates/42/download',
      'remote',
    )
  })
})
