import { request } from '@/utils/request'

/**
 * 管理员端 - 系统监控 API
 */

// 获取工作流上下文缓存统计
export function getWorkflowRuntimeCacheStats() {
  return request.get('/admin/monitor/workflow-context-cache')
}

// 获取服务器运行状态
export function getServerRuntimeStatus() {
  return request.get('/admin/monitor/server')
}
