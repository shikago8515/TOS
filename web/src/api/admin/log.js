import { request } from '@/utils/request'

// 获取操作日志列表
export function getOperationLogs(params) {
  return request.get('/admin/logs', { params })
}

// 导出操作日志
export function exportOperationLogs(params) {
  return request.get('/admin/logs/export', { 
    params,
    responseType: 'blob'
  })
}
