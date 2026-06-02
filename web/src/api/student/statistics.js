import { request } from '@/utils/request'

/**
 * 学生端 - 统计报表 API
 */

// 获取学生仪表盘统计
export function getStudentDashboard() {
  return request.get('/statistics/student/dashboard')
}

// 获取学生个人实训报告
export function getStudentReport() {
  return request.get('/statistics/student/report')
}

// 获取学生单次提交报告列表
export function getStudentSubmissionReportList() {
  return request.get('/statistics/student/report/submissions')
}

// 获取学生单次提交报告详情
export function getStudentSubmissionReportDetail(submissionId) {
  return request.get(`/statistics/student/report/submissions/${submissionId}`)
}

// 导出学生单次提交 Word 报告
export function exportStudentSubmissionReport(submissionId) {
  return request.get(`/statistics/student/report/submissions/${submissionId}/export`, {
    responseType: 'blob'
  })
}
