import { request } from '@/utils/request'

/**
 * 教师端 - 课程管理 API
 */

// 获取课程列表
export function getCourseList(params) {
  return request.get('/courses', { params })
}

// 获取我的课程列表
export function getMyCourses() {
  return request.get('/courses/my')
}

// 获取课程详情
export function getCourseDetail(courseId) {
  return request.get(`/courses/${courseId}`)
}

// 创建课程
export function createCourse(data) {
  return request.post('/courses', data)
}

// 更新课程
export function updateCourse(courseId, data) {
  return request.put(`/courses/${courseId}`, data)
}

// 删除课程
export function deleteCourse(courseId) {
  return request.delete(`/courses/${courseId}`)
}
