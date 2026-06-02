import { request } from '@/utils/request'

/**
 * 教师端 - 案例管理 API
 */

// 生成案例
export function generateCase(data) {
  return request.post('/training/cases/generate', data)
}

// 生成非代码分析案例（独立链路）
export function generateNonCodeCase(data) {
  return request.post('/training/non-code/cases/generate', data)
}

// 识别非代码输入意图（实现型实验 / 纯分析）
export function detectNonCodeIntent(data) {
  return request.post('/training/non-code/cases/intent-detect', data)
}

// 查询生成进度
export function getTaskStatus(taskId) {
  return request.get(`/training/cases/task/${taskId}`)
}

// 查询非代码分析案例生成进度（独立链路）
export function getNonCodeTaskStatus(taskId) {
  return request.get(`/training/non-code/cases/task/${taskId}`)
}

// 批量为班级学生生成案例
export function generateCasesForClass(data) {
  return request.post('/training/cases/batch/generate', data)
}

// 批量生成非代码分析案例（独立链路）
export function generateNonCodeCasesForClass(data) {
  return request.post('/training/non-code/cases/batch/generate', data)
}

// 查询批量生成进度
export function getBatchTaskStatus(batchTaskId) {
  return request.get(`/training/cases/batch/task/${batchTaskId}`)
}

// 查询非代码分析案例批量进度（独立链路）
export function getNonCodeBatchTaskStatus(batchTaskId) {
  return request.get(`/training/non-code/cases/batch/task/${batchTaskId}`)
}

// 获取教师案例列表
export function getTeacherCaseList(params) {
  return request.get('/training/cases', { params })
}

// 获取案例详情
export function getCaseDetail(caseId) {
  return request.get(`/training/cases/${caseId}`)
}

// 获取已发布案例列表
export function getPublishedCases() {
  return request.get('/training/cases/published')
}

// 发布案例
export function publishCase(caseId) {
  return request.put(`/training/cases/${caseId}/publish`)
}

// 删除案例
export function deleteCase(caseId) {
  return request.delete(`/training/cases/${caseId}`)
}

// 更新案例（教师二次编辑）
export function updateCase(caseId, data) {
  return request.put(`/training/cases/${caseId}`, data)
}

// 获取案例分配统计（包含学生列表、得分、排名）
export function getCaseAssignmentStats(caseId) {
  return request.get(`/training/cases/${caseId}/assignments`)
}

// 获取案例排行榜（仅公共案例）
export function getCaseLeaderboard(caseId) {
  return request.get(`/training/cases/${caseId}/leaderboard`)
}

// 获取所有待审核案例
export function getAllPendingCases() {
  return request.get('/training/cases/pending')
}

// 获取批量任务的待审核案例列表
export function getPendingCases(batchTaskId) {
  return request.get(`/training/cases/batch/${batchTaskId}/pending`)
}

// 审核通过案例
export function approveCase(caseId, publish = false) {
  return request.put(`/training/cases/${caseId}/approve?publish=${publish}`)
}

// 批量审核通过案例
export function batchApproveCases(caseIds, publish = false) {
  return request.put(`/training/cases/batch/approve?publish=${publish}`, caseIds)
}

// 重新生成案例
export function regenerateCase(caseId) {
  return request.post(`/training/cases/${caseId}/regenerate`, null, {
    timeout: 120000  // LLM生成需要较长时间，设置2分钟超时
  })
}

// 批量发布案例
export function batchPublishCases(caseIds) {
  return request.put('/training/cases/batch/publish', caseIds)
}

// 撤回案例（将已发布但未被分配/领取的案例撤回到草稿状态）
export function withdrawCase(caseId) {
  return request.put(`/training/cases/${caseId}/withdraw`)
}

// 批量撤回案例
export function batchWithdrawCases(caseIds) {
  return request.put('/training/cases/batch/withdraw', caseIds)
}

// 批量生成案例并自动分配
export function generateAndAssignCases(data) {
  return request.post('/training/cases/batch/generate-and-assign', data)
}

// 工作流模式案例生成 

/**
 * 工作流模式生成案例（Agent Workflow）
 * @param {Object} data - 生成参数
 * @returns {Promise} 返回工作流实例ID
 */
export function generateCaseWithWorkflow(data) {
  return request.post('/teacher/workflow/cases/generate', data, {
    timeout: 300000 // 工作流可能需要较长时间，设置5分钟超时
  })
}

/**
 * 单案例模式下批量生成公共案例
 * @param {Object} data - 生成参数（numVersions 表示生成数量）
 * @returns {Promise} 返回批量任务ID
 */
export function generatePublicCasesWithWorkflowBatch(data) {
  return request.post('/teacher/workflow/cases/generate/public-batch', data, {
    timeout: 300000
  })
}

/**
 * 查询工作流进度
 * @param {Number} workflowInstanceId - 工作流实例ID
 * @returns {Promise} 返回进度信息
 */
export function getWorkflowProgress(workflowInstanceId, options = {}) {
  const { includeLogs = true } = options
  return request.get(`/teacher/workflow/cases/${workflowInstanceId}/progress`, {
    params: { includeLogs }
  })
}

/** * 获取批量工作流生成进度
 * @param {String} batchTaskId - 批量任务ID
 * @returns {Promise} 返回批量进度信息
 */
export function getBatchWorkflowProgress(batchTaskId) {
  return request.get(`/teacher/workflow/cases/batch/${batchTaskId}/progress`)
}

/** * 获取工作流生成的案例
 * @param {Number} workflowInstanceId - 工作流实例ID
 * @returns {Promise} 返回案例详情
 */
export function getWorkflowCase(workflowInstanceId) {
  return request.get(`/teacher/workflow/cases/${workflowInstanceId}/case`)
}

/**
 * 取消工作流执行
 * @param {Number} workflowInstanceId - 工作流实例ID
 * @returns {Promise}
 */
export function cancelWorkflow(workflowInstanceId) {
  return request.post(`/teacher/workflow/cases/${workflowInstanceId}/cancel`)
}

/**
 * 教师批准并继续工作流（人工检查点）
 * @param {Number} workflowInstanceId - 工作流实例ID
 * @param {Object} originalRequest - 原始生成请求参数
 * @returns {Promise} 批准结果
 */
export function approveWorkflowCheckpoint(workflowInstanceId, originalRequest) {
  return request.post(`/workflow/${workflowInstanceId}/approve`, originalRequest)
}

/**
 * 拒绝并重试当前Agent（人工检查点）
 * @param {Number} workflowInstanceId - 工作流实例ID
 * @returns {Promise} 重试结果
 */
export function retryWorkflowAgent(workflowInstanceId) {
  return request.post(`/workflow/${workflowInstanceId}/retry`)
}

/**
 * 批量工作流生成案例（千人千案）
 * @param {Object} data - 批量生成参数（包含studentIds数组）
 * @returns {Promise} 返回批量任务ID
 */
export function generateCasesWithWorkflowBatch(data) {
  return request.post('/teacher/workflow/cases/batch/generate', data, {
    timeout: 300000 // 批量工作流可能需要较长时间
  })
}

/**
 * 查询批量工作流进度
 * @param {String} batchTaskId - 批量任务ID
 * @returns {Promise} 返回批量进度信息
 */

// ==================== 工作流模板管理 ====================

/**
 * 保存工作流模板（前端设计器保存）
 * @param {Object} data - { name, description, structure }
 * @returns {Promise}
 */
export function saveWorkflowTemplate(data) {
  return request.post('/teacher/workflow/templates', data)
}

/**
 * 获取工作流模板
 * @param {Number} templateId - 模板ID
 * @returns {Promise}
 */
export function getWorkflowTemplate(templateId) {
  return request.get(`/teacher/workflow/templates/${templateId}`)
}

/**
 * 获取我的所有工作流模板
 * @returns {Promise}
 */
export function getMyWorkflowTemplates() {
  return request.get('/teacher/workflow/templates/my')
}

/**
 * 更新工作流模板
 * @param {Number} templateId - 模板ID
 * @param {Object} data - { name, description, structure, isActive }
 * @returns {Promise}
 */
export function updateWorkflowTemplate(templateId, data) {
  return request.put(`/teacher/workflow/templates/${templateId}`, data)
}

/**
 * 删除工作流模板
 * @param {Number} templateId - 模板ID
 * @returns {Promise}
 */
export function deleteWorkflowTemplate(templateId) {
  return request.delete(`/teacher/workflow/templates/${templateId}`)
}

/**
 * 执行工作流模板
 * @param {Number} templateId - 模板ID
 * @param {Object} initialInput - 初始输入参数
 * @returns {Promise}
 */
export function executeWorkflowTemplate(templateId, initialInput) {
  return request.post(`/teacher/workflow/templates/${templateId}/execute`, {
    templateId,
    initialInput,
    isTest: false
  })
}

/**
 * 测试运行工作流（会创建临时运行实例用于进度展示）
 * @param {Object} structure - 工作流结构 { nodes, connections }
 * @param {Object} initialInput - 初始输入参数
 * @returns {Promise}
 */
export function testRunWorkflow(structure, initialInput) {
  return request.post('/teacher/workflow/templates/test-run', {
    structure,
    initialInput
  })
}

/**
 * 获取工作流执行状态
 * @param {Number} instanceId - 工作流实例ID
 * @returns {Promise}
 */
export function getWorkflowExecutionStatus(instanceId) {
  return request.get(`/teacher/workflow/templates/instances/${instanceId}/status`)
}

// ==================== 预定义模板 API ====================

/**
 * 获取预定义模板列表（完整实训案例、纯编码任务）
 * @returns {Promise}
 */
export function getPredefinedTemplates() {
  return request.get('/teacher/workflow/templates/predefined')
}

/**
 * 根据类型获取预定义模板
 * @param {String} type - 模板类型 (FULL_PRACTICE, PURE_CODING)
 * @returns {Promise}
 */
export function getPredefinedTemplate(type) {
  return request.get(`/teacher/workflow/templates/predefined/${type}`)
}

/**
 * 从预定义模板创建用户模板
 * @param {String} type - 模板类型 (FULL_PRACTICE, PURE_CODING)
 * @returns {Promise}
 */
export function createFromPredefinedTemplate(type) {
  return request.post(`/teacher/workflow/templates/predefined/${type}/create`)
}

/**
 * 复制现有模板
 * @param {Number} templateId - 源模板ID
 * @param {String} newName - 新模板名称
 * @returns {Promise}
 */
export function duplicateWorkflowTemplate(templateId, newName) {
  return request.post(`/teacher/workflow/templates/${templateId}/duplicate`, {
    newName
  })
}

/**
 * 验证工作流定义
 * @param {Object} structure - 工作流结构
 * @param {Boolean} strictMode - 严格模式
 * @returns {Promise}
 */
export function validateWorkflow(structure, strictMode = false) {
  return request.post('/teacher/workflow/templates/validate', {
    structure,
    strictMode
  })
}

/**
 * 根据案例类型和难度获取工作流模板
 * @param {String} caseType - 案例模式 (FULL_PRACTICE=完整实训案例, PURE_CODING=纯编码任务)
 * @param {String} difficultyLevel - 难度级别 (EASY=初级, MEDIUM=中级, HARD=高级)
 * @returns {Promise}
 */
export function getWorkflowByCaseDifficulty(caseType, difficultyLevel) {
  return request.get('/teacher/workflow/templates/by-case-difficulty', {
    params: { caseType, difficultyLevel }
  })
}

/**
 * 保存指定案例类型和难度的工作流模板
 * @param {String} caseType - 案例类型
 * @param {String} difficultyLevel - 难度级别
 * @param {String} name - 模板名称
 * @param {String} description - 模板描述
 * @param {Object} structure - 工作流结构
 * @returns {Promise}
 */
export function saveWorkflowForCaseDifficulty(caseType, difficultyLevel, name, description, structure) {
  return request.post('/teacher/workflow/templates/save-for-case-difficulty', {
    caseType,
    difficultyLevel,
    name,
    description,
    structure
  })
}

// AI辅助功能 

/**
 * AI辅助生成工作流节点Prompt
 * @param {String} taskDescription - 任务描述
 * @param {String} inputDescription - 输入内容描述
 * @param {String} outputFormat - 输出格式 (JSON/TEXT/MARKDOWN)
 * @param {String} nodeType - 节点类型 (Agent/Gateway/Condition)
 * @param {Array} existingNodes - 已有节点信息（用于变量引用）
 * @returns {Promise} 返回生成的Prompt和建议
 */
export function generatePromptByAi(taskDescription, inputDescription, outputFormat, nodeType, existingNodes) {
  return request.post('/teacher/workflow/ai/generate-prompt', {
    taskDescription,
    inputDescription,
    outputFormat,
    nodeType,
    existingNodes
  }, { timeout: 120000 }) // AI生成需要较长时间，超时设为120秒
}

// ==================== 案例资源库复用 ====================

/**
 * 复制案例（深拷贝为草稿，支持二次编辑后重新发布）
 * @param {Number} caseId
 */
export function copyCase(caseId) {
  return request.post(`/training/cases/${caseId}/copy`)
}

export function getCaseResourceOverview() {
  return request.get('/training/cases/resources/overview')
}

export function getFeaturedCases(params = {}) {
  return request.get('/training/cases/resources/featured', { params })
}

export function getCaseReuseStats(params = {}) {
  return request.get('/training/cases/resources/reuse', { params })
}

/**
 * 设置案例可见范围
 * @param {Number} caseId
 * @param {Number} visibility  0-仅自己  1-指定班级  2-全体公开
 */
export function setCaseVisibility(caseId, visibility) {
  if (typeof visibility === 'object') {
    return request.put(`/training/cases/${caseId}/visibility`, visibility)
  }
  return request.put(`/training/cases/${caseId}/visibility`, { visibility })
}

/**
 * 教师对案例质量评分（三维度 1-5 星）
 * @param {Number} caseId
 * @param {{ storyScore, taskCoverageScore, datasetScore, comment }} data
 */
export function rateCase(caseId, data) {
  return request.post(`/training/cases/${caseId}/rate`, data)
}

/**
 * 获取AI服务配置信息
 * @returns {Promise} 返回AI服务配置
 */
export function getAiConfig() {
  return request.get('/teacher/workflow/ai/config')
}

/**
 * 验证 Prompt 格式和内容
 * @param {String} prompt - Prompt 内容
 * @param {String} agentType - Agent 类型
 * @returns {Promise} 返回验证结果
 */
export function validatePrompt(prompt, agentType) {
  return request.post('/teacher/workflow/ai/validate-prompt', {
    prompt,
    agentType
  })
}

/**
 * 测试 Prompt 执行
 * @param {String} prompt - Prompt 内容
 * @param {String} agentType - Agent 类型
 * @param {Object} testData - 测试数据（用于变量替换）
 * @returns {Promise} 返回测试执行结果
 */
export function testPromptExecution(prompt, agentType, testData) {
  return request.post('/teacher/workflow/ai/test-prompt', {
    prompt,
    agentType,
    testData
  })
}
