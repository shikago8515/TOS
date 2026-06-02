<template>
  <div class="task-container">
    <!-- 顶部统计仪表盘 -->
    <div class="dashboard-grid">
      <div class="stat-card blue">
        <div class="icon-wrapper"><el-icon><Odometer /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ todoCount }}</div>
          <div class="stat-label">待开始</div>
        </div>
      </div>
      <div class="stat-card orange">
        <div class="icon-wrapper"><el-icon><VideoPlay /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ doingCount }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </div>
      <div class="stat-card green">
        <div class="icon-wrapper"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ doneCount }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-card teal">
        <div class="icon-wrapper"><el-icon><PieChart /></el-icon></div>
        <div class="stat-content">
          <div class="stat-value">{{ completionRate }}%</div>
          <div class="stat-label">完成率</div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="toolbar">
          <div class="left-tools">
            <span class="page-title">我的实训任务</span>
            <el-input
              v-model="searchQuery"
              placeholder="搜索任务名称或案例..."
              prefix-icon="Search"
              clearable
              class="search-input"
            />
          </div>
          <div class="right-tools">
            <el-radio-group v-model="statusFilter" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="todo">待开始</el-radio-button>
              <el-radio-button label="doing">进行中</el-radio-button>
              <el-radio-button label="done">已完成</el-radio-button>
            </el-radio-group>
            <el-button circle icon="Refresh" @click="handleRefresh" :loading="loading"></el-button>
          </div>
        </div>
      </template>

      <!-- 任务列表区域 -->
      <div v-loading="loading" class="list-content">
        <transition-group name="list-fade" tag="div">
          <div v-if="groupedTasks.length === 0 && !loading" class="empty-state" key="empty">
            <el-empty description="暂无相关任务" />
          </div>

          <div v-for="group in paginatedGroups" :key="group.caseId" class="case-card">
            <!-- 案例头部 -->
            <div class="case-header" @click="toggleGroup(group.caseId)">
              <div class="header-left">
                <div class="case-icon">
                  <el-icon><Collection /></el-icon>
                </div>
                <div class="header-info">
                  <div class="case-title-row">
                    <span class="case-name">{{ group.caseName || 'CASE-' + group.caseId }}</span>
                    <el-tag size="small" :type="getSourceType(group.tasks)" effect="plain" round>
                      {{ getSourceText(group.tasks) }}
                    </el-tag>
                    <el-tag size="small" :type="getCaseModeTagType(group.tasks)" effect="light" round>
                      {{ getCaseModeText(group.tasks) }}
                    </el-tag>
                  </div>
                  <div class="progress-wrapper">
                    <el-progress 
                      :percentage="getGroupProgressPercent(group)" 
                      :stroke-width="6" 
                      :color="customColors"
                      :show-text="false"
                    />
                    <span class="progress-text">{{ getGroupProgressText(group) }}</span>
                  </div>
                  <div class="case-meta-row">
                    <div class="case-meta-line">
                      <span class="case-meta-item">发布班级：{{ group.publishClassName || '-' }}</span>
                      <span class="case-meta-item">发布教师：{{ group.teacherName || '-' }}</span>
                    </div>
                    <div class="case-meta-line">
                      <span class="case-meta-item">类别：{{ group.caseCategory || '-' }}</span>
                      <span class="case-meta-item">发布时间：{{ formatTime(group.publishTime) }}</span>
                      <span class="case-meta-item">截止时间：{{ formatTime(group.deadline) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="header-right">
                <!-- 一键提交按钮：仅对纯编码实战显示 -->
                <el-button
                  v-if="isPureCodingCaseGroup(group.tasks)"
                  type="primary"
                  size="small"
                  round
                  icon="Lightning"
                  class="one-click-btn"
                  @click.stop="openOneClickDialog(group)"
                >
                  一键提交
                </el-button>
                <el-icon class="expand-icon" :class="{ 'is-active': !collapsedGroups.includes(group.caseId) }">
                  <ArrowDown />
                </el-icon>
              </div>
            </div>

            <!-- 任务列表 (折叠区域) -->
            <el-collapse-transition>
              <div v-show="!collapsedGroups.includes(group.caseId)" class="case-body">
                <div v-if="isPureCodingCaseGroup(group.tasks)" class="task-grid">
                  <div v-for="(task, index) in group.tasks" :key="task.id" class="task-item">
                    <div class="task-index">{{ index + 1 }}</div>
                    <div class="task-main">
                      <div class="task-name" :title="task.taskDescription">{{ task.taskDescription }}</div>
                      <div class="task-meta">
                        <div class="meta-item">
                          <el-icon><Timer /></el-icon>
                          <span>{{ formatTime(task.deadline) }}</span>
                        </div>
                        <el-tag size="small" :type="getCaseModeTagType(task)" effect="light" round>
                          {{ getCaseModeText(task) }}
                        </el-tag>
                        <el-tag size="small" :type="getStatusType(task.status, task.score)" effect="light" round>
                          {{ getStatusText(task.status, task.score) }}
                        </el-tag>
                      </div>
                    </div>
                    <div class="task-actions">
                      <el-button 
                        v-if="task.status === 1" 
                        type="primary" 
                        size="small" 
                        round
                        icon="VideoPlay"
                        @click.stop="handleStartTask(task)"
                      >
                        {{ isPureCodingCase(task) ? '开始' : '进入实训' }}
                      </el-button>
                      <el-button 
                        v-if="task.status === 2" 
                        type="success" 
                        size="small" 
                        round
                        icon="Upload"
                        @click.stop="handleGoToSubmit(task)"
                      >
                        {{ isPureCodingCase(task) ? '评测' : '提交成果' }}
                      </el-button>
                      <el-button 
                        v-if="task.status === 3 || task.status === 4 || task.status === 5" 
                        type="info" 
                        size="small" 
                        round
                        plain
                        icon="DataAnalysis"
                        @click.stop="handleViewResult(task)"
                      >
                        结果
                      </el-button>
                      <el-button 
                        v-if="task.status === 4 || task.status === 5" 
                        type="danger" 
                        size="small" 
                        round
                        plain
                        icon="RefreshLeft"
                        @click.stop="handleGoToSubmit(task)"
                      >
                        {{ isPureCodingCase(task) ? '重测' : '重交' }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else class="full-practice-entry">
                  <div class="entry-main">
                    <div class="entry-title-row">
                      <span class="entry-title">完整实训案例统一入口</span>
                      <el-tag size="small" type="warning" effect="light" round>统一提交入口</el-tag>
                    </div>
                    <div class="entry-desc">
                      完整实训案例不再按子任务逐个进入。请在完成整个项目后，统一提交实验报告和源码压缩包；设计图、图表、截图纳入实验报告，SQL脚本作为项目材料放入源码压缩包的 `sql/` 或 `database/` 目录，不再单独提交。
                    </div>
                    <div class="entry-meta">
                      <span>流程节点数：{{ group.total }}</span>
                      <span>当前入口：{{ getFullPracticeEntryTask(group.tasks)?.taskDescription || '完整实训案例' }}</span>
                    </div>
                  </div>
                  <div class="entry-actions">
                    <el-button
                      v-if="getFullPracticeEntryTask(group.tasks)?.status === 1"
                      type="primary"
                      size="small"
                      round
                      icon="VideoPlay"
                      @click.stop="handleStartTask(getFullPracticeEntryTask(group.tasks))"
                    >
                      进入案例
                    </el-button>
                    <el-button
                      v-if="getFullPracticeEntryTask(group.tasks)?.status === 2"
                      type="success"
                      size="small"
                      round
                      icon="Upload"
                      @click.stop="handleGoToSubmit(getFullPracticeEntryTask(group.tasks))"
                    >
                      提交最终成果
                    </el-button>
                    <el-button
                      v-if="[3, 4, 5].includes(getFullPracticeEntryTask(group.tasks)?.status)"
                      type="info"
                      size="small"
                      round
                      plain
                      icon="DataAnalysis"
                      @click.stop="handleViewResult(getFullPracticeEntryTask(group.tasks))"
                    >
                      查看评分
                    </el-button>
                    <el-button
                      v-if="[4, 5].includes(getFullPracticeEntryTask(group.tasks)?.status)"
                      type="danger"
                      size="small"
                      round
                      plain
                      icon="RefreshLeft"
                      @click.stop="handleGoToSubmit(getFullPracticeEntryTask(group.tasks))"
                    >
                      重新提交
                    </el-button>
                  </div>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </transition-group>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20]"
          :total="groupedTasks.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
          :teleported="false"
          popper-class="custom-pagination-popper"
        />
      </div>
    </el-card>

    <!-- 一键提交对话框 -->
    <CaseOneClickSubmitDialog
      v-model="oneClickDialogVisible"
      :case-id="oneClickGroup?.caseId ?? null"
      :case-name="oneClickGroup?.caseName"
      :tasks="oneClickGroup?.tasks ?? []"
      @submitted="handleOneClickSubmitted"
    />

    <!-- 结果弹窗 -->
    <el-dialog 
      v-model="resultDialogVisible" 
      title="实训验收报告" 
      width="700px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      align-center
    >
      <div v-loading="resultLoading" class="result-content">
        <div v-if="resultError" class="error-state">
          <el-empty description="获取结果失败" :image-size="100">
            <template #description>
              <p>{{ resultError }}</p>
            </template>
          </el-empty>
        </div>

        <template v-else-if="validation">
          <!-- 顶部总分卡片 -->
          <div class="score-overview-card" :class="{ 'pass': displayScore >= 60 && currentTask?.status !== 5, 'fail': displayScore < 60 || currentTask?.status === 5 }">
            <div class="score-circle">
              <span class="score-num">{{ displayScore }}</span>
              <span class="score-lbl">总分</span>
            </div>
            <div class="score-info">
              <div class="info-row">
                <span class="label">任务：</span>
                <span class="value">{{ currentTask?.taskDescription }}</span>
              </div>
              <div class="info-row">
                <span class="label">文件：</span>
                <span class="value">{{ currentSubmission?.fileName || '-' }}</span>
              </div>
              <div class="status-badge">
                {{ currentTask?.status === 5 ? '已打回' : (displayScore >= 60 ? '验收通过' : '未通过') }}
              </div>
            </div>
          </div>

          <!-- 反馈区域 -->
          <div class="feedback-section" v-if="gradingResult?.overallFeedback || gradingResult?.teacherFeedback || validation.feedback">
            <div class="section-header">
              <el-icon><ChatLineSquare /></el-icon>
              <span>反馈评价</span>
            </div>
            <div class="feedback-list">
               <div v-if="gradingResult?.overallFeedback" class="feedback-item ai">
                  <div class="feedback-title"><el-icon><MagicStick /></el-icon> AI 智能评价</div>
                  <div class="feedback-body">{{ gradingResult.overallFeedback }}</div>
               </div>
               <div v-if="gradingResult?.teacherFeedback" class="feedback-item teacher">
                  <div class="feedback-title"><el-icon><User /></el-icon> 教师评语</div>
                  <div class="feedback-body">{{ gradingResult.teacherFeedback }}</div>
               </div>
               <div v-if="!gradingResult && validation.feedback" class="feedback-item auto">
                  <div class="feedback-title"><el-icon><Cpu /></el-icon> 自动反馈</div>
                  <div class="feedback-body">{{ validation.feedback }}</div>
               </div>
            </div>
          </div>

          <!-- 细则区域 -->
          <div class="details-section">
            <div class="section-header">
              <el-icon><List /></el-icon>
              <span>评分细则</span>
            </div>
            
            <!-- 教师/AI评分细则 -->
            <div v-if="gradingResult && gradingResult.details" class="rubric-list">
               <div v-for="item in gradingResult.details" :key="item.id" class="rubric-item">
                  <div class="rubric-top">
                    <span class="rubric-name">{{ item.criterionName }}</span>
                    <div class="rubric-score">
                       <span class="val">{{ item.finalScore }}</span>
                       <span class="max">/ {{ item.maxScore }}</span>
                    </div>
                  </div>
                  <div class="rubric-desc">{{ item.criterionDescription }}</div>
                  <div class="rubric-comments" v-if="item.aiReason || item.teacherComment">
                     <div v-if="item.aiReason" class="comment ai">
                        <span class="tag">AI</span> {{ item.aiReason }}
                     </div>
                     <div v-if="item.teacherComment" class="comment teacher">
                        <span class="tag">教师</span> {{ item.teacherComment }}
                     </div>
                  </div>
               </div>
            </div>

            <!-- 自动验收细则 -->
            <div v-else-if="(validation.validationItems || []).length" class="auto-validation-list">
              <div v-for="(item, idx) in validation.validationItems" :key="idx" class="validation-item">
                <div class="v-icon">
                  <el-icon v-if="item.isPassed" class="success"><Select /></el-icon>
                  <el-icon v-else class="error"><CloseBold /></el-icon>
                </div>
                <div class="v-content">
                  <div class="v-header">
                    <span class="v-type">{{ getValidationTypeText(item.validationType) }}</span>
                    <span class="v-score" :class="{ 'gain': item.score > 0 }">{{ item.score }} / {{ item.maxScore }}</span>
                  </div>
                  <div class="v-desc">{{ item.description }}</div>
                  <div v-if="item.errorMessage" class="v-error">{{ item.errorMessage }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <el-empty v-else description="暂无验收数据" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="resultDialogVisible = false">关闭</el-button>
          <el-button 
            v-if="displayScore < 60" 
            type="primary" 
            @click="handleResubmit"
          >
            重新提交
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Search, Refresh, Timer, VideoPlay, Upload, DataAnalysis, 
  ChatLineSquare, List, Select, CloseBold, MagicStick, User, 
  RefreshLeft, Odometer, CircleCheck, PieChart,
  Collection, ArrowDown, Cpu, Lightning
} from '@element-plus/icons-vue'
import { getMyTasks, startTask, getTaskSubmissions as getTaskSubmission, getValidationResult, getTaskScore } from '@/api/student/task'
import CaseOneClickSubmitDialog from './components/CaseOneClickSubmitDialog.vue'
import { Types } from '@/api/types'
import {
  getStudentTaskCaseModeLabel,
  getStudentTaskCaseModeTagType,
  isPureCodingCase,
  isFullPracticeCase
} from '@/utils/studentTaskMode'
/** @typedef {import('@/api/types').TrainingTask} TrainingTask */
/** @typedef {import('@/api/types').StudentSubmission} StudentSubmission */
/** @typedef {import('@/api/types').ValidationResponse} ValidationResponse */

const router = useRouter()
const tasks = ref([])
const loading = ref(false)
const statusFilter = ref('all')
const searchQuery = ref('')

// 分页与折叠
const currentPage = ref(1)
const pageSize = ref(5)
const collapsedGroups = ref<number[]>([])

// 结果弹窗相关
const resultDialogVisible = ref(false)
const resultLoading = ref(false)
const resultError = ref('')
const currentTask = ref(null)
const currentSubmission = ref(null)
const validation = ref(null)
const gradingResult = ref(null)

// 一键提交对话框
const oneClickDialogVisible = ref(false)
const oneClickGroup = ref<any>(null)

const isPureCodingCaseGroup = (taskList: any[]) => isPureCodingCase(taskList)

const openOneClickDialog = (group: any) => {
  // 只传纯编码子任务，完整实训案例不走 MCP 一键提交
  const codeTasks = (group.tasks || []).filter((t: any) => isCodeTask(t))
  oneClickGroup.value = { ...group, tasks: codeTasks }
  oneClickDialogVisible.value = true
}

const handleOneClickSubmitted = () => {
  // 提交完成后刷新任务列表
  setTimeout(() => handleRefresh(), 1000)
}

// 进度条颜色
const customColors = [
  { color: '#f56c6c', percentage: 20 },
  { color: '#e6a23c', percentage: 40 },
  { color: '#5cb87a', percentage: 60 },
  { color: '#1989fa', percentage: 80 },
  { color: '#22b8a7', percentage: 100 },
]

const filteredTasks = computed(() => {
  let res = tasks.value
  
  // 状态过滤
  if (statusFilter.value !== 'all') {
    const statusMap: Record<string, number> = { 'todo': 1, 'doing': 2, 'done': 3 }
    if (statusFilter.value === 'done') {
      res = res.filter(t => t.status === 3 || t.status === 4)
    } else {
      res = res.filter(t => t.status === statusMap[statusFilter.value])
    }
  }
  
  // 搜索过滤
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    res = res.filter(t => 
      t.taskDescription.toLowerCase().includes(q) || 
      String(t.caseId).includes(q) ||
      (t.caseName && t.caseName.toLowerCase().includes(q))
    )
  }
  
  return res
})

/**
 * @typedef {Object} GroupedTask
 * @property {number} caseId
 * @property {string} [caseName]
 * @property {TrainingTask[]} tasks
 * @property {number} total
 * @property {number} completed
 * @property {number} progress
 * @property {string} [caseCategory]
 * @property {string} [publishTime]
 * @property {string} [deadline]
 * @property {string} [publishClassName]
 * @property {string} [teacherName]
 */

const groupedTasks = computed(() => {
  const groups: Record<number, GroupedTask> = {}
  
  filteredTasks.value.forEach(task => {
    if (!groups[task.caseId]) {
      groups[task.caseId] = {
        caseId: task.caseId,
        caseName: task.caseName,
        caseCategory: task.caseCategory,
        publishTime: task.publishTime,
        deadline: task.deadline,
        publishClassName: task.publishClassName,
        teacherName: task.teacherName,
        tasks: [],
        total: 0,
        completed: 0,
        progress: 0
      }
    }
    groups[task.caseId].tasks.push(task)

    if (!groups[task.caseId].publishTime && task.publishTime) {
      groups[task.caseId].publishTime = task.publishTime
    }
    if (!groups[task.caseId].deadline && task.deadline) {
      groups[task.caseId].deadline = task.deadline
    }
    if (!groups[task.caseId].caseCategory && task.caseCategory) {
      groups[task.caseId].caseCategory = task.caseCategory
    }
    if (!groups[task.caseId].publishClassName && task.publishClassName) {
      groups[task.caseId].publishClassName = task.publishClassName
    }
    if (!groups[task.caseId].teacherName && task.teacherName) {
      groups[task.caseId].teacherName = task.teacherName
    }
  })

  return Object.values(groups).map(group => {
    group.total = group.tasks.length
    // 状态3为通过，4为未通过。这里完成进度通常指通过的数量
    group.completed = group.tasks.filter(t => t.status === 3).length
    group.progress = group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0
    group.tasks.sort((a, b) => a.id - b.id)
    return group
  }).sort((a, b) => b.caseId - a.caseId)
})

const paginatedGroups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return groupedTasks.value.slice(start, end)
})

// 统计数据
const todoCount = computed(() => tasks.value.filter(t => t.status === 1).length)
const doingCount = computed(() => tasks.value.filter(t => t.status === 2).length)
const doneCount = computed(() => tasks.value.filter(t => t.status === 3).length)
const completionRate = computed(() => {
  if (tasks.value.length === 0) return 0
  return Math.round((doneCount.value / tasks.value.length) * 100)
})

const toggleGroup = (caseId: number) => {
  const index = collapsedGroups.value.indexOf(caseId)
  if (index > -1) {
    collapsedGroups.value.splice(index, 1)
  } else {
    collapsedGroups.value.push(caseId)
  }
}

const displayScore = computed(() => {
  if (gradingResult.value?.totalScore != null) {
    return gradingResult.value.totalScore
  }
  if (currentTask.value?.score != null) {
    return currentTask.value.score
  }
  return validation.value?.totalScore || 0
})

const getStatusText = (status: number, score?: number) => {
  // 如果状态是5（已打回），优先显示已打回，不管分数
  if (status === 5) {
    return '已打回'
  }
  if (score != null) {
    return score >= 60 ? '已完成' : '未通过'
  }
  const map: Record<number, string> = { 
    1: '待开始', 
    2: '进行中', 
    3: '已通过',
    4: '未通过',
    5: '已打回'
  }
  return map[status] || '未知'
}

const getStatusType = (status: number, score?: number) => {
  // 如果状态是5（已打回），优先显示warning样式
  if (status === 5) {
    return 'warning'
  }
  if (score != null) {
    return score >= 60 ? 'success' : 'danger'
  }
  const map: Record<number, string> = { 
    1: 'info', 
    2: 'warning', 
    3: 'success',
    4: 'danger',
    5: 'warning'
  }
  return map[status] || ''
}

const getSourceText = (tasks: TrainingTask[]) => {
  const source = tasks?.[0]?.source
  return source === 2 ? '自领' : '分配'
}

const getSourceType = (tasks: TrainingTask[]) => {
  const source = tasks?.[0]?.source
  return source === 2 ? 'success' : 'primary'
}

const isCodeTask = (task: TrainingTask) => {
  const submissionType = (task?.submissionType || '').toLowerCase()
  return ['code', 'code_file', 'code_folder', 'source', 'project'].includes(submissionType)
}

const isReportLikeTask = (task: TrainingTask) => {
  const submissionType = String(task?.submissionType || '').toLowerCase()
  const text = `${task?.taskDescription || ''} ${task?.taskRequirements || ''}`.toLowerCase()
  return submissionType.includes('report') || text.includes('报告') || text.includes('最终交付') || text.includes('总结')
}

const getFullPracticeEntryTask = (taskList: TrainingTask[] = []) => {
  const tasks = Array.isArray(taskList) ? [...taskList] : []
  if (!tasks.length) return null

  const reportTask = tasks.find(task => isReportLikeTask(task))
  if (reportTask) return reportTask

  const prioritized = [5, 2, 1, 4, 3]
  for (const status of prioritized) {
    const matched = tasks.find(task => Number(task?.status) === status)
    if (matched) return matched
  }

  return tasks[0]
}

const getGroupProgressPercent = (group: any) => {
  if (!group?.tasks?.length) return 0
  if (!isFullPracticeCase(group.tasks)) {
    return Number(group.progress || 0)
  }

  const entryTask = getFullPracticeEntryTask(group.tasks)
  if (!entryTask) return 0

  if (Number(entryTask.status) === 5) return 88
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
    return `${group.completed}/${group.total} 完成`
  }

  const entryTask = getFullPracticeEntryTask(group.tasks)
  if (!entryTask) return '提交状态：待开始'

  if (Number(entryTask.status) === 5) return '评分结果：已打回'
  if (entryTask.score != null) {
    return Number(entryTask.score) >= 60 ? '评分结果：已通过' : '评分结果：待修改'
  }

  const map: Record<number, string> = {
    1: '提交状态：待开始',
    2: '提交状态：进行中',
    3: '评分结果：已通过',
    4: '评分结果：待修改',
    5: '评分结果：已打回'
  }
  return map[Number(entryTask.status)] || '提交状态：进行中'
}

const getCaseModeText = (taskOrTasks: TrainingTask | TrainingTask[]) => {
  return getStudentTaskCaseModeLabel(taskOrTasks)
}

const getCaseModeTagType = (taskOrTasks: TrainingTask | TrainingTask[]) => {
  return getStudentTaskCaseModeTagType(taskOrTasks)
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
  return timeStr.replace('T', ' ').substring(0, 16)
}

const handleRefresh = async () => {
  loading.value = true
  try {
    const res = await getMyTasks()
    tasks.value = res.data || []
  } catch (error) {
    ElMessage.error('获取任务失败')
  } finally {
    loading.value = false
  }
}

const handleStartTask = async (row: TrainingTask) => {
  try {
    const res = await startTask(row.id)
    if (res.code === 200) {
      ElMessage.success('任务已开始')
      handleRefresh()
      router.push(`/student/tasks/${row.id}`)
      return
    }
    ElMessage.error(res.message || '开始任务失败')
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleGoToSubmit = (row: TrainingTask) => {
  router.push(`/student/tasks/${row.id}`)
}

const deduplicateDetails = (details: any[]) => {
  if (!details) return []
  const map = new Map()
  details.forEach(item => {
    map.set(item.criterionName, item)
  })
  return Array.from(map.values())
}

const handleViewResult = async (row: TrainingTask) => {
  currentTask.value = row
  resultDialogVisible.value = true
  resultLoading.value = true
  resultError.value = ''
  validation.value = null
  gradingResult.value = null
  
  try {
    const subRes = await getTaskSubmission(row.id)
    if (subRes.code === 200 && Array.isArray(subRes.data) && subRes.data.length > 0) {
      const submission = subRes.data[0]
      currentSubmission.value = submission
      
      const valRes = await getValidationResult(submission.id)
      validation.value = valRes.data

      try {
        const gradeRes = await getTaskScore(row.id)
        if (gradeRes.code === 200) {
          if (gradeRes.data && gradeRes.data.details) {
            gradeRes.data.details = deduplicateDetails(gradeRes.data.details)
          }
          gradingResult.value = gradeRes.data
        }
      } catch (e) {
        console.error('获取评分细则失败', e)
      }
    } else {
      resultError.value = '未找到提交记录'
    }
  } catch (e) {
    resultError.value = '网络请求失败'
  } finally {
    resultLoading.value = false
  }
}

const handleResubmit = () => {
  if (currentTask.value) {
    resultDialogVisible.value = false
    handleGoToSubmit(currentTask.value)
  }
}

onMounted(() => {
  handleRefresh()
})
</script>

<style scoped lang="scss">
.task-container {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100%;
  box-sizing: border-box;
}

.case-meta-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.case-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.case-meta-item {
  font-size: 12px;
  color: #606266;
}

/* 仪表盘 */
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
        font-weight: 800;
        color: #303133;
        line-height: 1.2;
      }
      .stat-label {
        font-size: 13px;
        color: #909399;
        margin-top: 4px;
      }
    }

    &.blue { .icon-wrapper { background: #ecf5ff; color: #409eff; } }
    &.orange { .icon-wrapper { background: #fdf6ec; color: #e6a23c; } }
    &.green { .icon-wrapper { background: #f0f9eb; color: #67c23a; } }
    &.teal { .icon-wrapper { background: #e8fbf7; color: #22b8a7; } }
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
      width: 260px;
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

.case-card {
  border: 1px solid #dfe6ee;
  border-radius: 12px;
  margin-bottom: 22px;
  overflow: hidden;
  transition: all 0.3s ease;
  background: #fff;
  position: relative;
  box-shadow: 0 2px 10px rgba(17, 24, 39, 0.04);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 3px;
    background: linear-gradient(90deg, #409eff 0%, #79bbff 100%);
    opacity: 0.8;
  }

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: -11px;
    border-bottom: 1px dashed #dce3eb;
  }

  &:hover {
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.08);
    border-color: #cfd8e3;
  }

  .case-header {
    background: linear-gradient(180deg, #f8fbff 0%, #f6f8fb 100%);
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
        max-width: 500px;

        .case-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          
          .case-name {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }
        }

        .progress-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          
          .el-progress {
            width: 200px;
          }
          
          .progress-text {
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;

      .one-click-btn {
        white-space: nowrap;
      }

      .expand-icon {
        color: #909399;
        transition: transform 0.3s;
        &.is-active {
          transform: rotate(180deg);
        }
      }
    }
  }

  .case-body {
    border-top: 1px solid #ebeef5;
    padding: 10px 12px 12px;
    background: #fcfdff;
  }
}

.full-practice-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: linear-gradient(180deg, #fffdfa 0%, #fff 100%);

  .entry-main {
    flex: 1;
    min-width: 0;
  }

  .entry-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 8px;
  }

  .entry-title {
    font-size: 15px;
    font-weight: 700;
    color: #303133;
  }

  .entry-desc {
    font-size: 13px;
    color: #606266;
    line-height: 1.7;
    margin-bottom: 10px;
  }

  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    font-size: 12px;
    color: #909399;
  }

  .entry-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;

    .el-button {
      min-width: 108px;
      margin-left: 0;
    }
  }
}

/* 任务网格/列表 */
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.task-item {
  background: #f8f9fa;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    background: #409eff;
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover {
    background: #fff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
    transform: translateY(-2px);
    border-color: #dcdfe6;

    &::before {
      opacity: 1;
    }
  }

  .task-index {
    width: 28px;
    height: 28px;
    background: #e6f1fc;
    color: #409eff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: bold;
    flex-shrink: 0;
    margin-right: 0;
  }

  .task-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;

    .task-name {
      font-size: 15px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 12px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .task-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #909399;

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }

  .task-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;

    .el-button {
      margin-left: 0;
      width: 80px;
      transition: all 0.3s;

      &:hover {
        transform: scale(1.05);
      }
    }
  }
}

.pagination-wrapper {
  padding: 16px 24px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: flex-end;
  background: #fff;

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

/* 结果弹窗样式优化 */
.score-overview-card {
  display: flex;
  align-items: center;
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  margin-bottom: 24px;
  gap: 32px;
  border: 1px solid #ebeef5;

  &.pass {
    background: #f0f9eb;
    border-color: #e1f3d8;
    .score-circle { border-color: #67c23a; color: #67c23a; }
    .status-badge { background: #67c23a; }
  }

  &.fail {
    background: #fef0f0;
    border-color: #fde2e2;
    .score-circle { border-color: #f56c6c; color: #f56c6c; }
    .status-badge { background: #f56c6c; }
  }

  .score-circle {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    border: 4px solid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #fff;

    .score-num { font-size: 28px; font-weight: 800; line-height: 1; }
    .score-lbl { font-size: 12px; margin-top: 2px; opacity: 0.8; }
  }

  .score-info {
    flex: 1;
    .info-row {
      margin-bottom: 8px;
      font-size: 14px;
      .label { color: #909399; }
      .value { color: #303133; font-weight: 500; }
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }
  }
}

.feedback-section, .details-section {
  margin-bottom: 24px;
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
    padding-left: 8px;
    border-left: 4px solid #409eff;
  }
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .feedback-item {
    padding: 16px;
    border-radius: 8px;
    border: 1px solid transparent;

    .feedback-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .feedback-body {
      font-size: 14px;
      line-height: 1.6;
      color: #606266;
    }

    &.ai { background: #f0f9eb; border-color: #e1f3d8; .feedback-title { color: #67c23a; } }
    &.teacher { background: #fdf6ec; border-color: #faecd8; .feedback-title { color: #e6a23c; } }
    &.auto { background: #ecf5ff; border-color: #d9ecff; .feedback-title { color: #409eff; } }
  }
}

.rubric-list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .rubric-item {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 16px;
    
    .rubric-top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      .rubric-name { font-weight: 600; color: #303133; }
      .rubric-score {
        .val { font-weight: 700; color: #409eff; }
        .max { color: #909399; font-size: 12px; }
      }
    }
    .rubric-desc { font-size: 13px; color: #909399; margin-bottom: 12px; }
    .rubric-comments {
      background: #f9fafc;
      padding: 10px;
      border-radius: 4px;
      font-size: 13px;
      .comment {
        margin-bottom: 4px;
        &:last-child { margin-bottom: 0; }
        .tag {
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 11px;
          margin-right: 6px;
        }
        &.ai .tag { background: #e6f7ff; color: #409eff; }
        &.teacher .tag { background: #fdf6ec; color: #e6a23c; }
      }
    }
  }
}

.auto-validation-list {
  .validation-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid #f0f2f5;
    &:last-child { border-bottom: none; }

    .v-icon {
      margin-top: 2px;
      .success { color: #67c23a; }
      .error { color: #f56c6c; }
    }
    .v-content {
      flex: 1;
      .v-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        .v-type { font-weight: 600; font-size: 14px; }
        .v-score { 
          font-size: 13px; color: #909399; 
          &.gain { color: #67c23a; font-weight: 600; }
        }
      }
      .v-desc { font-size: 13px; color: #606266; }
      .v-error { font-size: 12px; color: #f56c6c; margin-top: 4px; }
    }
  }
}

/* 动画 */
.list-fade-enter-active,
.list-fade-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}
.list-fade-enter-from,
.list-fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
.list-fade-leave-active {
  position: absolute;
}

.empty-state {
  padding: 60px 0;
}

/* 响应式 */
@media (max-width: 1200px) {
  .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .dashboard-grid { grid-template-columns: 1fr; }
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    .left-tools { width: 100%; flex-direction: column; align-items: flex-start; .search-input { width: 100%; } }
    .right-tools { width: 100%; justify-content: space-between; }
  }

  .full-practice-entry {
    flex-direction: column;
    align-items: stretch;

    .entry-actions {
      width: 100%;

      .el-button {
        width: 100%;
      }
    }
  }
}
</style>
