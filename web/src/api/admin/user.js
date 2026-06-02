import { request } from '@/utils/request'

/**
 * 管理员端 - 用户管理 API
 */

// 获取用户列表
export function getUserList(params) {
  return request.get('/users', { params })
}

// 获取用户详情
export function getUserDetail(userId) {
  return request.get(`/users/${userId}`)
}

// 创建用户
export function createUser(data) {
  return request.post('/users', data)
}

// 更新用户
export function updateUser(userId, data) {
  return request.put(`/users/${userId}`, data)
}

// 删除用户
export function deleteUser(userId) {
  return request.delete(`/users/${userId}`)
}

// 启用/禁用用户
export function toggleUserStatus(userId, status) {
  return request.put(`/users/${userId}/status`, null, { params: { status } })
}

// Excel 导入学生账号（管理员）
export function importStudents(formData) {
  return request.upload('/users/import/students', formData)
}

// 下载导入模板（管理员）
export function downloadStudentImportTemplate() {
  return request.get('/users/import/students/template', { responseType: 'blob' })
}
