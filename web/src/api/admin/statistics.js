import { request } from '@/utils/request'

/**
 * 管理员端 - 统计报表 API
 */

// 获取管理员仪表盘统计
export function getAdminDashboard() {
  return request.get('/statistics/admin/dashboard')
}

// 获取系统统计数据
export function getSystemStatistics() {
  return request.get('/statistics/admin/dashboard')
}

// 获取课程统计
export function getCourseStatistics(courseId) {
  return request.get(`/statistics/course/${courseId}`)
}
