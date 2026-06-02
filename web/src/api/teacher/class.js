import { request } from '@/utils/request'

/**
 * 教师端 - 班级管理 API
 */

// 获取班级列表
export function getClassList(params) {
  return request.get('/classes', { params })
}

// 获取我的班级列表
export function getMyClasses() {
  return request.get('/classes/my')
}

// 获取班级详情
export function getClassDetail(classId) {
  return request.get(`/classes/${classId}`)
}

// 创建班级
export function createClass(data) {
  return request.post('/classes', data)
}

// 更新班级
export function updateClass(classId, data) {
  return request.put(`/classes/${classId}`, data)
}

// 删除班级
export function deleteClass(classId) {
  return request.delete(`/classes/${classId}`)
}

// 添加学生到班级
export function addStudentToClass(classId, studentId) {
  return request.post(`/classes/${classId}/students/${studentId}`)
}

// 批量添加学生到班级
export function addStudentsToClassBatch(classId, studentIds) {
  return request.post(`/classes/${classId}/students/batch`, studentIds)
}

// 从班级移除学生
export function removeStudentFromClass(classId, studentId) {
  return request.delete(`/classes/${classId}/students/${studentId}`)
}

// 获取班级学生列表
export function getClassStudents(classId) {
  return request.get(`/classes/${classId}/students`)
}

// Excel 导入学生并加入班级
export function importStudentsToClass(classId, formData) {
  return request.upload(`/classes/${classId}/students/import`, formData)
}

// 下载导入模板
export function downloadStudentImportTemplate(classId) {
  return request.get(`/classes/${classId}/students/import/template`, { responseType: 'blob' })
}

// 搜索学生（用于添加学生到班级）
export function searchStudentList(keyword, classId, limit = 100) {
  return request.get('/classes/students/search', {
    params: {
      keyword,
      classId,
      limit
    }
  })
}
