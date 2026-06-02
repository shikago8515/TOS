import { request } from '@/utils/request'

// 获取所有班级列表（支持分页和搜索）
export function getAllClasses(params = {}) {
  return request.get('/admin/classes', { params })
}

// 创建班级
export function createClass(data) {
  return request.post('/admin/classes', data)
}

// 更新班级
export function updateClass(id, data) {
  return request.put(`/admin/classes/${id}`, data)
}

// 删除班级
export function deleteClass(id) {
  return request.delete(`/admin/classes/${id}`)
}

// 绑定班级到教师
export function bindClassToTeacher(classId, teacherId) {
  return request.put(`/admin/classes/${classId}/teacher/${teacherId}`)
}

// 获取班级学生列表
export function getClassStudents(classId) {
  return request.get(`/classes/${classId}/students`)
}

// 搜索未分班学生
export function searchUnassignedStudents(keyword, classId, limit = 100) {
  return request.get('/classes/students/search', {
    params: {
      keyword,
      classId,
      limit
    }
  })
}

// 添加学生到班级
export function addStudentToClass(classId, studentId) {
  return request.post(`/classes/${classId}/students/${studentId}`)
}

// 批量添加学生到班级
export function addStudentsToClassBatch(classId, studentIds) {
  return request.post(`/classes/${classId}/students/batch`, studentIds)
}
