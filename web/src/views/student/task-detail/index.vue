<template>
  <div class="task-detail-container" v-loading="loading">
    <TaskHeader 
      :task="task" 
      @back="handleGoBack" 
    />

    <div class="main-content" v-if="task">
      <!-- Dataset Trigger Bar -->
      <div class="dataset-bar" v-if="task.instanceData">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="dataset-alert"
        >
          <template #title>
            <div class="alert-content">
              <span>本任务包含实训数据集，请先查看并导入数据。</span>
              <el-button type="primary" link @click="showDataDialog = true">
                查看数据集详情
              </el-button>
            </div>
          </template>
        </el-alert>
      </div>

      <el-row :gutter="24">
        <!-- Left Column: Guide + Task Details -->
        <el-col :xs="24" :lg="16" :xl="17">
          <div class="left-column-stack">
            <TaskGuide
              :current-step="currentStep"
              :step-hints="stepHints"
              :guide-items="guideItems"
            />

            <div class="task-content-card">
              <TaskInfo :task="task" :hide-task-detail-content="isFullPracticeTask" />
              <TaskApiExamples v-if="!isFullPracticeTask" :task="task" />
            </div>
          </div>
        </el-col>

        <!-- Right Column: Submission & History (Sticky) -->
        <el-col :xs="24" :lg="8" :xl="7">
          <div class="sticky-sidebar">
            <TaskSubmission 
              :task="task"
              :case-mode="currentCaseMode"
              :case-mode-label="currentCaseModeLabel"
              :is-task-passed="isTaskPassed"
              :latest-submission="latestSubmission"
              :need-resubmit="needResubmit"
              :mcp-assessing="mcpAssessing"
              :mcp-status-text="mcpStatusText"
              :grading-in-progress="gradingInProgress"
              :grading-progress-percent="gradingProgressPercent"
              :grading-progress-message="gradingProgressMessage"
              :grading-progress-status="gradingProgressStatus"
              :grading-progress-steps="gradingProgressSteps"
              :progress-panel-visible="progressPanelVisible"
              @start-assessment="startMcpAssessment"
              @dependency-guide="dependencyGuideVisible = true"
              @close-progress="closeProgressPanel"
              @open-progress="openProgressPanel"
            />

            <TaskHistory 
              :submissions="submissions" 
              :grading-result="gradingResult"
              :active-progress-submission-id="activeProgressSubmissionId"
              :case-mode="currentCaseMode"
              @view-report="handleViewValidation"
              @delete-submission="handleDeleteSubmission"
            />
          </div>
        </el-col>
      </el-row>
    </div>
    
    <div v-else class="skeleton-wrapper">
      <el-skeleton :rows="3" animated class="mb-4" />
      <el-row :gutter="24">
        <el-col :span="16"><el-skeleton :rows="10" animated /></el-col>
        <el-col :span="8"><el-skeleton :rows="6" animated /></el-col>
      </el-row>
    </div>

    <!-- Dialogs -->
    <TaskDependencyGuide 
      v-model:visible="dependencyGuideVisible" 
    />
    
    <TaskResultDialog 
      v-model:visible="resultDialogVisible"
      :loading="resultLoading"
      :error="resultError"
      :is-grading="isGrading(currentSubmission)"
      :grading-progress-percent="gradingProgressPercent"
      :grading-progress-status="gradingProgressStatus"
      :grading-progress-message="gradingProgressMessage"
      :grading-progress-steps="gradingProgressSteps"
      :validation="validation"
      :dialog-grading-result="dialogGradingResult"
      :task-name="task?.taskDescription"
      :file-name="currentSubmission?.fileName"
      :display-score="displayScore"
    />

    <!-- Dataset Dialog -->
    <el-dialog
      v-model="showDataDialog"
      title="实训数据集"
      width="80%"
      top="5%"
      :teleported="false"
      destroy-on-close
      append-to-body
    >
      <TaskData :task="task" @dataset-exported="handleDatasetExported" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

// Components
import TaskHeader from './components/TaskHeader.vue'
import TaskInfo from './components/TaskInfo.vue'
import TaskData from './components/TaskData.vue'
import TaskApiExamples from './components/TaskApiExamples.vue'
import TaskGuide from './components/TaskGuide.vue'
import TaskSubmission from './components/TaskSubmission.vue'
import TaskHistory from './components/TaskHistory.vue'
import TaskDependencyGuide from './components/TaskDependencyGuide.vue'
import TaskResultDialog from './components/TaskResultDialog.vue'

// API
// @ts-ignore
import { getTaskSubmissions, getTaskDetail, getValidationResult, deleteSubmission, submitMcpAssessment, submitNonCodeTask, submitOnlineSubmission, getTaskScore, validateStructuredArtifact, recordLearningProcess } from '@/api/student/task'
// @ts-ignore
import { getGradingProgressState } from '@/api/teacher/grading'
import { getAuthToken } from '@/utils/authStorage.js'
import { getStudentTaskCaseModeLabel, isFullPracticeCase, isPureCodingCase } from '@/utils/studentTaskMode'

const router = useRouter()
const route = useRoute()

// State
const loading = ref(false)
const showDataDialog = ref(false)
const task = ref<any>(null)
const submissions = ref<any[]>([])
const taskId = ref(route.params.id)
const mcpAssessing = ref(false)
const mcpStatusText = ref('')
const dependencyGuideVisible = ref(false)
const datasetDownloaded = ref(false)
const taskViewRecorded = ref(false)
const MCP_BASE_URL_KEY = 'mcpProbeBaseUrl'
const PROGRESS_SUBMISSION_KEY_PREFIX = 'taskDetailActiveSubmission:'
const DATASET_DOWNLOADED_KEY_PREFIX = 'taskDetailDatasetDownloaded:'

// Result Dialog State
const resultDialogVisible = ref(false)
const resultLoading = ref(false)
const resultError = ref('')
const currentSubmission = ref<any>(null)
const validation = ref<any>(null)
const gradingResult = ref<any>(null)
const dialogGradingResult = ref<any>(null)

// SSE State
let gradingProgressEventSource: EventSource | null = null
let gradingPollingTimer: number | null = null
const gradingProgressMessage = ref('')
const gradingProgressPercent = ref(0)
const gradingProgressRawStatus = ref('')
const gradingProgressSteps = ref<any[]>([])
const activeProgressSubmissionId = ref<number | null>(null)
const progressPanelVisible = ref(false)

// Computed
const displayScore = computed(() => {
  if (isGrading(currentSubmission.value)) {
    return null
  }

  if (dialogGradingResult.value?.details?.length > 0) {
    const total = dialogGradingResult.value.details.reduce((sum: number, item: any) => {
      return sum + (item.finalScore || item.aiScore || 0)
    }, 0)
    return Math.round(total)
  }
  
  if (dialogGradingResult.value?.totalScore != null) {
    return Math.round(dialogGradingResult.value.totalScore)
  }
  
  if (currentSubmission.value?.score != null && Number(currentSubmission.value?.status) !== 2) {
    return Math.round(currentSubmission.value.score)
  }
  
  return null
})

const isTaskPassed = computed(() => {
  return task.value?.status === 3
})

const needResubmit = computed(() => {
  if (!task.value) return false
  return task.value.status === 4 || task.value.status === 5
})

const latestSubmission = computed(() => {
  if (submissions.value.length === 0) return null
  return submissions.value[0]
})

const currentCaseMode = computed(() => {
  return task.value?.caseMode || (isPureCodingCase(task.value) ? 'PURE_CODING' : 'FULL_PRACTICE')
})

const currentCaseModeLabel = computed(() => getStudentTaskCaseModeLabel(task.value))

const isFullPracticeTask = computed(() => isFullPracticeCase(task.value))

const getDatasetDownloadedStorageKey = () => `${DATASET_DOWNLOADED_KEY_PREFIX}${taskId.value}`

const restoreDatasetDownloaded = () => {
  const stored = localStorage.getItem(getDatasetDownloadedStorageKey())
  datasetDownloaded.value = stored === '1'
}

const handleDatasetExported = () => {
  datasetDownloaded.value = true
  localStorage.setItem(getDatasetDownloadedStorageKey(), '1')
  void recordLearningEvent({
    caseId: task.value?.caseId,
    taskId: Number(taskId.value),
    actionType: 'dataset_export',
    actionLabel: '导出实训数据集',
    sourcePage: 'student-task-detail'
  })
}

const currentStep = computed(() => {
  if (isTaskPassed.value) return 4 // Completed
  if (submissions.value.length > 0) return 3 // Submitted
  if (task.value?.instanceData) {
    return datasetDownloaded.value ? 2 : 1 // Data downloaded => move to dev step
  }
  return 0 // Reading
})

const NON_CODE_SUBMISSION_TYPES = ['document', 'excel', 'image', 'any', 'online', 'report', 'non_code']
const isNonCodeSubmissionType = (type) => {
  const t = String(type || '').toLowerCase()
  return NON_CODE_SUBMISSION_TYPES.some(k => t.includes(k)) || (!!t && !t.startsWith('code'))
}

const stepHints = computed(() => {
  const submissionType = String(task.value?.submissionType || '').toLowerCase()
  const isOnlineType = isNonCodeSubmissionType(submissionType)

  if (isFullPracticeTask.value) {
    return [
      '先阅读案例背景、实施流程与验收标准，明确本次完整实训最终只提交实验报告和源码压缩包',
      '按完整项目流程完成设计、开发、联调与运行验证，把过程产出整理为最终成果材料',
      '整理最终交付包：设计图、图表、运行截图纳入实验报告，SQL脚本与项目代码一并放入源码压缩包',
      '一次提交最终成果后，系统将统一执行自动校验、AI评分与教师审核，不再按阶段分别提交'
    ]
  }

  if (isOnlineType) {
    return [
      '仔细阅读任务描述和要求，明确实验目标与交付标准',
      '准备实验报告内容：实验目的、实验要求、运行截图+核心源码、结果分析',
      '按需补充附件（报告文档/图表图片/压缩包）并确保可访问',
      '点击“提交并启动评分”，系统将自动解析文档并评分'
    ]
  }

  return [
    '仔细阅读任务描述和要求，理解需要完成的内容',
    '在任务详情中的“实训数据集（父任务）”先导入建库脚本，再开始编码',
    '在本地 IDE 中完成开发，将数据导入数据库进行测试',
    '启动本地项目并点击“MCP评测”，系统会自动抓取源码并评分'
  ]
})

const hasReadTask = computed(() => {
  return !!task.value
})

const guideItems = computed(() => {
  if (isFullPracticeTask.value) {
    const hasSubmission = submissions.value.length > 0
    return [
      {
        title: '明确案例目标与最终交付',
        desc: '确认业务背景、实施流程、最终材料清单和评分关注点。',
        done: hasReadTask.value || hasSubmission || isTaskPassed.value
      },
      {
        title: '完成项目实现与联调验证',
        desc: '围绕完整案例完成设计、开发、联调和运行验证，确保项目可展示、可说明。',
        done: !task.value?.instanceData || datasetDownloaded.value || hasSubmission || isTaskPassed.value
      },
      {
        title: '整理最终成果材料',
        desc: '将设计图、图表、截图整理进实验报告，把 SQL 脚本与源码统一归档到压缩包中。',
        done: hasSubmission || isTaskPassed.value
      },
      {
        title: '提交最终成果并查看评分进度',
        desc: '一次提交后进入统一评分流程，按结果反馈决定是否需要再次完善。',
        done: isTaskPassed.value
      }
    ]
  }

  if (isNonCodeSubmissionType(task.value?.submissionType)) {
    const hasSubmission = submissions.value.length > 0
    return [
      {
        title: '阅读任务与验收标准',
        desc: '确认任务目标、提交格式与评分要点。',
        done: hasReadTask.value || hasSubmission || isTaskPassed.value
      },
      {
        title: '撰写实验报告正文',
        desc: '建议包含实验目的、实现思路、运行结果与结论。',
        done: hasSubmission || isTaskPassed.value
      },
      {
        title: '补充附件（可选）',
        desc: '可上传文档、图片或压缩包，增强评分依据。',
        done: hasSubmission || isTaskPassed.value
      },
      {
        title: '提交并启动评分',
        desc: '提交后系统自动解析并生成评分结果。',
        done: isTaskPassed.value
      }
    ]
  }

  const hasSubmission = submissions.value.length > 0
  return [
    {
      title: '阅读任务与约束',
      desc: '先明确功能目标、输入输出与评分标准。',
      done: hasReadTask.value || hasSubmission || isTaskPassed.value
    },
    {
      title: '导入实训数据集',
      desc: task.value?.instanceData ? '先导入数据后再开发，避免运行环境不一致。' : '当前任务无数据集，可直接进入开发。',
      done: !task.value?.instanceData || datasetDownloaded.value || hasSubmission || isTaskPassed.value
    },
    {
      title: '本地开发与自测',
      desc: '在本地完成编码并确保应用可正常运行。',
      done: hasSubmission || isTaskPassed.value
    },
    {
      title: '执行 MCP 自动评测',
      desc: '触发自动采集与评分，查看验收报告。',
      done: isTaskPassed.value
    }
  ]
})

const getGradingStatus = (result: any) => {
  if (!result) return ''
  return String(result.gradingStatus || result.aiGradingStatus || '').toLowerCase()
}

const isProcessingStatus = (status: string) => {
  return status === 'pending' || status === 'processing'
}

const recordLearningEvent = async (payload: any) => {
  try {
    await recordLearningProcess(payload)
  } catch (e) {
    console.warn('recordLearningProcess failed', e)
  }
}

// 当前任务是否存在进行中的评分。
const gradingInProgress = computed(() => {
  return isProcessingStatus(gradingProgressRawStatus.value)
})

const gradingProgressStatus = computed(() => {
  if (gradingProgressRawStatus.value === 'completed') return 'success'
  if (gradingProgressRawStatus.value === 'failed') return 'exception'
  return ''
})

const getProgressStorageKey = () => `${PROGRESS_SUBMISSION_KEY_PREFIX}${taskId.value}`

const openProgressPanel = () => {
  progressPanelVisible.value = true
}

const closeProgressPanel = () => {
  progressPanelVisible.value = false
}

const bindActiveProgressSubmission = (submissionId: number) => {
  activeProgressSubmissionId.value = submissionId
  sessionStorage.setItem(getProgressStorageKey(), String(submissionId))
}

const clearActiveProgressSubmission = () => {
  activeProgressSubmissionId.value = null
  sessionStorage.removeItem(getProgressStorageKey())
}

const applyProgressSnapshot = (payload: any) => {
  if (!payload) return
  gradingProgressRawStatus.value = String(payload.status || gradingProgressRawStatus.value || 'processing').toLowerCase()
  const nextPercent = Number(payload.progress ?? gradingProgressPercent.value ?? 0)
  gradingProgressPercent.value = Number.isFinite(nextPercent) ? Math.max(0, Math.min(100, nextPercent)) : 0
  gradingProgressMessage.value = payload.message || gradingProgressMessage.value || ''
  if (Array.isArray(payload.steps)) {
    gradingProgressSteps.value = payload.steps
  }
}

// Methods
const handleGoBack = () => {
  router.back()
}

const isGrading = (sub: any) => {
  if (!sub) return false

  if (Number(sub.status) === 2 && (sub.score == null || sub.score === undefined)) {
    return true
  }

  if (
    activeProgressSubmissionId.value
    && Number(activeProgressSubmissionId.value) === Number(sub.id)
    && isProcessingStatus(gradingProgressRawStatus.value)
  ) {
    return true
  }

  if (!gradingResult.value) return false
  
  // Only the latest submission can be grading
  if (submissions.value.length > 0 && sub.id !== submissions.value[0].id) {
    return false
  }
  
  const status = getGradingStatus(gradingResult.value)
  return isProcessingStatus(status)
}

const loadTaskDetail = async () => {
  try {
    loading.value = true
    const res = await getTaskDetail(Number(taskId.value))
    if (res.code === 200) {
      task.value = res.data
      if (!taskViewRecorded.value) {
        taskViewRecorded.value = true
        void recordLearningEvent({
          caseId: task.value?.caseId,
          taskId: Number(taskId.value),
          actionType: 'task_view',
          actionLabel: '查看任务详情',
          sourcePage: 'student-task-detail'
        })
      }
    } else {
      ElMessage.error(res.message || '加载任务详情失败')
    }
  } catch (e) {
    console.error('加载任务详情失败:', e)
    ElMessage.error('加载任务详情失败')
  } finally {
    loading.value = false
  }
}

const loadSubmissions = async () => {
  try {
    const res = await getTaskSubmissions(Number(taskId.value))
    submissions.value = res.data || []
  } catch (e) {
    console.error('加载提交记录失败', e)
  }
}

const deduplicateDetails = (details: any[]) => {
  if (!details) return []
  const map = new Map()
  details.forEach(item => {
    map.set(item.criterionName, item)
  })
  return Array.from(map.values())
}

const loadGradingResult = async () => {
  try {
    const res = await getTaskScore(Number(taskId.value))
    if (res.code === 200) {
      if (res.data && res.data.details) {
        res.data.details = deduplicateDetails(res.data.details)
      }
      gradingResult.value = res.data
    }
  } catch (e) {
    console.error('加载评分结果失败', e)
  }
}

const handleViewValidation = async (sub: any) => {
  currentSubmission.value = sub
  resultDialogVisible.value = true
  resultLoading.value = true
  resultError.value = ''
  validation.value = null
  dialogGradingResult.value = null
  
  try {
    // 1. 兼容两条链路：有基础验收时显示验收结果；无验收记录时仍可展示AI评分结果
    try {
      const valRes = await getValidationResult(sub.id)
      validation.value = valRes?.data || null
    } catch (e) {
      validation.value = null
    }

    if (isGrading(sub)) {
      return
    }

    // 2. Get grading result
    try {
      const gradeRes = await getTaskScore(Number(taskId.value))
      if (gradeRes.code === 200) {
        if (gradeRes.data && gradeRes.data.details) {
          gradeRes.data.details = deduplicateDetails(gradeRes.data.details)
        }
        dialogGradingResult.value = gradeRes.data
      }
    } catch (e) {
      console.error('获取评分细则失败', e)
    }
  } catch (e) {
    resultError.value = '获取数据失败'
  } finally {
    resultLoading.value = false
  }
}

const handleDeleteSubmission = async (sub: any) => {
  try {
    const res = await deleteSubmission(sub.id)
    
    if (res.code === 200) {
      ElMessage.success('删除成功')
      
      const index = submissions.value.findIndex(s => s.id === sub.id)
      if (index > -1) {
        submissions.value.splice(index, 1)
      }
      
      await loadSubmissions()
      await loadTaskDetail()
    }
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

const fetchMcpJson = async (url: string, options?: RequestInit, timeoutMs = 5000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...(options || {}), signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    window.clearTimeout(timer)
  }
}

const resolveMcpBaseUrl = async () => {
  const saved = (localStorage.getItem(MCP_BASE_URL_KEY) || '').trim().replace(/\/$/, '')
  if (saved) {
    try {
      const health = await fetchMcpJson(`${saved}/mcp/health`, undefined, 2000)
      if ((health && health.code === 200) || health?.data || health?.msg || health === 'MCP探针正常运行') {
        return saved
      }
    } catch (e) {
      // ignore and continue with auto-detect
    }
  }

  const ports = [8080, 8081, 8082, 8083]
  for (const port of ports) {
    const base = `http://localhost:${port}`
    try {
      const health = await fetchMcpJson(`${base}/mcp/health`, undefined, 2000)
      if ((health && health.code === 200) || health?.data || health?.msg || health === 'MCP探针正常运行') {
        localStorage.setItem(MCP_BASE_URL_KEY, base)
        return base
      }
    } catch (e) {
      // ignore and continue
    }
  }

  throw new Error('未检测到本地MCP探针。请确认项目已启动且 /mcp/health 可访问，再重试。')
}

// 启动 SSE 评分进度监听（完整实训案例/在线提交通道异步评分）
const startGradingProgressListener = (submissionId: number) => {
  bindActiveProgressSubmission(Number(submissionId))
  progressPanelVisible.value = true
  gradingProgressPercent.value = 0
  gradingProgressRawStatus.value = 'processing'
  gradingProgressMessage.value = 'AI评分已启动，正在建立进度连接...'
  gradingProgressSteps.value = []
  mcpStatusText.value = gradingProgressMessage.value
  startGradingProgress(Number(submissionId))
}

const handleOnlineSubmission = async (payload: any = {}) => {
  try {
    mcpAssessing.value = true
    mcpStatusText.value = '正在执行结构化校验...'

    const attachments = payload?.attachments || []
    const chartMeta = payload?.chartMeta || null
    const structuredChecks = payload?.structuredChecks || null

    const imageAttachments = attachments.filter((item: any) => {
      const type = String(item?.fileType || '').toLowerCase()
      const name = String(item?.fileName || '').toLowerCase()
      return ['png', 'jpg', 'jpeg'].includes(type) || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')
    })

    const typeLabelMap: Record<string, string> = {
      er_diagram: 'ER图',
      uml_class: 'UML类图',
      echarts_chart: '图表',
      sql_script: 'SQL'
    }

    const runStructuredValidation = async (validationType: string, requestBody: any, label: string) => {
      const validationRes = await validateStructuredArtifact({
        taskId: Number(taskId.value),
        validationType,
        ...requestBody
      })

      if (validationRes?.code === 200 && validationRes?.data) {
        const structured = validationRes.data
        const detectedType = String(structured?.detectedType || structured?.validationType || validationType)
        const autoLabel = typeLabelMap[detectedType] || label
        const evidenceText = structured?.classifierEvidence ? `（识别依据：${structured.classifierEvidence}）` : ''
        if (structured.status === 'FAIL') {
          const failed = (structured.ruleResults || []).filter((r: any) => !r.passed)
          const topFailed = failed.slice(0, 3).map((r: any) => r.ruleDescription || r.ruleName).join('；')
          ElMessage.error(`${autoLabel}结构化校验未通过：${topFailed || structured.feedback}${evidenceText}`)
          mcpAssessing.value = false
          mcpStatusText.value = ''
          return false
        }
        if (structured.status === 'PARTIAL') {
          ElMessage.warning(`${autoLabel}结构化校验部分通过：${structured.feedback}${evidenceText}`)
        } else {
          ElMessage.success(`${autoLabel}结构化校验通过${evidenceText}`)
        }
      }
      return true
    }

    if (structuredChecks?.sqlContent) {
      const ok = await runStructuredValidation(
        'sql_script',
        { content: structuredChecks.sqlContent },
        'SQL'
      )
      if (!ok) return
    }

    if (structuredChecks?.umlContent) {
      const ok = await runStructuredValidation(
        'uml_class',
        { content: structuredChecks.umlContent },
        'UML类图'
      )
      if (!ok) return
    }

    if (structuredChecks?.erMeta) {
      const ok = await runStructuredValidation(
        'er_diagram',
        { erDiagramMeta: structuredChecks.erMeta },
        'ER图'
      )
      if (!ok) return
    }

    if (imageAttachments.length > 0) {
      for (let i = 0; i < imageAttachments.length; i++) {
        const image = imageAttachments[i]
        const ok = await runStructuredValidation(
          'auto',
          {
            fileName: image?.fileName,
            filePath: image?.filePath,
            chartMeta: i === 0 ? (chartMeta || {}) : undefined
          },
          '图片'
        )
        if (!ok) return
      }
    }

    mcpStatusText.value = '正在提交完整实训成果并启动评分...'

    const requestBody = {
      taskId: Number(taskId.value),
      contentText: payload?.contentText || `任务【${task.value?.taskDescription || ''}】在线提交`,
      attachments,
      structuredPayload: {
        chartMeta,
        structuredChecks
      }
    }

    const res = await submitNonCodeTask(requestBody)

    if (res.code === 200) {
      const data = res.data || {}
      if (data.status === 'processing' && data.submissionId) {
        // 后端异步评分：保持 loading，通过 SSE 监听进度
        mcpStatusText.value = 'AI 评分已启动，请稍候...'
        startGradingProgressListener(Number(data.submissionId))
        // 立即刷新提交列表（提交记录已创建）
        setTimeout(() => { loadSubmissions(); loadTaskDetail() }, 300)
      } else {
        // 兼容旧的同步响应（正常不会走到这里）
        const statusText = data.status === 'passed' ? '评分通过' : (data.status === 'rejected' ? '需修改后重提' : '已提交')
        const parseSummary = data.parseSummary ? `；${data.parseSummary}` : ''
        ElMessage.success(`完整实训成果提交成功（${statusText}）${parseSummary}`)
        mcpAssessing.value = false
        mcpStatusText.value = ''
        setTimeout(() => { loadSubmissions(); loadTaskDetail(); loadGradingResult() }, 500)
      }
    } else {
      ElMessage.error(res.message || '完整实训成果提交失败')
      mcpAssessing.value = false
      mcpStatusText.value = ''
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '完整实训成果提交失败')
    mcpAssessing.value = false
    mcpStatusText.value = ''
  }
}

const startMcpAssessment = async (payload: any = {}) => {
  if (mcpAssessing.value) return

  const submissionType = String(task.value?.submissionType || '').toLowerCase()
  const isOnlineType = isNonCodeSubmissionType(submissionType)

  if (isFullPracticeTask.value || isOnlineType) {
    await handleOnlineSubmission(payload)
    return
  }

  if (payload?.manualZip) {
    try {
      mcpAssessing.value = true
      mcpStatusText.value = '正在提交ZIP并触发评分...'
      const res = await submitOnlineSubmission({
        taskId: Number(taskId.value),
        submissionType: 'code_file',
        contentText: payload?.contentText || '纯编码实战手动ZIP提交',
        attachments: payload?.attachments || []
      })
      if (res.code === 200) {
        const validationStatus = res?.data?.validationStatus
        const issues = Array.isArray(res?.data?.validationIssues) ? res.data.validationIssues : []
        const topIssues = issues.slice(0, 2).join('；')
        if (validationStatus === 'need_modify') {
          ElMessage.warning(`ZIP提交成功，结构化校验提示需修改${topIssues ? `：${topIssues}` : ''}`)
        } else {
          ElMessage.success('ZIP 提交成功，结构化校验通过并已启动评分流程')
        }
        const submissionId = res?.data?.submissionId
        if (submissionId) {
          startGradingProgressListener(Number(submissionId))
        }
        setTimeout(() => { loadSubmissions(); loadTaskDetail(); loadGradingResult() }, 500)
      } else {
        ElMessage.error(res.message || 'ZIP 提交失败')
      }
    } catch (e: any) {
      ElMessage.error(e?.message || 'ZIP 提交失败')
    } finally {
      mcpAssessing.value = false
      mcpStatusText.value = ''
    }
    return
  }

  try {
    mcpAssessing.value = true
    mcpStatusText.value = '正在检测本地MCP探针...'

    const baseUrl = await resolveMcpBaseUrl()
    mcpStatusText.value = `已连接探针：${baseUrl}，正在抓取源码...`

    const sourceRes = await fetchMcpJson(`${baseUrl}/mcp/source`, undefined, 10000)
    const sourceCode = sourceRes?.data ?? sourceRes
    if (!sourceCode || typeof sourceCode !== 'object' || Object.keys(sourceCode).length === 0) {
      throw new Error('MCP未返回有效源码数据')
    }

    mcpStatusText.value = '正在执行本地运行测试...'
    let runResult: any = null
    try {
      runResult = await fetchMcpJson(`${baseUrl}/mcp/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: Number(taskId.value),
          taskDescription: task.value?.taskDescription,
          taskRequirements: task.value?.taskRequirements
        })
      }, 10000)
    } catch (e) {
      runResult = { error: String(e) }
    }

    mcpStatusText.value = '正在提交平台并触发AI评分...'
    const res = await submitMcpAssessment({
      taskId: Number(taskId.value),
      sourceCode,
      runResult,
      probeInfo: {
        baseUrl,
        userAgent: navigator.userAgent,
        submittedAt: new Date().toISOString()
      }
    })

    if (res.code === 200) {
      ElMessage.success('评测任务已提交')
      const submissionId = res?.data?.submissionId
      if (submissionId) {
        bindActiveProgressSubmission(Number(submissionId))
        progressPanelVisible.value = true
        gradingProgressPercent.value = 0
        gradingProgressRawStatus.value = 'processing'
        gradingProgressMessage.value = 'AI评分已启动，正在建立进度连接...'
        gradingProgressSteps.value = []
        startGradingProgress(submissionId)
      }

      setTimeout(() => {
        loadSubmissions()
        loadTaskDetail()
      }, 800)
    } else {
      ElMessage.error(res.message || '评测提交失败')
    }
  } catch (e) {
    console.error('MCP评测失败', e)
    const msg = (e as any)?.message || '评测请求失败'
    mcpStatusText.value = msg
    ElMessage.error(msg)
    if (msg.includes('未检测到本地MCP探针')) {
      dependencyGuideVisible.value = true
    }
  } finally {
    mcpAssessing.value = false
    if (mcpStatusText.value.includes('正在')) {
      mcpStatusText.value = ''
    }
  }
}

const stopGradingPolling = () => {
  if (gradingPollingTimer !== null) {
    window.clearInterval(gradingPollingTimer)
    gradingPollingTimer = null
  }
}

const closeGradingProgressStream = () => {
  if (gradingProgressEventSource) {
    gradingProgressEventSource.close()
    gradingProgressEventSource = null
  }
}

const startGradingPolling = (submissionId: number) => {
  stopGradingPolling()
  let tick = 0

  gradingPollingTimer = window.setInterval(async () => {
    tick += 1
    try {
      // 优先读取后端进度快照，保证关闭面板后再次打开仍能看到最新进度。
      const progressRes = await getGradingProgressState(submissionId)
      if (progressRes?.code === 200 && progressRes.data) {
        applyProgressSnapshot(progressRes.data)
        mcpStatusText.value = gradingProgressMessage.value

        if (!isProcessingStatus(gradingProgressRawStatus.value)) {
          stopGradingPolling()
          closeGradingProgressStream()
          clearActiveProgressSubmission()
          if (gradingProgressRawStatus.value === 'completed') {
            gradingProgressPercent.value = 100
          }

          const gradeRes = await getTaskScore(Number(taskId.value))
          if (gradeRes.code === 200 && gradeRes.data) {
            const data = gradeRes.data
            if (data.details) {
              data.details = deduplicateDetails(data.details)
            }
            gradingResult.value = data
            if (currentSubmission.value && currentSubmission.value.id === submissionId) {
              dialogGradingResult.value = data
            }
          }

          loadTaskDetail()
          loadSubmissions()
          loadGradingResult()
        }
      }

      if (tick >= 120) {
        stopGradingPolling()
      }
    } catch (e) {
      // ignore polling error
    }
  }, 2000)
}

const startGradingProgress = (submissionId: number) => {
  closeGradingProgressStream()

  const token = getAuthToken('STUDENT')
  if (!token) {
    gradingProgressMessage.value = '缺少登录态，已切换轮询查看评分进度'
    startGradingPolling(submissionId)
    return
  }

  const sseUrl = `/api/grading/submission/${submissionId}/progress?token=${encodeURIComponent(token)}`
  gradingProgressEventSource = new EventSource(sseUrl)

  gradingProgressEventSource.addEventListener('connected', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      applyProgressSnapshot(data)
      gradingProgressMessage.value = data.message || '评分进度连接已建立'
      mcpStatusText.value = gradingProgressMessage.value
    } catch (e) {
      gradingProgressMessage.value = '评分进度连接已建立'
      mcpStatusText.value = gradingProgressMessage.value
    }
  })

  gradingProgressEventSource.addEventListener('start', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      applyProgressSnapshot(data)
      gradingProgressMessage.value = data.message || 'AI评分已开始'
      mcpStatusText.value = gradingProgressMessage.value
    } catch (e) {
      gradingProgressMessage.value = 'AI评分已开始'
      mcpStatusText.value = gradingProgressMessage.value
    }
  })

  gradingProgressEventSource.addEventListener('progress', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      applyProgressSnapshot(data)
      gradingProgressMessage.value = data.message || 'AI评分进行中'
      mcpStatusText.value = gradingProgressMessage.value
    } catch (e) {
      gradingProgressMessage.value = 'AI评分进行中'
      mcpStatusText.value = gradingProgressMessage.value
    }
  })

  gradingProgressEventSource.addEventListener('complete', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      applyProgressSnapshot(data)
      gradingProgressPercent.value = 100
      gradingProgressRawStatus.value = 'completed'
      gradingProgressMessage.value = data.message || 'AI评分已完成'
    } catch (e) {
      gradingProgressPercent.value = 100
      gradingProgressRawStatus.value = 'completed'
      gradingProgressMessage.value = 'AI评分已完成'
    }
    mcpStatusText.value = gradingProgressMessage.value
    clearActiveProgressSubmission()

    closeGradingProgressStream()
    stopGradingPolling()
    loadTaskDetail()
    loadSubmissions()
    loadGradingResult()
  })

  gradingProgressEventSource.addEventListener('error', () => {
    closeGradingProgressStream()
    startGradingPolling(submissionId)
  })

  startGradingPolling(submissionId)
}

onMounted(async () => {
  restoreDatasetDownloaded()
  await loadTaskDetail()
  await loadSubmissions()
  await loadGradingResult()

  const persistedSubmissionId = Number(sessionStorage.getItem(getProgressStorageKey()) || 0)
  if (persistedSubmissionId > 0) {
    bindActiveProgressSubmission(persistedSubmissionId)
    progressPanelVisible.value = true
    gradingProgressMessage.value = '已恢复评分进度监听...'
    mcpStatusText.value = gradingProgressMessage.value
    startGradingProgress(persistedSubmissionId)
    return
  }

  const latest = latestSubmission.value
  if (latest && Number(latest.status) === 2 && (latest.score == null || latest.score === undefined)) {
    bindActiveProgressSubmission(Number(latest.id))
    progressPanelVisible.value = true
    gradingProgressMessage.value = '检测到有进行中的AI评分，正在恢复进度监听...'
    mcpStatusText.value = gradingProgressMessage.value
    startGradingProgress(latest.id)
  }
})

onUnmounted(() => {
  closeGradingProgressStream()
  stopGradingPolling()
})
</script>

<style scoped lang="scss">
.dataset-bar {
  margin-bottom: 24px;
  
  .dataset-alert {
    :deep(.el-alert__content) {
      width: 100%;
    }
    
    .alert-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
  }
}

.task-detail-container {
  max-width: 1760px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 0 12px 24px; /* Keep the layout compact on large screens */
  min-height: 100%;
}

.main-content {
  padding-top: 16px; /* Add some spacing between header and content */
}

.left-column-stack {
  background: #fff;
  border-radius: 8px;
  padding: 16px; /* Reduced padding */
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  min-height: 620px;
}

.task-content-card {
  margin-top: 16px;
}

.sticky-sidebar {
  position: sticky;
  top: 70px; /* Adjusted to be below the sticky header (approx 56px + gap) */
  max-height: calc(100% - 90px); /* Adjusted max-height */
  overflow-y: auto;
  padding-right: 4px; /* Prevent scrollbar overlapping content */
}

/* Custom scrollbar for sidebar */
.sticky-sidebar::-webkit-scrollbar {
  width: 4px;
}
.sticky-sidebar::-webkit-scrollbar-thumb {
  background: #e4e7ed;
  border-radius: 2px;
}
.sticky-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.skeleton-wrapper {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}

/* Animation removed */

/* Tabs removed: guide and task details are now fixed sections */
</style>
