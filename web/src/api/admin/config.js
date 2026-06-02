import { request } from '@/utils/request'

/**
 * 管理员端 - 系统配置 API
 */

// 获取系统配置
export function getSystemConfig() {
  return request.get('/admin/config')
}

// 保存系统配置
export function saveSystemConfig(data) {
  return request.put('/admin/config', data)
}

export function uploadSystemLogo(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.upload('/admin/config/logo', formData)
}

// 重置教师密码
export function resetTeacherPassword(teacherId, newPassword) {
  return request.put(`/admin/teachers/${teacherId}/reset-password`, { newPassword })
}

// 重置用户密码（通用）
export function resetUserPassword(userId, newPassword) {
  return request.put(`/admin/users/${userId}/reset-password`, { newPassword })
}
