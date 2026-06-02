/**
 * API 统一入口
 * 根据不同角色导出对应的 API 模块
 */

// 导出类型定义
export * from './types'

// 导出通用 API
export * as authApi from './common/auth'

// 导出教师端 API
export * as teacherApi from './teacher'

// 导出学生端 API
export * as studentApi from './student'

// 导出管理员端 API
export * as adminApi from './admin'
