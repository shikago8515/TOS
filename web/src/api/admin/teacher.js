import { request } from '@/utils/request'

// 获取所有教师列表（支持分页和搜索）
export function getAllTeachers(params = {}) {
  return request.get('/admin/teachers', { params })
}

// 创建教师账号
export function createTeacher(data) {
  return request.post('/admin/teachers', data)
}

// 设置教师绑定的班级
export function setTeacherClasses(teacherId, classIds) {
  return request.put(`/admin/teachers/${teacherId}/classes`, classIds)
}
