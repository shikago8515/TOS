import { request } from '@/utils/request'

/**
 * 获取检查点详情
 */
export function getCheckpoint(checkpointId) {
  return request.get(`/workflow/checkpoints/${checkpointId}`)
}

/**
 * 获取工作流的所有检查点
 */
export function getWorkflowCheckpoints(workflowInstanceId) {
  return request.get(`/workflow/checkpoints/workflow/${workflowInstanceId}`)
}

/**
 * 获取工作流的待处理检查点
 */
export function getPendingCheckpoint(workflowInstanceId) {
  return request.get(`/workflow/checkpoints/workflow/${workflowInstanceId}/pending`)
}

/**
 * 批准检查点
 */
export function approveCheckpoint(checkpointId) {
  return request.post(`/workflow/checkpoints/${checkpointId}/approve`)
}

/**
 * 拒绝检查点
 */
export function rejectCheckpoint(checkpointId, reason) {
  return request.post(`/workflow/checkpoints/${checkpointId}/reject`, { reason })
}

/**
 * 修改内容后继续
 */
export function modifyAndContinue(checkpointId, modifiedContent) {
  return request.post(`/workflow/checkpoints/${checkpointId}/modify`, modifiedContent)
}

/**
 * 调整参数后重试
 */
export function adjustParamsAndRetry(checkpointId, adjustedParams) {
  return request.post(`/workflow/checkpoints/${checkpointId}/adjust-params`, adjustedParams)
}

/**
 * 取消工作流
 */
export function cancelWorkflowAtCheckpoint(checkpointId) {
  return request.post(`/workflow/checkpoints/${checkpointId}/cancel`)
}
