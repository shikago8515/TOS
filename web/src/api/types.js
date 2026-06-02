/**
 * API 响应基础类型
 * @template T
 * @typedef {Object} ApiResponse
 * @property {number} code
 * @property {string} message
 * @property {T} data
 */

/**
 * 分页响应类型
 * @template T
 * @typedef {Object} PageResponse
 * @property {T[]} list
 * @property {number} total
 * @property {number} page
 * @property {number} size
 */

/**
 * 用户类型
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} [email]
 * @property {string} [realName]
 * @property {number} roleId
 * @property {string} [roleName]
 * @property {string} [department]
 * @property {number} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 角色类型
 * @typedef {Object} Role
 * @property {number} id
 * @property {string} roleName
 * @property {string} [description]
 */

/**
 * 案例生成请求
 * @typedef {Object} CaseGenerationRequest
 * @property {string} keywords
 * @property {number} difficultyLevel
 * @property {number} estimatedHours
 * @property {number} [courseId]
 * @property {number} [numVersions]
 */

/**
 * 案例生成响应
 * @typedef {Object} CaseGenerationResponse
 * @property {number} caseId
 * @property {string} caseName
 * @property {string} backgroundStory
 * @property {string} taskList
 * @property {string} mockDataPreview
 * @property {string} llmModel
 * @property {number} generationTimeMs
 * @property {number} cost
 * @property {string} createdAt
 */

/**
 * 实训案例
 * @typedef {Object} TrainingCase
 * @property {number} id
 * @property {string} caseName
 * @property {string} [description]
 * @property {string} keywords
 * @property {string} backgroundStory
 * @property {string} taskList
 * @property {string} mockData
 * @property {string} [expectedOutput]
 * @property {number} difficultyLevel
 * @property {number} estimatedHours
 * @property {number} teacherId
 * @property {number} [courseId]
 * @property {number} status
 * @property {number} type - 0-公共案例, 1-个性化案例
 * @property {string} [llmModel]
 * @property {string} [llmPrompt]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 实训任务
 * @typedef {Object} TrainingTask
 * @property {number} id
 * @property {number} caseId
 * @property {string} [caseName]
 * @property {number} studentId
 * @property {string} [studentName]
 * @property {string} [studentNumber]
 * @property {number} [variantSeed]
 * @property {number} [taskSequence]
 * @property {string} taskDescription
 * @property {string} [taskRequirements]
 * @property {string} [sampleData]
 * @property {string} [instanceData]
 * @property {number} status
 * @property {number} [source] - 任务来源：1-教师分配, 2-学生自领
 * @property {string} [submissionType] - 提交类型: code_folder, code_file, image, document, excel, any
 * @property {string} [allowedExtensions] - 允许的文件扩展名，JSON数组格式
 * @property {string} [startTime]
 * @property {string} [submitTime]
 * @property {string} [deadline]
 * @property {string} [caseCategory]
 * @property {string} [publishTime]
 * @property {string} [publishClassName]
 * @property {string} [teacherName]
 * @property {string} [caseMode] - FULL_PRACTICE=完整实训案例, PURE_CODING=纯编码实战
 * @property {string} [caseModeLabel]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 任务分配请求
 * @typedef {Object} TaskAssignRequest
 * @property {number} caseId
 * @property {number[]} studentIds
 * @property {string} deadline
 */

/**
 * 学生提交
 * @typedef {Object} StudentSubmission
 * @property {number} id
 * @property {number} taskId
 * @property {number} studentId
 * @property {string} submissionType
 * @property {string} [filePath]
 * @property {string} [fileName]
 * @property {number} [fileSize]
 * @property {string} [fileType]
 * @property {string} [contentPreview]
 * @property {string} submissionTime
 * @property {number} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 提交请求
 * @typedef {Object} SubmissionRequest
 * @property {number} taskId
 * @property {string} submissionType
 * @property {File} [file]
 */

/**
 * 验证项
 * @typedef {Object} ValidationItem
 * @property {string} validationType
 * @property {string} description
 * @property {boolean} isPassed
 * @property {number} score
 * @property {number} maxScore
 * @property {string} [errorMessage]
 */

/**
 * 验收结果
 * @typedef {Object} ValidationResponse
 * @property {number} submissionId
 * @property {string} validationStatus
 * @property {number} totalScore
 * @property {number} maxScore
 * @property {ValidationItem[]} validationItems
 * @property {string} [feedback]
 */

/**
 * 评分记录
 * @typedef {Object} GradingRecord
 * @property {number} id
 * @property {number} taskId
 * @property {number} studentId
 * @property {number} totalScore
 * @property {number} maxScore
 * @property {number} autoScore
 * @property {number} manualScore
 * @property {number} [teacherId]
 * @property {string} [feedback]
 * @property {string} [gradingTime]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 登录请求
 * @typedef {Object} LoginRequest
 * @property {string} username
 * @property {string} password
 */

/**
 * 登录响应
 * @typedef {Object} LoginResponse
 * @property {string} token
 * @property {User} user
 */

export const Types = {}
