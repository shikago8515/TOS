import { request } from '@/utils/request'

export function getLlmUsageOverview() {
  return request.get('/admin/llm/usage/overview')
}

export function getTeacherLlmUsage(params = {}) {
  return request.get('/admin/llm/usage/teachers', { params })
}

export function getStudentLlmUsage(params = {}) {
  return request.get('/admin/llm/usage/students', { params })
}

export function getDeepSeekBalance() {
  return request.get('/admin/llm/balance')
}
