<template>
  <div class="submission-container">
    <!-- 顶部统计卡片 -->
    <div class="dashboard-grid">
      <div class="stat-card blue">
        <div class="icon-wrapper"><el-icon><Document /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ totalSubmissions }}</div>
          <div class="stat-label">提交总数</div>
        </div>
      </div>
      <div class="stat-card green">
        <div class="icon-wrapper"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ passedSubmissions }}</div>
          <div class="stat-label">验收通过</div>
        </div>
      </div>
      <div class="stat-card orange">
        <div class="icon-wrapper"><el-icon><Timer /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ gradingSubmissions }}</div>
          <div class="stat-label">评分中</div>
        </div>
      </div>
      <div class="stat-card teal">
        <div class="icon-wrapper"><el-icon><TrendCharts /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ averageScore }}</div>
          <div class="stat-label">平均分</div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="toolbar">
          <div class="left-tools">
            <span class="page-title">提交记录</span>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索案例或任务名称..."
              prefix-icon="Search"
              clearable
              class="search-input"
            />
          </div>
          <div class="right-tools">
            <el-radio-group v-model="filterStatus" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="passed">已通过</el-radio-button>
              <el-radio-button label="pending">评分中</el-radio-button>
            </el-radio-group>
            <el-button circle icon="Refresh" @click="loadData" :loading="loading"></el-button>
          </div>
        </div>
      </template>

      <!-- 列表区域 -->
      <div v-loading="loading" class="list-content">
        <transition-group name="list-fade" tag="div">
          <div v-if="paginatedGroups.length === 0 && !loading" class="empty-state" key="empty">
            <el-empty description="暂无符合条件的记录" />
          </div>

          <div v-for="group in paginatedGroups" :key="group.caseId" class="case-group-card">
            <!-- 案例头部 -->
            <div class="group-header" @click="toggleGroup(group.caseId)">
              <div class="header-left">
                <div class="case-icon">
                  <el-icon><FolderOpened /></el-icon>
                </div>
                <div class="header-info">
                  <div class="case-name">{{ group.caseName }}</div>
                  <div class="progress-bar">
                    <el-progress 
                      :percentage="getGroupProgressPercent(group)" 
                      :stroke-width="6" 
                      :color="customColors"
                      :show-text="false"
                    />
                  </div>
                </div>
              </div>
              <div class="header-right">
                <el-tag size="small" effect="plain" round>
                  {{ getGroupProgressText(group) }}
                </el-tag>
                <el-icon class="expand-icon" :class="{ 'is-active': !collapsedGroups.includes(group.caseId) }">
                  <ArrowDown />
                </el-icon>
              </div>
            </div>

            <!-- 任务列表 (折叠区域) -->
            <el-collapse-transition>
              <div v-show="!collapsedGroups.includes(group.caseId)" class="group-body">
                <el-table
                  :data="group.tasks"
                  :show-header="true"
                  style="width: 100%"
                  class="custom-table"
                  @expand-change="handleExpand"
                >
                  <el-table-column type="expand">
                    <template #default="props">
                      <div class="expand-content">
                      <!-- 未提交提示 -->
                      <div v-if="!props.row.id" class="no-data">
                        该任务尚未提交
                      </div>
                      
                      <!-- 已提交的详情 -->
                      <template v-else>
                      <!-- AI评分中状态 -->
                      <div v-if="isGradingInProgress(props.row.id)" class="grading-state">
                        <el-result icon="info" title="AI智能评分中" sub-title="系统正在对您的作业进行智能分析，请稍候...">
                          <template #extra>
                            <div class="grading-progress-extra">
                              <el-progress :percentage="getProgressPercent(props.row.id)" :status="getProgressStatus(props.row.id)" :stroke-width="12" />
                              <div class="progress-message">{{ getProgressMessage(props.row.id) }}</div>
                            </div>
                          </template>
                        </el-result>
                      </div>
                      
                      <!-- 评分完成后显示结果 -->
                      <template v-else>
                      <!-- 新增：总分展示区域 -->
                      <div v-if="getDisplayScore(props.row.id) !== null" class="score-overview">
                        <div class="score-card" :class="{ 'is-pass': Number(getDisplayScore(props.row.id)) >= 60, 'is-fail': Number(getDisplayScore(props.row.id)) < 60 }">
                          <div class="score-value">{{ getDisplayScore(props.row.id) }}</div>
                          <div class="score-label">本次得分</div>
                        </div>
                        <div class="status-message">
                           <div class="status-title" :class="{ 'text-pass': Number(getDisplayScore(props.row.id)) >= 60, 'text-fail': Number(getDisplayScore(props.row.id)) < 60 }">
                             {{ Number(getDisplayScore(props.row.id)) >= 60 ? '恭喜，验收通过！' : '很遗憾，验收未通过' }}
                           </div>
                           <div class="status-desc">
                             {{ Number(getDisplayScore(props.row.id)) >= 60 ? '您的作业已达到要求，继续保持！' : '您的作业未达到60分及格线，请根据下方反馈修改后重新提交。' }}
                           </div>
                           <div class="grading-duration" v-if="gradingMap[props.row.id]?.gradingDurationMs">
                             <el-icon><Timer /></el-icon> AI评分耗时：{{ formatDuration(gradingMap[props.row.id].gradingDurationMs) }}
                           </div>
                        </div>
                      </div>

                      <!-- 教师/AI 评分细则 -->
                      <div v-if="gradingMap[props.row.id] && gradingMap[props.row.id].gradingStatus === 'completed'" class="result-section grading-section">
                        <div class="section-header">
                          <span class="title"><el-icon><List /></el-icon> 评分细则</span>
                          <span class="score-text">得分：{{ gradingMap[props.row.id].totalScore }} / {{ gradingMap[props.row.id].maxScore }}</span>
                        </div>
                        
                        <!-- 反馈 -->
                        <div class="feedback-content" v-if="gradingMap[props.row.id].overallFeedback || gradingMap[props.row.id].teacherFeedback">
                           <div v-if="gradingMap[props.row.id].overallFeedback" class="feedback-item ai">
                              <div class="feedback-label"><el-icon><MagicStick /></el-icon> AI 评价</div>
                              <div class="feedback-text">{{ gradingMap[props.row.id].overallFeedback }}</div>
                           </div>
                           <div v-if="gradingMap[props.row.id].teacherFeedback" class="feedback-item teacher">
                              <div class="feedback-label"><el-icon><User /></el-icon> 教师评语</div>
                              <div class="feedback-text">{{ gradingMap[props.row.id].teacherFeedback }}</div>
                           </div>
                        </div>

                        <!-- 细则列表 -->
                        <div v-if="gradingMap[props.row.id].details" class="rubric-list">
                           <div v-for="item in gradingMap[props.row.id].details" :key="item.id" class="rubric-item">
                              <div class="rubric-header">
                                <span class="rubric-name">{{ item.criterionName }}</span>
                                <div class="rubric-score">
                                   <span class="score-val">{{ item.finalScore }}</span>
                                   <span class="score-max">/ {{ item.maxScore }}</span>
                                </div>
                              </div>
                              <div class="rubric-desc">{{ item.criterionDescription }}</div>
                              <div class="rubric-feedback">
                                 <div v-if="item.aiReason" class="ai-reason">
                                    <span class="tag">AI</span> {{ item.aiReason }}
                                 </div>
                                 <div v-if="item.teacherComment" class="teacher-comment">
                                    <span class="tag teacher">教师</span> {{ item.teacherComment }}
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>

                      <!-- 自动验收细则 (当没有AI评分时显示) -->
                      <div v-else-if="validationMap[props.row.id]" class="result-section validation-section">
                        <div class="section-header">
                          <span class="title"><el-icon><List /></el-icon> 自动验收细则</span>
                          <span class="score-text">得分：{{ validationMap[props.row.id].totalScore }}</span>
                        </div>

                        <div v-if="validationMap[props.row.id].feedback" class="feedback-box">
                          <div class="feedback-label">自动反馈</div>
                          <div class="feedback-text">{{ validationMap[props.row.id].feedback }}</div>
                        </div>

                        <el-table
                          :data="validationMap[props.row.id].validationItems"
                          size="small"
                          border
                          class="validation-table"
                        >
                          <el-table-column prop="validationType" label="检查项" width="120">
                            <template #default="{ row }">
                              {{ getValidationTypeText(row.validationType) }}
                            </template>
                          </el-table-column>
                          <el-table-column prop="description" label="说明" :show-overflow-tooltip="{ teleported: false }" />
                          <el-table-column prop="isPassed" label="结果" width="80" align="center">
                            <template #default="{ row }">
                              <el-tag :type="row.isPassed ? 'success' : 'danger'" size="small">
                                {{ row.isPassed ? '通过' : '失败' }}
                              </el-tag>
                            </template>
                          </el-table-column>
                          <el-table-column label="得分" width="100" align="center">
                            <template #default="{ row }">
                              <span :class="{ 'score-gain': row.score > 0 }">{{ row.score }} / {{ row.maxScore }}</span>
                            </template>
                          </el-table-column>
                          <el-table-column prop="errorMessage" label="错误信息" :show-overflow-tooltip="{ teleported: false }">
                            <template #default="{ row }">
                              <span class="error-text">{{ row.errorMessage || '-' }}</span>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>

                      <div v-else class="no-data">暂无评分结果</div>
                      </template>
                      </template>
                      </div>
                    </template>
                  </el-table-column>

                  <el-table-column label="任务名称" min-width="150" :show-overflow-tooltip="{ teleported: false }">
                    <template #default="{ row }">
                      <span class="task-name">{{ row.taskDescription || '任务 ' + row.taskId }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="fileName" label="文件名" min-width="150" :show-overflow-tooltip="{ teleported: false }" />
                  <el-table-column prop="submissionType" label="类型" width="100">
                    <template #default="{ row }">
                      <el-tag size="small" type="info" effect="plain">{{ row.submissionType === 'document' ? '文档' : row.submissionType }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="score" label="总分" width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="row.score !== null && row.score !== undefined" class="score-badge" :class="{ 'pass': row.score >= 60, 'fail': row.score < 60 }">
                        {{ row.score }}
                      </span>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="120" align="center">
                    <template #default="{ row }">
                      <el-tag :type="getSubmissionStatusType(row)" effect="light" size="small">
                        {{ getSubmissionStatusText(row) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="submissionTime" label="提交时间" width="180">
                    <template #default="{ row }">
                      <span class="time-text">{{ formatTime(row.submissionTime) }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-collapse-transition>
          </div>
        </transition-group>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          @update:current-page="handleCurrentPageChange"
          @update:page-size="handlePageSizeChange"
          :page-sizes="[5, 10, 20]"
          :total="filteredGroups.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
          :teleported="false"
          popper-class="custom-pagination-popper"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  MagicStick, User, List,
  Document, Timer, FolderOpened, ArrowDown,
  CircleCheck, TrendCharts
} from '@element-plus/icons-vue'
import { getMySubmissions, getSubmissionValidation, getMyTasks, getTaskScore } from '@/api/student/task'
import { getGradingProgressState } from '@/api/teacher/grading'
import { getAuthToken } from '@/utils/authStorage.js'
import { isFullPracticeCase } from '@/utils/studentTaskMode'
/** @typedef {import('@/api/types').TrainingTask} TrainingTask */

const loading = ref(false)
const submissions = ref<any[]>([])
const tasks = ref<any[]>([])

// 筛选和分页状态
const searchKeyword = ref('')
const filterStatus = ref('all')
const currentPage = ref(1)
const pageSize = ref(5)
const collapsedGroups = ref<number[]>([])

const validationMap = reactive<Record<number, any>>({})
const validationLoadingMap = reactive<Record<number, boolean>>({})
const gradingMap = reactive<Record<number, any>>({})
const gradingProgressMap = reactive<Record<number, any>>({})

// submissionId -> SSE连接
const gradingEventSources = new Map<number, EventSource>()
// submissionId -> 轮询定时器
const gradingPollingTimers = new Map<number, number>()

// 进度条颜色
const customColors = [
  { color: '#f56c6c', percentage: 20 },
  { color: '#e6a23c', percentage: 40 },
  { color: '#5cb87a', percentage: 60 },
  { color: '#1989fa', percentage: 80 },
  { color: '#22b8a7', percentage: 100 },
]

// 基础分组数据
const baseGroupedTasks = computed(() => {
  const groups: Record<number, any> = {}
  
  tasks.value.forEach(task => {
    const caseId = task.caseId || 0
    const caseName = task.caseName || '其他任务'

    if (!groups[caseId]) {
      groups[caseId] = {
        caseId,
        caseName,
        tasks: [],
        completedCount: 0
      }
    }
    
    const submission = submissions.value.find(sub => sub.taskId === task.id)
    
    const displayItem = {
      taskId: task.id,
      caseMode: task.caseMode,
      taskDescription: task.taskDescription,
      taskSequence: task.taskSequence,
      fileName: submission?.fileName || '-',
      submissionType: submission?.submissionType || '-',
      score: submission?.score,
      status: submission?.status || 1,
      submissionTime: submission?.submissionTime,
      id: submission?.id
    }
    
    groups[caseId].tasks.push(displayItem)
    
    if (displayItem.score !== null && displayItem.score !== undefined && Number(displayItem.score) >= 60) {
      groups[caseId].completedCount++
    }
  })

  Object.values(groups).forEach(group => {
    group.tasks.sort((a: any, b: any) => (a.taskSequence || 0) - (b.taskSequence || 0))
  })

  return Object.values(groups).sort((a, b) => b.caseId - a.caseId)
})

// 过滤后的分组数据
const filteredGroups = computed(() => {
  let result = baseGroupedTasks.value

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(group => {
      const matchGroup = group.caseName.toLowerCase().includes(keyword)
      const matchTasks = group.tasks.some((t: any) => 
        (t.taskDescription && t.taskDescription.toLowerCase().includes(keyword)) ||
        (t.fileName && t.fileName.toLowerCase().includes(keyword))
      )
      return matchGroup || matchTasks
    })
  }

  // 状态筛选
  if (filterStatus.value !== 'all') {
    result = result.filter(group => {
      if (filterStatus.value === 'passed') {
        return group.tasks.some((t: any) => t.score >= 60)
      } else if (filterStatus.value === 'pending') {
        return group.tasks.some((t: any) => isGradingInProgress(t.id))
      }
      return true
    })
  }

  return result
})

// 分页后的数据
const paginatedGroups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredGroups.value.slice(start, end)
})

// 统计数据
const totalSubmissions = computed(() => submissions.value.length)
const passedSubmissions = computed(() => submissions.value.filter(s => s.score >= 60).length)
const gradingSubmissions = computed(() => {
  return submissions.value.filter(s => s.status === 2 && (s.score === null || s.score === undefined)).length
})
const averageScore = computed(() => {
  const scored = submissions.value.filter(s => s.score !== null && s.score !== undefined)
  if (scored.length === 0) return 0
  const total = scored.reduce((sum, s) => sum + Number(s.score), 0)
  return (total / scored.length).toFixed(1)
})

const toggleGroup = (caseId: number) => {
  const index = collapsedGroups.value.indexOf(caseId)
  if (index > -1) {
    collapsedGroups.value.splice(index, 1)
  } else {
    collapsedGroups.value.push(caseId)
  }
}

const calculateProgress = (group: any) => {
  if (!group.tasks || group.tasks.length === 0) return 0
  return Math.round((group.completedCount / group.tasks.length) * 100)
}

const isReportLikeTask = (task: any) => {
  const text = `${task?.taskDescription || ''}`.toLowerCase()
  return text.includes('报告') || text.includes('最终') || text.includes('总结')
}

const getRepresentativeTask = (group: any) => {
  const tasks = Array.isArray(group?.tasks) ? [...group.tasks] : []
  if (!tasks.length) return null

  const reportTask = tasks.find(task => isReportLikeTask(task))
  if (reportTask) return reportTask

  const prioritized = [5, 2, 4, 3, 1]
  for (const status of prioritized) {
    const matched = tasks.find(task => Number(task?.status) === status)
    if (matched) return matched
  }

  return tasks[0]
}

const getGroupProgressPercent = (group: any) => {
  if (!group?.tasks?.length) return 0
  if (!isFullPracticeCase(group.tasks)) {
    return calculateProgress(group)
  }

  const entryTask = getRepresentativeTask(group)
  if (!entryTask) return 0

  if (entryTask.score != null) {
    return Number(entryTask.score) >= 60 ? 100 : 82
  }

  const map: Record<number, number> = {
    1: 10,
    2: 45,
    3: 100,
    4: 82,
    5: 88
  }
  return map[Number(entryTask.status)] ?? 0
}

const getGroupProgressText = (group: any) => {
  if (!group?.tasks?.length) return '提交状态：待开始'
  if (!isFullPracticeCase(group.tasks)) {
    return `${group.completedCount} / ${group.tasks.length} 完成`
  }

  const entryTask = getRepresentativeTask(group)
  if (!entryTask) return '提交状态：待开始'

  if (Number(entryTask.status) === 5) return '评分结果：已打回'
  if (entryTask.score != null) {
    return Number(entryTask.score) >= 60 ? '评分结果：已通过' : '评分结果：待修改'
  }

  const map: Record<number, string> = {
    1: '提交状态：待开始',
    2: '提交状态：评分中',
    3: '评分结果：已通过',
    4: '评分结果：待修改',
    5: '评分结果：已打回'
  }
  return map[Number(entryTask.status)] || '提交状态：评分中'
}

const handleCurrentPageChange = (value: number) => {
  currentPage.value = value
}

const handlePageSizeChange = (value: number) => {
  pageSize.value = value
}

const loadData = async () => {
  loading.value = true
  try {
    const [subRes, taskRes] = await Promise.all([
      getMySubmissions(),
      getMyTasks()
    ])
    submissions.value = subRes.data || []
    tasks.value = taskRes.data || []
    setupRealtimeTracking()
  } catch {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const loadValidation = async (submissionId: number) => {
  if (validationMap[submissionId] || validationLoadingMap[submissionId]) return
  validationLoadingMap[submissionId] = true
  try {
    const res = await getSubmissionValidation(submissionId)
    validationMap[submissionId] = res.data
  } catch {
    validationMap[submissionId] = null
  } finally {
    validationLoadingMap[submissionId] = false
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

const loadGrading = async (submissionId: number, taskId?: number) => {
  if (gradingMap[submissionId]) return
  if (!taskId) return
  try {
    const res = await getTaskScore(taskId)
    if (res.code === 200) {
      if (res.data && res.data.details) {
        res.data.details = deduplicateDetails(res.data.details)
      }
      gradingMap[submissionId] = res.data
    }
  } catch (e) {
    console.error('获取评分失败', e)
  }
}

// 启动评分进度实时追踪（SSE + 轮询兜底）。
const setupRealtimeTracking = () => {
  const processingIds = submissions.value
    .filter((item: any) => Number(item.status) === 2)
    .map((item: any) => Number(item.id))

  const activeSet = new Set(processingIds)

  // 清理不再评分中的连接。
  for (const trackedId of gradingEventSources.keys()) {
    if (!activeSet.has(trackedId)) {
      stopRealtimeTracking(trackedId)
    }
  }
  for (const trackedId of gradingPollingTimers.keys()) {
    if (!activeSet.has(trackedId)) {
      stopRealtimeTracking(trackedId)
    }
  }

  processingIds.forEach((submissionId: number) => {
    ensureRealtimeTracking(submissionId)
  })
}

const ensureRealtimeTracking = (submissionId: number) => {
  if (!gradingProgressMap[submissionId]) {
    gradingProgressMap[submissionId] = {
      status: 'processing',
      progress: 0,
      message: '等待评分开始...'
    }
  }

  getGradingProgressState(submissionId)
    .then((res: any) => {
      if (res?.code === 200 && res.data) {
        applyProgressUpdate(submissionId, res.data)
      }
    })
    .catch(() => {})

  // 1) SSE 实时流
  if (!gradingEventSources.has(submissionId)) {
    try {
      const token = getAuthToken('STUDENT') || ''
      const sseUrl = token
        ? `/api/grading/submission/${submissionId}/progress?token=${encodeURIComponent(token)}`
        : `/api/grading/submission/${submissionId}/progress`
      const source = new EventSource(sseUrl)
      source.addEventListener('connected', () => {
        if (!gradingProgressMap[submissionId]?.message) {
          gradingProgressMap[submissionId] = { ...gradingProgressMap[submissionId], message: '已建立进度连接' }
        }
      })

      const applyEvent = (evt: MessageEvent) => {
        try {
          const payload = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data
          applyProgressUpdate(submissionId, payload)
        } catch {
          // 忽略不可解析消息
        }
      }

      source.addEventListener('snapshot', applyEvent)
      source.addEventListener('start', applyEvent)
      source.addEventListener('progress', applyEvent)
      source.addEventListener('complete', applyEvent)
      source.addEventListener('error', applyEvent)

      // 网络错误时关闭SSE，保留轮询兜底。
      source.onerror = () => {
        source.close()
        gradingEventSources.delete(submissionId)
      }

      gradingEventSources.set(submissionId, source)
    } catch {
      // SSE不可用时由轮询兜底
    }
  }

  // 2) 轮询兜底（可鉴权）
  if (!gradingPollingTimers.has(submissionId)) {
    const timerId = window.setInterval(async () => {
      try {
        const res = await getGradingProgressState(submissionId)
        if (res?.code === 200 && res.data) {
          applyProgressUpdate(submissionId, res.data)
        }
      } catch {
        // 轮询失败不提示，避免噪音
      }
    }, 4000)
    gradingPollingTimers.set(submissionId, timerId)
  }
}

const stopRealtimeTracking = (submissionId: number) => {
  const source = gradingEventSources.get(submissionId)
  if (source) {
    source.close()
    gradingEventSources.delete(submissionId)
  }

  const timer = gradingPollingTimers.get(submissionId)
  if (timer) {
    window.clearInterval(timer)
    gradingPollingTimers.delete(submissionId)
  }
}

const applyProgressUpdate = async (submissionId: number, payload: any) => {
  if (!payload) return

  gradingProgressMap[submissionId] = {
    status: payload.status || 'processing',
    progress: Number(payload.progress ?? gradingProgressMap[submissionId]?.progress ?? 0),
    message: payload.message || gradingProgressMap[submissionId]?.message || ''
  }

  // 完成/失败后停止追踪，并刷新该提交评分详情。
  if (payload.status === 'completed' || payload.status === 'failed') {
    stopRealtimeTracking(submissionId)
    const submission = submissions.value.find((item: any) => Number(item.id) === Number(submissionId))
    await loadGrading(submissionId, submission?.taskId)
    await loadData()
  }
}

const handleExpand = (row: any) => {
  // 只有已提交的任务才加载详情
  if (!row.id) {
    return
  }
  loadValidation(row.id)
  loadGrading(row.id, row.taskId)
}

// 检查是否正在评分中
const isGradingInProgress = (submissionId: number) => {
  const progressState = gradingProgressMap[submissionId]
  if (progressState && (progressState.status === 'processing' || progressState.status === 'pending')) {
    return true
  }

  const grading = gradingMap[submissionId]
  if (!grading) {
    const submission = submissions.value.find((item: any) => Number(item.id) === Number(submissionId))
    return Number(submission?.status) === 2
  }
  const status = grading.gradingStatus
  return status === 'pending' || status === 'processing'
}

const getProgressPercent = (submissionId: number) => {
  const state = gradingProgressMap[submissionId]
  const value = Number(state?.progress ?? 0)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

const getProgressMessage = (submissionId: number) => {
  return gradingProgressMap[submissionId]?.message || 'AI评分处理中...'
}

const getProgressStatus = (submissionId: number) => {
  const state = gradingProgressMap[submissionId]
  if (!state) return ''
  if (state.status === 'failed') return 'exception'
  if (state.status === 'completed') return 'success'
  return ''
}

// 获取显示分数（只有评分完成才显示）
const getDisplayScore = (submissionId: number) => {
  const grading = gradingMap[submissionId]
  if (!grading) return null
  // 如果评分完成，显示AI评分
  if (grading.gradingStatus === 'completed' && grading.totalScore != null) {
    return grading.totalScore
  }
  return null
}

// 格式化耗时显示
const formatDuration = (ms: number) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

const getSubmissionStatusText = (row: any) => {
  // 未提交
  if (!row.id || row.status === 1) {
    return '未提交'
  }
  
  // 如果状态是5（已打回），优先显示已打回
  if (row.status === 5) {
    return '已打回'
  }
  
  // 优先使用分数判断状态
  if (row.score !== null && row.score !== undefined) {
    return Number(row.score) >= 60 ? '验收通过' : '验收未通过'
  }
  
  const map: Record<number, string> = {
    2: '已提交',
    3: '验收通过',
    4: '验收未通过',
    5: '已打回'
  }
  return map[row.status] || '未知'
}

const getSubmissionStatusType = (row: any) => {
  // 未提交
  if (!row.id || row.status === 1) {
    return 'info'
  }
  
  // 如果状态是5（已打回），显示warning样式
  if (row.status === 5) {
    return 'warning'
  }
  
  // 优先使用分数判断状态颜色
  if (row.score !== null && row.score !== undefined) {
    return Number(row.score) >= 60 ? 'success' : 'danger'
  }

  const map: Record<number, string> = {
    2: 'primary',
    3: 'success',
    4: 'danger',
    5: 'warning'
  }
  return map[row.status] || 'info'
}

const getValidationTypeText = (type: string) => {
  const map: Record<string, string> = {
    'FILE_EXISTENCE': '文件检查',
    'COMPILE': '编译检查',
    'UNIT_TEST': '单元测试',
    'CHECKSTYLE': '代码规范',
    'KEYWORD': '关键词检查',
    'format': '格式检查',
    'structure': '结构检查',
    'content': '内容检查',
    'data': '数据检查'
  }
  return map[type] || type
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-'
  return timeStr.replace('T', ' ').substring(0, 19)
}

onMounted(() => {
  loadData()
})

onBeforeUnmount(() => {
  for (const submissionId of gradingEventSources.keys()) {
    stopRealtimeTracking(submissionId)
  }
  for (const submissionId of gradingPollingTimers.keys()) {
    stopRealtimeTracking(submissionId)
  }
})
</script>

<style scoped lang="scss">
.submission-container {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100%;
}

.grading-progress-extra {
  min-width: 280px;
  text-align: left;

  .progress-message {
    margin-top: 8px;
    font-size: 13px;
    color: #606266;
  }
}

/* 顶部统计卡片 */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;

  .stat-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    }

    .icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .stat-content {
      flex: 1;
      .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #303133;
        line-height: 1.2;
      }
      .stat-label {
        font-size: 13px;
        color: #909399;
        margin-top: 4px;
      }
    }

    &.blue {
      .icon-wrapper { background: #ecf5ff; color: #409eff; }
    }
    &.green {
      .icon-wrapper { background: #f0f9eb; color: #67c23a; }
    }
    &.orange {
      .icon-wrapper { background: #fdf6ec; color: #e6a23c; }
    }
    &.teal {
      .icon-wrapper { background: #e8fbf7; color: #22b8a7; }
    }
  }
}

/* 主卡片 */
.main-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  :deep(.el-card__header) {
    padding: 16px 24px;
    border-bottom: 1px solid #f0f2f5;
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .left-tools {
    display: flex;
    align-items: center;
    gap: 20px;

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }

    .search-input {
      width: 240px;
    }
  }

  .right-tools {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

/* 列表区域 */
.list-content {
  min-height: 400px;
}

.empty-state {
  padding: 60px 0;
}

.case-group-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: #dcdfe6;
  }

  .group-header {
    background: #f8f9fb;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;

      .case-icon {
        width: 40px;
        height: 40px;
        background: #fff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #409eff;
        font-size: 20px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      }

      .header-info {
        flex: 1;
        max-width: 400px;

        .case-name {
          font-size: 16px;
          font-weight: 600;
          color: #303133;
          margin-bottom: 6px;
        }

        .progress-bar {
          width: 100%;
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;

      .expand-icon {
        color: #909399;
        transition: transform 0.3s;
        &.is-active {
          transform: rotate(180deg);
        }
      }
    }
  }

  .group-body {
    border-top: 1px solid #ebeef5;
  }
}

/* 表格样式优化 */
.custom-table {
  :deep(.el-table__row) {
    cursor: pointer;
  }
  
  .task-name {
    font-weight: 500;
    color: #303133;
  }

  .score-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 14px;
    
    &.pass { color: #67c23a; background: #f0f9eb; }
    &.fail { color: #f56c6c; background: #fef0f0; }
  }

  .time-text {
    color: #909399;
    font-size: 13px;
  }
}

/* 展开详情样式 */
.expand-content {
  padding: 24px;
  background-color: #fafafa;
}

.score-overview {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
  gap: 32px;

  .score-card {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border: 5px solid;
    position: relative;
    
    &.is-pass {
      border-color: #67c23a;
      color: #67c23a;
      background: #f0f9eb;
    }
    
    &.is-fail {
      border-color: #f56c6c;
      color: #f56c6c;
      background: #fef0f0;
    }

    .score-value {
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
    }
    
    .score-label {
      font-size: 12px;
      margin-top: 4px;
      font-weight: 500;
      opacity: 0.9;
    }
  }

  .status-message {
    flex: 1;
    .status-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 8px;
      
      &.text-pass { color: #67c23a; }
      &.text-fail { color: #f56c6c; }
    }
    .status-desc {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
    }
    .grading-duration {
      margin-top: 12px;
      font-size: 13px;
      color: #909399;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f4f4f5;
      display: inline-flex;
      padding: 4px 10px;
      border-radius: 4px;
    }
  }
}

.result-section {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f0f2f5;

    .title {
      font-size: 16px;
      font-weight: 700;
      color: #303133;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .score-text {
      font-weight: 600;
      color: #409eff;
      font-size: 15px;
      background: #ecf5ff;
      padding: 4px 12px;
      border-radius: 16px;
    }
  }
}

.feedback-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;

  .feedback-item {
    border-radius: 8px;
    padding: 16px;
    border: 1px solid transparent;

    &.ai {
      background: #f0f9eb;
      border-color: #e1f3d8;
      .feedback-label { color: #67c23a; }
    }

    &.teacher {
      background: #fdf6ec;
      border-color: #faecd8;
      .feedback-label { color: #e6a23c; }
    }

    .feedback-label {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .feedback-text {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
      text-align: justify;
    }
  }
}

.rubric-list {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .rubric-item {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.3s;
    
    &:hover {
      border-color: #c6e2ff;
      box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    }
    
    .rubric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      
      .rubric-name { 
        font-size: 15px;
        font-weight: 600; 
        color: #303133; 
      }
      
      .rubric-score {
        background: #f5f7fa;
        padding: 4px 12px;
        border-radius: 4px;
        
        .score-val { font-weight: 700; color: #409eff; font-size: 16px; }
        .score-max { color: #909399; font-size: 13px; margin-left: 4px; }
      }
    }
    
    .rubric-desc {
      font-size: 14px;
      color: #606266;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    
    .rubric-feedback {
      background: #f9fafc;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      border-left: 3px solid #d9ecff;
      
      .ai-reason, .teacher-comment {
        margin-bottom: 8px;
        &:last-child { margin-bottom: 0; }
        line-height: 1.5;
        
        .tag {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          margin-right: 8px;
          font-weight: 600;
          
          &.teacher { background: #fdf6ec; color: #e6a23c; }
          &:not(.teacher) { background: #e6f7ff; color: #409eff; }
        }
      }
    }
  }
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;

  :deep(.el-pagination) {
    font-size: 16px;
    gap: 6px;
  }

  :deep(.el-pagination__total),
  :deep(.el-pagination__jump),
  :deep(.el-pagination__sizes .el-select__placeholder),
  :deep(.el-pagination__jump .el-input__inner) {
    font-size: 16px;
  }

  :deep(.btn-prev),
  :deep(.btn-next),
  :deep(.el-pager li) {
    min-width: 36px;
    height: 36px;
    line-height: 36px;
    font-size: 16px;
    font-weight: 600;
  }
}

/* 动画 */
.list-fade-enter-active,
.list-fade-leave-active {
  transition: all 0.4s ease;
}
.list-fade-enter-from,
.list-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    
    .left-tools {
      width: 100%;
      flex-direction: column;
      align-items: flex-start;
      
      .search-input {
        width: 100%;
      }
    }
    
    .right-tools {
      width: 100%;
      justify-content: space-between;
    }
  }
}
</style>
