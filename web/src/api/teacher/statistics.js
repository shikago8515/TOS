import { request } from '@/utils/request'

/**
 * 教师端 - 统计报表 API
 */

// 获取教师仪表盘统计
export function getTeacherDashboard() {
  return request.get('/statistics/teacher/dashboard')
}

// 获取案例统计
export function getCaseStatistics(caseId) {
  return request.get(`/statistics/case/${caseId}`)
}

// 获取课程统计
export function getCourseStatistics(courseId) {
  return request.get(`/statistics/course/${courseId}`)
}

// 获取班级学情分析
export function getClassAnalytics(classId) {
  return request.get(`/statistics/class/${classId}/analytics`)
}
