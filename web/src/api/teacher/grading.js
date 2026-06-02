import request from '@/utils/request'

// 获取AI评分结果（按任务ID，返回最新的）
export function getAiGradingResult(taskId) {
  return request({
    url: `/grading/task/${taskId}/ai-result`,
    method: 'get'
  })
}

// 获取AI评分过程快照（教师端）
export function getAiGradingProcess(taskId) {
  return request({
    url: `/grading/task/${taskId}/ai-process`,
    method: 'get'
  })
}

// 获取AI评分结果（按提交ID，返回该提交的独立评分）
export function getAiGradingResultBySubmission(submissionId) {
  return request({
    url: `/grading/submission/${submissionId}/ai-result`,
    method: 'get'
  })
}

// 修改评分细则
export function updateGradingDetail(detailId, data) {
  return request({
    url: `/grading/detail/${detailId}`,
    method: 'put',
    data
  })
}

// 确认最终评分
export function confirmGrading(taskId, data) {
  return request({
    url: `/grading/task/${taskId}/confirm`,
    method: 'post',
    data
  })
}

// 重新AI评分
export function reGradeTask(taskId) {
  return request({
    url: `/grading/task/${taskId}/re-grade`,
    method: 'post'
  })
}

// 批量确认评分
export function batchConfirmGrading(data) {
  return request({
    url: '/grading/batch-confirm',
    method: 'post',
    data
  })
}

// 获取提交评分进度快照（轮询兜底）
export function getGradingProgressState(submissionId) {
  return request({
    url: `/grading/submission/${submissionId}/progress-state`,
    method: 'get'
  })
}
