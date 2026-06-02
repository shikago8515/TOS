import { request } from '@/utils/request'

/**
 * 学生端 - 任务管理 API
 */

// 获取我的任务列表
export function getMyTasks() {
  return request.get('/training/tasks/my')
}

// 获取我的任务统计
export function getMyTaskStats() {
  return request.get('/training/tasks/my/stats')
}

// 获取任务详情
export function getTaskDetail(taskId) {
  return request.get(`/training/tasks/${taskId}`)
}

// 开始任务
export function startTask(taskId) {
  return request.put(`/training/tasks/${taskId}/start`)
}

// 提交任务
export function submitTask(taskId) {
  return request.put(`/training/tasks/${taskId}/submit`)
}

// MCP评测提交（不上传文件）
export function submitMcpAssessment(data) {
  return request.post('/training/submissions/mcp-assess', data)
}

// 分析任务专用提交评分（Diagram Agent + 工作流上下文链路）
export function submitNonCodeTask(data) {
  return request.post('/training/non-code/submissions/submit-and-score', data)
}

// 通用在线提交（支持代码任务手动ZIP提交）
export function submitOnlineSubmission(data) {
  return request.post('/training/submissions/online-submit', data)
}

// 保存在线提交草稿（服务端持久化）
export function saveOnlineSubmissionDraft(data) {
  return request.post('/training/submissions/online-draft', data)
}

// 获取在线提交草稿
export function getOnlineSubmissionDraft(taskId) {
  return request.get(`/training/submissions/online-draft/${taskId}`)
}

// 删除在线提交草稿
export function deleteOnlineSubmissionDraft(taskId) {
  return request.delete(`/training/submissions/online-draft/${taskId}`)
}

// 分析任务附件上传（真实文件上传）
export function uploadNonCodeAttachment(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/training/non-code/submissions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  })
}

// 项目快照提交（一次提交，后台拆分多任务评测）
export function submitProjectSnapshot(data) {
  return request.post('/training/submissions/project-snapshot', data)
}

// 获取单次项目快照评测矩阵（用于一键提交后的状态轮询）
export function getProjectSnapshotMatrixByBundle(bundleId) {
  return request.get(`/training/submissions/project-snapshot/matrix/${bundleId}`)
}

// 获取任务的提交记录
export function getTaskSubmissions(taskId) {
  return request.get(`/training/submissions/task/${taskId}`)
}

// 获取提交详情
export function getSubmissionDetail(submissionId) {
  return request.get(`/training/submissions/${submissionId}`)
}

// 下载提交对应的完整源码压缩包
export function getSubmissionSourceArchive(submissionId) {
  return request.get(`/training/submissions/${submissionId}/source-archive`, {
    responseType: 'blob'
  })
}

// 获取验收结果
export function getValidationResult(submissionId) {
  return request.get(`/training/validations/${submissionId}`)
}

// 结构化即时验证（ER/UML/图表/SQL）
export function validateStructuredArtifact(data) {
  return request.post('/training/validations/structured/validate', data)
}

// 记录学习过程事件
export function recordLearningProcess(data) {
  return request.post('/training/learning-process/record', data)
}

// 获取任务评分（学生端主链路：task_evaluation）
export function getTaskScore(taskId) {
  return request.get(`/training/submissions/task/${taskId}/score`)
}

// 获取我的评分列表
export function getMyGradings() {
  return request.get('/grading/my')
}

// 获取任务的验收结果
export function getSubmissionValidation(submissionId) {
  return request.get(`/training/validations/${submissionId}`)
}

// 获取我的提交列表
export function getMySubmissions() {
  return request.get('/training/submissions/mine')
}

// 获取任务的最新一次提交（兼容页面只需要一个 submission 的场景）
export async function getTaskSubmission(taskId) {
  const res = await getTaskSubmissions(taskId)
  const list = res?.data || []
  if (!Array.isArray(list) || list.length === 0) {
    return { code: res?.code || 200, message: res?.message, data: null }
  }
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.submissionTime || 0).getTime()
    const tb = new Date(b.submissionTime || 0).getTime()
    return tb - ta
  })
  return { code: res?.code || 200, message: res?.message, data: sorted[0] }
}

// ========== 任务池功能（学生自主领取） ==========

// 获取已发布的案例列表（任务池）
export function getPublishedCases() {
  return request.get('/training/cases/published')
}

// 获取案例详情
export function getCaseDetail(caseId) {
  return request.get(`/training/cases/${caseId}`)
}

// 学生领取任务
export function claimTask(data) {
  return request.post('/training/tasks/claim', data)
}

// 检查是否已领取某案例
export function checkClaimed(caseId) {
  return request.get(`/training/tasks/check-claimed/${caseId}`)
}

// 获取案例排行榜（公共案例）
export function getCaseLeaderboard(caseId) {
  return request.get(`/training/cases/${caseId}/leaderboard`)
}

// 删除提交记录
export function deleteSubmission(submissionId) {
  return request.delete(`/training/submissions/${submissionId}`)
}
