import { request } from '@/utils/request'

export function getCaseParamTemplates() {
  return request.get('/teacher/param-templates')
}

export function saveCaseParamTemplate(data) {
  return request.post('/teacher/param-templates', data)
}

export function deleteCaseParamTemplate(templateId) {
  return request.delete(`/teacher/param-templates/${templateId}`)
}
