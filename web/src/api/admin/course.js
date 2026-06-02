import { request } from '@/utils/request'

// 获取所有课程列表（支持分页和搜索）
export function getAllCourses(params = {}) {
  return request.get('/admin/courses', { params })
}

// 创建课程
export function createCourse(data) {
  return request.post('/admin/courses', data)
}

// 更新课程
export function updateCourse(id, data) {
  return request.put(`/admin/courses/${id}`, data)
}

// 删除课程
export function deleteCourse(id) {
  return request.delete(`/admin/courses/${id}`)
}
