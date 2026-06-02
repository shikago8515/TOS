import { request } from '@/utils/request'

/**
 * 教师端 - 任务管理 API
 */

// 分配任务
export function assignTasks(data) {
  return request.post('/training/tasks/assign', data)
}

// 获取案例下的所有任务
export function getTasksByCaseId(caseId) {
  return request.get(`/training/tasks/case/${caseId}`)
}

// 获取学生任务列表
export function getStudentTasks(studentId) {
  return request.get(`/training/tasks/student/${studentId}`)
}

// 获取任务详情
export function getTaskDetail(taskId) {
  return request.get(`/training/tasks/${taskId}`)
}

// 获取任务评分
export function getTaskGrading(taskId) {
  return request.get(`/grading/task/${taskId}`)
}

// 手动评分
export function submitManualGrading(taskId, data) {
  return request.post(`/grading/task/${taskId}/manual`, data)
}

// 获取案例评分统计
export function getCaseStatistics(caseId) {
  return request.get(`/grading/case/${caseId}/statistics`)
}
