<template>
  <div class="grading-layout">
    <!-- 左侧侧边栏：班级列表 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">班级批改</h2>
        <el-input
          v-model="classSearchQuery"
          placeholder="搜索班级..."
          :prefix-icon="Search"
          clearable
          class="search-input"
          size="small"
        />
      </div>
      
      <div class="class-list" v-loading="loadingClasses">
        <el-scrollbar>
          <div v-if="filteredClasses.length === 0" class="empty-list">
            <el-empty description="暂无班级" :image-size="60" />
          </div>
          <div 
            v-for="cls in filteredClasses" 
            :key="cls.id" 
            class="class-item"
            :class="{ active: selectedClassId === cls.id }"
            @click="handleSelectClass(cls)"
          >
            <div class="class-icon">
              <span class="char">{{ cls.name.charAt(0) }}</span>
            </div>
            <div class="class-info">
              <div class="class-name" :title="cls.name">{{ cls.name }}</div>
              <div class="class-meta">
                <el-icon><User /></el-icon> {{ cls.studentCount || 0 }} 人
              </div>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <!-- 右侧主内容区 -->
    <div class="main-content">
      <div v-if="!selectedClassId" class="empty-workspace">
        <div class="placeholder-content">
          <div class="icon-bg">
            <el-icon><School /></el-icon>
          </div>
          <h3>请选择班级开始批改</h3>
          <p>选择左侧班级后，将显示该班级所有学生的作业提交情况</p>
        </div>
      </div>

      <div v-else class="workspace-container">
        <!-- 顶部工具栏 -->
        <div class="workspace-header animate__animated animate__fadeInDown">
          <div class="header-left">
            <h2 class="current-class-title">{{ currentClass?.name }}</h2>
            <div class="class-stats">
              <el-tag type="info" effect="plain" round size="small">
                总人数: {{ students.length }}
              </el-tag>
              
              <template v-if="pendingCount > 0">
                <el-tag type="warning" effect="plain" round size="small">
                  待批改: {{ pendingCount }} 人
                </el-tag>
                <el-button 
                  type="primary" 
                  link
                  icon="Check"
                  @click="handleBatchConfirm" 
                  :loading="batchConfirming"
                  style="margin-left: 8px; font-size: 13px;"
                >
                  一键确认 {{ pendingTaskIds.length }} 个任务
                </el-button>
              </template>

              <el-tag type="success" effect="plain" round v-if="gradedCount > 0" size="small">
                已完成: {{ gradedCount }}
              </el-tag>
            </div>
          </div>
          <div class="header-right">
            <el-input 
              v-model="studentSearchQuery" 
              placeholder="搜索学生姓名/学号" 
              :prefix-icon="Search" 
              style="width: 200px" 
              clearable
              size="small"
            />
            <el-button :icon="Refresh" circle size="small" @click="refreshStudents" :loading="loadingStudents" />
          </div>
        </div>

        <!-- 学生列表（卡片矩阵） -->
        <div class="workspace-body" v-loading="loadingStudents">
          <el-scrollbar>
            <div class="student-grid animate__animated animate__fadeInUp">
              <div 
                v-for="(student, sIndex) in filteredStudents" 
                :key="student.id" 
                class="student-card"
                :style="{ '--stagger-index': sIndex }"
                @click="openStudentDrawer(student)"
              >
                <div class="card-main">
                  <el-avatar 
                    :size="32" 
                    class="student-avatar" 
                    :src="student.avatar"
                    :style="{ backgroundColor: student.avatar ? '' : getAvatarColor(student.realName || student.nickname) }"
                  >
                    {{ (student.realName || student.nickname || 'S')[0] }}
                  </el-avatar>
                  <div class="student-details">
                    <div class="name">{{ student.realName || student.nickname || student.username }}</div>
                    <div class="id">{{ student.studentId || student.username }}</div>
                  </div>
                </div>
                
                <div class="card-footer">
                  <!-- 异步加载的任务状态 -->
                  <div v-if="studentTaskMap[student.id]?.loading" class="status-loading">
                    <el-icon class="is-loading"><Loading /></el-icon> 加载作业中...
                  </div>
                  <div v-else-if="studentTaskMap[student.id]?.tasks?.length > 0" class="task-status">
                    <template v-if="getStudentPendingTask(student.id)">
                      <el-tag type="warning" size="small" effect="dark">待批改</el-tag>
                      <span class="task-name text-truncate">{{ getStudentPendingTask(student.id).taskDescription }}</span>
                    </template>
                    <template v-else-if="isStudentFullyCompleted(student.id)">
                      <el-tag type="success" size="small" effect="plain">全部完成</el-tag>
                      <span class="task-count">{{ studentTaskMap[student.id].tasks.length }} 个任务</span>
                    </template>
                    <template v-else>
                      <el-tag type="info" size="small" effect="plain">进行中</el-tag>
                      <span class="task-count">{{ getStudentProgressText(student.id) }}</span>
                    </template>
                  </div>
                  <div v-else class="no-task">
                    <span class="text-gray">暂无任务</span>
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-if="filteredStudents.length === 0" description="未找到匹配的学生" />
          </el-scrollbar>
        </div>
      </div>
    </div>

    <!-- 批改详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="null"
      :with-header="false"
      size="100%"
      :destroy-on-close="true"
      class="grading-drawer-fullscreen"
      :append-to-body="false"
    >
      <div class="drawer-header-float">
        <div class="header-container">
          <div class="header-left">
            <el-button class="back-btn" link @click="drawerVisible = false">
              <el-icon><Back /></el-icon>
            </el-button>
            <div class="student-profile" v-if="currentStudent">
               <el-avatar :size="40" :src="currentStudent.avatar" class="student-avatar">
                 {{ (currentStudent.realName || currentStudent.nickname || 'S')[0] }}
               </el-avatar>
               <div class="info-text">
                 <div class="name">{{ currentStudent.realName || currentStudent.nickname }}</div>
                 <div class="id">{{ currentStudent.studentId }}</div>
               </div>
            </div>
          </div>
          
          <div class="header-right">
             <div class="action-group">
               <el-button 
                 class="action-btn reject-btn"
                 plain
                 size="small"
                 @click="handleRejectTask" 
                 :disabled="!currentSubmission || (currentTask && currentTask.status === 5)"
                 v-if="currentTask"
               >
                 <el-icon><CloseBold /></el-icon> 打回重做
               </el-button>
               <el-button 
                 class="action-btn regrade-btn"
                 plain
                 size="small"
                 @click="handleReGrade" 
                 :loading="regrading" 
                 :disabled="currentTask && currentTask.status === 5"
                 v-if="currentTask"
               >
                 <el-icon><Refresh /></el-icon> AI 重评
               </el-button>
             </div>
             
             <div class="nav-group">
              <el-button-group>
                <el-button class="nav-btn" @click="prevStudent" :disabled="!hasPrevStudent">
                  <el-icon><ArrowLeft /></el-icon> 上一个
                </el-button>
                <el-button class="nav-btn" @click="nextStudent" :disabled="!hasNextStudent">
                  下一个 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>
              </el-button-group>
             </div>
          </div>
        </div>
      </div>

      <div class="drawer-layout-flex">
        <!-- 左侧任务列表 -->
        <div class="layout-sidebar-left" :style="{ width: leftSidebarWidth + 'px' }">
          <StudentTaskList 
            :tasks="groupedStudentTasks"
            :activeCaseNames="activeCaseNames"
            @update:activeCaseNames="(value) => activeCaseNames = value"
            :currentTaskId="currentTask?.id"
            @select="selectTask"
          />
        </div>

        <!-- Resizer -->
        <div 
            class="layout-resizer"
            @mousedown="startLeftResize"
            :class="{ 'is-resizing': isLeftResizing }"
        ></div>
        
        <!-- 右侧主区域 -->
        <div class="layout-main">
          <GradingPanel
            :task="currentTask"
            :submission="currentSubmission"
            :aiResult="aiResult"
            :aiProcess="aiProcess"
            :gradingDetails="gradingDetails"
            :finalFeedback="finalFeedback"
            @update:finalFeedback="(value) => finalFeedback.value = value"
            :loading="aiLoading"
            :fileContent="fileContent"
            :fileLoading="fileLoading"
            :submitting="submitting"
            :isNonCode="isNonCodeTask"
            :attachments="submissionAttachments"
            @download="handleDownloadFile"
            @adopt-ai-score="handleAdoptAiScore"
            @submit="submitGrading"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, reactive, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { 
    Search, School, User, ArrowRight, Loading,
    ArrowLeft, WarningFilled, Check, Refresh, CloseBold, Back
  } from '@element-plus/icons-vue'
  import { getMyClasses, getClassStudents } from '@/api/teacher/class'
  import { getTaskSubmissions, getSubmissionDetail, getSubmissionSourceArchive } from '@/api/student/task'
  import { getStudentTasks } from '@/api/teacher/task'
  import { getAiGradingResult, getAiGradingProcess, updateGradingDetail, confirmGrading, reGradeTask, batchConfirmGrading } from '@/api/teacher/grading'
  import request from '@/utils/request'

  import StudentTaskList from './components/StudentTaskList.vue'
  import GradingPanel from './components/GradingPanel/index.vue'

  // --- 状态 ---
  const loadingClasses = ref(false)
  const classes = ref([])
  const classSearchQuery = ref('')
  const selectedClassId = ref(null)
  const currentClass = ref(null)

  const loadingStudents = ref(false)
  const students = ref([])
  const studentSearchQuery = ref('')
  const studentTaskMap = reactive({}) // 存储每个学生的任务数据 { studentId: { loading: bool, tasks: [] } }

  // 抽屉相关
  const drawerVisible = ref(false)
  const currentStudent = ref(null)
  const currentStudentTasks = ref([])
  const activeCaseNames = ref([])
  const currentTask = ref(null)
  const currentSubmission = ref(null)
  const aiLoading = ref(false)
  const aiResult = ref(null)
  const aiProcess = ref(null)
  const gradingDetails = ref([])
  const finalFeedback = ref('')
  const submitting = ref(false)
  const regrading = ref(false)
  const fileContent = ref('')
  const fileLoading = ref(false)
  const submissionAttachments = ref([]) // 分析任务附件列表
  const batchConfirming = ref(false)
  const activeSelectionToken = ref(0)

  // 布局状态
  const leftSidebarWidth = ref(260)
  const isLeftResizing = ref(false)

  const resetSubmissionPreviewState = () => {
    currentSubmission.value = null
    aiResult.value = null
    aiProcess.value = null
    gradingDetails.value = []
    finalFeedback.value = ''
    fileContent.value = ''
    submissionAttachments.value = []
  }

  const parseStructuredPayload = (value) => {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return null
    try {
      return JSON.parse(value)
    } catch (error) {
      return null
    }
  }

  const appendSubmissionAttachment = (attachments, attachment) => {
    const filePath = attachment?.filePath || attachment?.path || ''
    const fileName = attachment?.fileName || attachment?.name || ''
    if (!filePath && !fileName) return

    const exists = attachments.some(item =>
      (filePath && item.filePath === filePath) ||
      (!filePath && fileName && item.fileName === fileName)
    )
    if (exists) return

    attachments.push({
      fileName,
      filePath,
      fileType: attachment?.fileType || attachment?.type || '',
      fileSize: attachment?.fileSize || attachment?.size || 0
    })
  }

  const resolveSubmissionSnapshotContent = (submissionDetail, structuredPayload) => {
    const sourceSnapshotContent = structuredPayload?.sourceSnapshot?.content
    if (typeof sourceSnapshotContent === 'string' && sourceSnapshotContent.trim()) {
      return sourceSnapshotContent.trim()
    }

    const preview = typeof submissionDetail?.contentPreview === 'string'
      ? submissionDetail.contentPreview.trim()
      : ''
    return preview
  }

  const startLeftResize = (e) => {
    isLeftResizing.value = true
    const startX = e.clientX
    const startWidth = leftSidebarWidth.value
    
    const handleMouseMove = (e) => {
      const delta = e.clientX - startX
      const newWidth = startWidth + delta
      if (newWidth >= 200 && newWidth <= 500) {
        leftSidebarWidth.value = newWidth
      }
    }

    const handleMouseUp = () => {
      isLeftResizing.value = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }

  // --- 计算属性 ---
  const filteredClasses = computed(() => {
    if (!classSearchQuery.value) return classes.value
    const q = classSearchQuery.value.toLowerCase()
    return classes.value.filter(c => c.name.toLowerCase().includes(q))
  })

  const filteredStudents = computed(() => {
    if (!studentSearchQuery.value) return students.value
    const q = studentSearchQuery.value.toLowerCase()
    return students.value.filter(s => 
      (s.realName && s.realName.toLowerCase().includes(q)) || 
      (s.nickname && s.nickname.toLowerCase().includes(q)) || 
      (s.studentId && String(s.studentId).includes(q)) ||
      (s.username && s.username.toLowerCase().includes(q))
    )
  })

  const pendingCount = computed(() => {
    let count = 0
    Object.values(studentTaskMap).forEach(data => {
      // 待批改：AI评分通过(status=3)且分数>=60，等待教师确认
      // 注意：分数<60的已被AI自动打回(status=5)，不显示在待批改列表中
      if (data.tasks && data.tasks.some(t => t.status === 3 && t.score >= 60)) {
        count++
      }
    })
    return count
  })

  const gradedCount = computed(() => {
    let count = 0
    Object.values(studentTaskMap).forEach(data => {
      // 所有任务都验收通过
      if (data.tasks && data.tasks.every(t => t.status === 3) && data.tasks.length > 0) {
        count++
      }
    })
    return count
  })

  // 获取所有待批改的任务ID列表
  const pendingTaskIds = computed(() => {
    const ids = []
    Object.values(studentTaskMap).forEach(data => {
      if (data.tasks) {
        data.tasks.forEach(t => {
          // 待批改：AI评分通过(status=3)且分数>=60
          if (t.status === 3 && t.score >= 60) {
            ids.push(t.id)
          }
        })
      }
    })
    return ids
  })

  const buildCaseGroupKey = (task) => `${task.caseId || 0}::${task.caseName || '其他任务'}`

  const isNonCodeTask = computed(() => {
    const t = String(currentTask.value?.submissionType || '').toLowerCase()
    return !!t && !t.startsWith('code')
  })

  const groupedStudentTasks = computed(() => {
    const groups = {}
    currentStudentTasks.value.forEach(task => {
      const groupKey = buildCaseGroupKey(task)
      if (!groups[groupKey]) {
        groups[groupKey] = {
          caseId: task.caseId,
          caseName: task.caseName || '其他任务',
          tasks: []
        }
      }
      groups[groupKey].tasks.push(task)
    })
  
  return Object.keys(groups).map(groupKey => {
    const group = groups[groupKey]
    const tasks = group.tasks
    // Sort tasks by sequence if available
    tasks.sort((a, b) => (a.taskSequence || 0) - (b.taskSequence || 0))
    
    // 待批改：AI评分通过(status=3)且分数>=60，且教师还未确认
    const pending = tasks.filter(t => t.status === 3 && t.score >= 60 && !t.isConfirmed).length
    // 已完成：教师已确认（isConfirmed=1）
    const completed = tasks.filter(t => t.isConfirmed === 1).length
    
    return {
      key: groupKey,
      name: group.caseName,
      caseId: group.caseId,
      tasks,
      pendingCount: pending,
      completedCount: completed,
      totalCount: tasks.length
    }
  }).sort((a, b) => {
    // Put cases with pending tasks first
    if (a.pendingCount > 0 && b.pendingCount === 0) return -1
    if (a.pendingCount === 0 && b.pendingCount > 0) return 1
    return 0
  })
})

const isFilePreviewable = computed(() => {
  if (!currentSubmission.value?.fileName) return false
  const ext = currentSubmission.value.fileName.split('.').pop().toLowerCase()
  return ['js', 'vue', 'html', 'css', 'java', 'py', 'c', 'cpp', 'h', 'json', 'xml', 'sql', 'md', 'txt', 'log', 'yml', 'yaml'].includes(ext)
})

// 评分计算
const currentTotalScore = computed(() => gradingDetails.value.reduce((sum, item) => sum + (item.finalScore || 0), 0))

// 监听评分变化，实时同步到当前任务的score，保证数据一致性
watch(currentTotalScore, (newScore) => {
  if (currentTask.value) {
    currentTask.value.score = newScore
  }
}, { immediate: true })

// 导航计算
const currentIndex = computed(() => filteredStudents.value.findIndex(s => s.id === currentStudent.value?.id))
const hasPrevStudent = computed(() => currentIndex.value > 0)
const hasNextStudent = computed(() => currentIndex.value !== -1 && currentIndex.value < filteredStudents.value.length - 1)

// --- 方法 ---

const getAvatarColor = (name) => {
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#16a085', '#36cfc9']
  if (!name) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const getStudentPendingTask = (studentId) => {
  const tasks = studentTaskMap[studentId]?.tasks || []
  // 待批改：AI评分通过(status=3)且分数>=60，且教师还未确认
  return tasks.find(t => t.status === 3 && t.score >= 60 && !t.isConfirmed)
}

const isStudentFullyCompleted = (studentId) => {
  const tasks = studentTaskMap[studentId]?.tasks || []
  // 全部完成：所有任务均已教师确认（isConfirmed=1），且没有未处理的待确认任务
  if (tasks.length === 0) return false
  return tasks.every(t => t.isConfirmed === 1 || t.status === 5 || (t.status === 3 && t.score < 60))
}

const getStudentProgressText = (studentId) => {
  const tasks = studentTaskMap[studentId]?.tasks || []
  // 已确认完成的任务数量
  const completed = tasks.filter(t => t.isConfirmed === 1).length
  return `${completed} / ${tasks.length} 完成`
}

// 加载班级
const loadClasses = async () => {
  loadingClasses.value = true
  try {
    const res = await getMyClasses()
    classes.value = res.data || []
  } catch (error) {
    ElMessage.error('加载班级失败')
  } finally {
    loadingClasses.value = false
  }
}

// 选择班级
const handleSelectClass = async (cls) => {
  selectedClassId.value = cls.id
  currentClass.value = cls
  await refreshStudents()
}

// 刷新学生及任务
const refreshStudents = async () => {
  if (!selectedClassId.value) return
  loadingStudents.value = true
  students.value = []
  // 清空任务缓存
  Object.keys(studentTaskMap).forEach(key => delete studentTaskMap[key])
  
  try {
    const res = await getClassStudents(selectedClassId.value)
    students.value = res.data || []
    
    // 异步加载任务数据（分批处理以避免瞬间高并发）
    loadStudentTasksBatch(students.value)
  } catch (error) {
    ElMessage.error('加载学生失败')
  } finally {
    loadingStudents.value = false
  }
}

// 分批加载学生任务
const loadStudentTasksBatch = async (studentList) => {
  const batchSize = 5
  for (let i = 0; i < studentList.length; i += batchSize) {
    const batch = studentList.slice(i, i + batchSize)
    await Promise.all(batch.map(student => fetchStudentTasks(student.id)))
  }
}

const fetchStudentTasks = async (studentId) => {
  studentTaskMap[studentId] = { loading: true, tasks: [] }
  try {
    const res = await getStudentTasks(studentId)
    if (studentTaskMap[studentId]) {
      studentTaskMap[studentId].tasks = res.data || []
    }
  } catch (error) {
    console.error(`Failed to load tasks for student ${studentId}`, error)
  } finally {
    if (studentTaskMap[studentId]) {
      studentTaskMap[studentId].loading = false
    }
  }
}

// 打开抽屉
const openStudentDrawer = (student) => {
  currentStudent.value = student
  currentStudentTasks.value = studentTaskMap[student.id]?.tasks || []
  drawerVisible.value = true
  
  // 自动选择第一个待确认的任务（AI评分通过且>=60分且未确认）
  const pendingTask = currentStudentTasks.value.find(t => t.status === 3 && t.score >= 60 && !t.isConfirmed)
  if (pendingTask) {
    selectTask(pendingTask)
    activeCaseNames.value = [buildCaseGroupKey(pendingTask)]
  } else if (currentStudentTasks.value.length > 0) {
    const firstTask = currentStudentTasks.value[0]
    selectTask(firstTask)
    activeCaseNames.value = [buildCaseGroupKey(firstTask)]
  } else {
    activeSelectionToken.value += 1
    currentTask.value = null
    resetSubmissionPreviewState()
    aiLoading.value = false
    fileLoading.value = false
    activeCaseNames.value = []
  }
}

// 选择任务进行批改
const selectTask = async (task) => {
  const selectionToken = activeSelectionToken.value + 1
  activeSelectionToken.value = selectionToken
  currentTask.value = task
  aiLoading.value = true
  resetSubmissionPreviewState()
  fileLoading.value = false
  
  try {
    // 1. 获取提交记录
    const subRes = await getTaskSubmissions(task.id)
    if (selectionToken !== activeSelectionToken.value) return
    const subs = subRes.data || []
    currentSubmission.value = subs.length > 0 ? subs[0] : null
    
    // MCP模式：始终加载提交快照内容（包含源码与运行结果）
    if (currentSubmission.value?.id) {
      await loadFileContent(currentSubmission.value.id, selectionToken)
      if (selectionToken !== activeSelectionToken.value) return
    }
    
    // 2. 获取 AI 评分
    const aiRes = await getAiGradingResult(task.id)
    if (selectionToken !== activeSelectionToken.value) return
    aiResult.value = aiRes.data

    // 3. 获取评分过程快照
    const processRes = await getAiGradingProcess(task.id)
    if (selectionToken !== activeSelectionToken.value) return
    aiProcess.value = processRes.data
    
    if (aiResult.value) {
      finalFeedback.value = aiResult.value.overallFeedback || ''
      // 直接使用API返回的finalScore，不再重新计算
      gradingDetails.value = (aiResult.value.details || []).map(d => ({
        ...d,
        finalScore: d.finalScore ?? d.teacherScore ?? d.aiScore
      }))
      
      // 同步更新 currentTask.score，确保左侧列表和右侧详情分数一致
      const apiScore = aiResult.value.finalScore ?? aiResult.value.totalScore
      if (apiScore != null) {
        currentTask.value.score = apiScore
      }
    }
  } catch (error) {
    if (selectionToken !== activeSelectionToken.value) return
    aiProcess.value = null
    ElMessage.error('加载任务详情失败')
  } finally {
    if (selectionToken === activeSelectionToken.value) {
      aiLoading.value = false
    }
  }
}

// 切换学生
const prevStudent = () => {
  if (hasPrevStudent.value) {
    openStudentDrawer(filteredStudents.value[currentIndex.value - 1])
  }
}

const nextStudent = () => {
  if (hasNextStudent.value) {
    openStudentDrawer(filteredStudents.value[currentIndex.value + 1])
  }
}

// 提交评分
const submitGrading = async () => {
  if (!currentTask.value) return
  
  // 禁止对已打回的任务进行评分
  if (currentTask.value.status === 5) {
    ElMessage.warning('任务已打回，请等待学生重新提交后再进行评分')
    return
  }
  
  submitting.value = true
  try {
    const updatePromises = gradingDetails.value.map(item => 
      updateGradingDetail(item.id, {
        teacherScore: item.finalScore,
        teacherComment: item.teacherComment
      })
    )
    await Promise.all(updatePromises)
    await confirmGrading(currentTask.value.id, { overallFeedback: finalFeedback.value })
    
    // 同步更新本地状态，计数立即刷新
    if (currentTask.value) currentTask.value.isConfirmed = 1
    const _taskInMap = (studentTaskMap[currentStudent.value?.id]?.tasks || []).find(t => t.id === currentTask.value?.id)
    if (_taskInMap) _taskInMap.isConfirmed = 1
    
    ElMessage.success('评分已提交')

    
    // 自动跳转下一个（可选）
    // nextStudent()
  } catch (error) {
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const handleReGrade = async () => {
  if (!currentTask.value) return
  regrading.value = true
  try {
    await reGradeTask(currentTask.value.id)
    ElMessage.success('已触发重评，请稍候')
    setTimeout(() => selectTask(currentTask.value), 2000)
  } catch (error) {
    ElMessage.error('重评失败')
  } finally {
    regrading.value = false
  }
}

// 打回作业，要求学生重新提交
const handleRejectTask = async () => {
  if (!currentTask.value || !currentSubmission.value) {
    ElMessage.warning('没有可打回的提交记录')
    return
  }

  ElMessageBox.prompt('请输入打回原因，以便学生了解需要修改的内容：', '打回重做', {
    confirmButtonText: '确认打回',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '例如：代码逻辑有误，请重新检查...',
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return '打回原因不能为空'
      }
      return true
    }
  }).then(async ({ value }) => {
    try {
      await request.post(`/training/tasks/${currentTask.value.id}/reject`, {
        reason: value.trim()
      })
      
      ElMessage.success('已打回，学生需重新提交')
      
      // 重新获取该学生的任务列表以更新状态
      if (currentStudent.value) {
        await fetchStudentTasks(currentStudent.value.id)
        currentStudentTasks.value = studentTaskMap[currentStudent.value.id]?.tasks || []
        
        // 更新当前任务引用
        const updatedTask = currentStudentTasks.value.find(t => t.id === currentTask.value.id)
        if (updatedTask) {
          currentTask.value = updatedTask
        }
      }
      
      // 刷新任务详情
      await selectTask(currentTask.value)
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '打回失败')
    }
  }).catch(() => {
    // 用户取消
  })
}

// 批量确认所有待批改的任务
const handleBatchConfirm = async () => {
  if (pendingTaskIds.value.length === 0) {
    ElMessage.warning('没有待批改的任务')
    return
  }
  
  ElMessageBox.confirm(
    `确定要批量确认 ${pendingTaskIds.value.length} 个待批改任务吗？将采用AI评分结果作为最终成绩。`,
    '批量确认评分',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    batchConfirming.value = true
    try {
      const res = await batchConfirmGrading({
        taskIds: pendingTaskIds.value,
        overallFeedback: '批量确认，采用AI评分结果'
      })
      
      const { successCount, failCount } = res.data
      if (failCount === 0) {
        ElMessage.success(`批量确认成功，共 ${successCount} 个任务`)
      } else {
        ElMessage.warning(`批量确认完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      }
      
      // 刷新学生列表
      await refreshStudents()
    } catch (error) {
      ElMessage.error('批量确认失败')
    } finally {
      batchConfirming.value = false
    }
  }).catch(() => {
    // 用户取消
  })
}


// 采用AI评分（直接确认，不修改分数）
const handleAdoptAiScore = async () => {
  if (!currentTask.value || !aiResult.value) return
  
  // 禁止对已打回的任务进行评分
  if (currentTask.value.status === 5) {
    ElMessage.warning('任务已打回，请等待学生重新提交后再进行评分')
    return
  }
  
  try {
    submitting.value = true
    // 直接确认评分，不修改任何分数
    await confirmGrading(currentTask.value.id, { 
      overallFeedback: aiResult.value.overallFeedback || '采用AI评分结果'
    })
    
    // 同步更新本地状态，计数立即刷新
    if (currentTask.value) currentTask.value.isConfirmed = 1
    const _taskInMap2 = (studentTaskMap[currentStudent.value?.id]?.tasks || []).find(t => t.id === currentTask.value?.id)
    if (_taskInMap2) _taskInMap2.isConfirmed = 1
    
    ElMessage.success('已采用AI评分')
    
    // 刷新评分结果（会自动通过watch更新task.score）
    await selectTask(currentTask.value)
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const loadFileContent = async (submissionId, selectionToken = activeSelectionToken.value) => {
  fileLoading.value = true
  submissionAttachments.value = []
  try {
    const res = await getSubmissionDetail(submissionId)
    if (selectionToken !== activeSelectionToken.value) return
    console.log('提交详情响应:', res)
    if (res.code === 200) {
      const data = res.data || {}
      const structuredPayload = parseStructuredPayload(data.structuredPayload)
      const snapshot = resolveSubmissionSnapshotContent(data, structuredPayload)
      fileContent.value = snapshot || '// 暂无提交解析内容'
      console.log('文件内容长度:', fileContent.value.length)

      // 收集附件信息（非代码任务使用）
      const attachments = []
      if (data.fileName || data.filePath) {
        appendSubmissionAttachment(attachments, data)
      }
      // 尝试从 structuredPayload 中解析多附件列表
      if (structuredPayload) {
        const payloadAttachments = structuredPayload.attachments || structuredPayload.attachmentList || []
        payloadAttachments.forEach(att => appendSubmissionAttachment(attachments, att))
      }
      submissionAttachments.value = attachments
    } else {
      console.log('加载提交详情失败:', res.message)
      fileContent.value = '// 无法加载提交内容: ' + (res.message || '未知错误')
    }
  } catch (e) {
    if (selectionToken !== activeSelectionToken.value) return
    console.error('Failed to load file content', e)
    fileContent.value = '// 无法加载提交内容'
  } finally {
    if (selectionToken === activeSelectionToken.value) {
      fileLoading.value = false
    }
  }
}

const handleDownloadFile = async () => {
  if (!currentSubmission.value?.id) {
    ElMessage.warning('无法下载')
    return
  }

  try {
    const response = await getSubmissionSourceArchive(currentSubmission.value.id)
    const blob = response?.data instanceof Blob
      ? response.data
      : new Blob([response?.data], { type: 'application/zip' })

    const contentDisposition = response?.headers?.['content-disposition'] || ''
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
    const decodedFileName = utf8Match
      ? decodeURIComponent(utf8Match[1])
      : (plainMatch ? plainMatch[1] : null)

    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    const fallbackName = `submission-${currentSubmission.value.id}-source.zip`
    const legacyName = String(currentSubmission.value.fileName || '')
    const safeCurrentName = legacyName.toLowerCase().endsWith('.json') ? fallbackName : legacyName
    link.download = decodedFileName || safeCurrentName || fallbackName
    link.click()
    window.URL.revokeObjectURL(link.href)
  } catch (e) {
    console.error('Download failed', e)
    ElMessage.error('下载失败')
  }
}

onMounted(() => {
  loadClasses()
})
</script>

<style scoped lang="scss">
.grading-layout {
  display: flex;
  height: 100%;
  box-sizing: border-box;
  background: #fcfcfc;
  overflow: hidden;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-tag),
  :deep(.el-dialog__title) {
    font-size: 17px;
  }
}

/* 左侧班级列表 */
.sidebar {
  width: 240px;
  background: #ffffff;
  border-right: 1px solid #eef0f2;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  .sidebar-header {
    padding: 18px 16px 14px;
    border-bottom: 1px solid #eef2f7;
    .sidebar-title {
      margin: 0 0 12px 0;
      font-size: 27px;
      color: #1f2d3d;
      letter-spacing: 0.5px;
    }
  }

  .class-list {
    flex: 1;
    overflow: hidden;
    
    .class-item {
      padding: 12px 14px;
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      border-bottom: 1px solid #f4f7fb;
      border-left: 3px solid transparent;

      &:hover {
        background: #f7fbff;
        transform: translateX(2px);
      }
      &.active {
        background: linear-gradient(90deg, #ecf5ff 0%, #f5faff 100%);
        border-left-color: #409eff;
        .class-icon { background: #409eff; color: #fff; }
      }

        .class-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #f2f5fa;
        color: #909399;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 8px;
        font-size: 16px;
        transition: all 0.2s;
      }

      .class-info {
        flex: 1;
        overflow: hidden;
        .class-name {
          font-weight: 600;
          color: #243447;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .class-meta {
          font-size: 15px;
          color: #909399;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }

      .arrow-icon {
        color: #dcdfe6;
        font-size: 16px;
      }
    }
  }
}

/* 右侧主区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .empty-workspace {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    .placeholder-content {
      text-align: center;
      .icon-bg {
        width: 80px;
        height: 80px;
        background: #f0f2f5;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin: 0 auto 20px;
        color: #c0c4cc;
      }
    }
  }

  .workspace-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .workspace-header {
    height: 56px;
    padding: 0 20px;
    background: #fff;
    border-bottom: 1px solid #eef0f2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    z-index: 5;

    .header-left {
      .current-class-title {
        margin: 0 0 4px 0;
        font-size: 28px;
        color: #1f2d3d;
      }
      .class-stats {
        display: flex;
        gap: 8px;
        align-items: center;
      }
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .workspace-body {
    flex: 1;
    padding: 16px 18px;
    overflow: hidden;

    .student-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
      padding-bottom: 20px;
    }

    .student-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #eaf0f6;
      cursor: pointer;
      transition: all 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: studentCardEnter 0.45s ease both;
      animation-delay: calc(var(--stagger-index, 0) * 0.03s);

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 24px rgba(64, 158, 255, 0.12);
        border-color: #b9dbff;
      }

      .card-main {
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #f2f6fb;

        .student-avatar {
          flex-shrink: 0;
          font-size: 18px;
          font-weight: bold;
          color: #fff;
        }

        .student-details {
          overflow: hidden;
          .name {
            font-weight: 600;
            font-size: 18px;
            color: #243447;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .id {
            font-size: 15px;
            color: #909399;
          }
        }
      }

      .card-footer {
        padding: 8px 12px;
        background: #fbfdff;
        min-height: 36px;
        display: flex;
        align-items: center;

        .status-loading {
          font-size: 15px;
          color: #909399;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .task-status {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          
          .task-name {
            font-size: 15px;
            color: #606266;
            flex: 1;
          }
          
          .task-count {
            font-size: 15px;
            color: #67c23a;
          }
        }
        
        .no-task {
          font-size: 15px;
          color: #c0c4cc;
        }
      }
    }
  }
}

/* 抽屉样式优化 */
.grading-drawer-fullscreen {
  :deep(.el-drawer__body) {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: #f7f9fc;
  }
}

.drawer-header-float {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #e4e7ed;
  
  .header-container {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .back-btn {
      font-size: 18px;
      color: #606266;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      
      &:hover {
        background: #f0f2f5;
        color: #00b96b;
      }
    }
    
    .student-profile {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 10px;
      border-left: 1px solid #e4e7ed;
      
      .student-avatar {
        background: #e6f8f0;
        color: #00b96b;
        font-weight: 600;
        border: 1px solid #fff;
        box-shadow: 0 1px 4px rgba(0, 185, 107, 0.1);
          width: 28px;
          height: 28px;
          line-height: 28px;
          font-size: 14px;
      }
      
      .info-text {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 8px;
        
        .name {
          font-weight: 600;
          font-size: 17px;
          color: #2c3e50;
        }
        
        .id {
          font-size: 15px;
          color: #909399;
        }
      }
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .action-group {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .action-btn {
        border: none;
        padding: 0 10px;
        height: 28px;
        font-size: 15px;
        font-weight: 500;
        border-radius: 4px;
        transition: all 0.2s;
        
        .el-icon { margin-right: 4px; }
        
        &.reject-btn {
          background: #fef0f0;
          color: #f56c6c;
          &:hover:not(:disabled) { background: #fde2e2; }
        }
        
        &.regrade-btn {
          background: #fdf6ec;
          color: #e6a23c;
          &:hover:not(:disabled) { background: #faecd8; }
        }
        
        &:disabled {
          background: #f5f7fa;
          color: #c0c4cc;
          cursor: not-allowed;
        }
      }
    }
    
    .nav-group {
      padding-left: 12px;
      border-left: 1px solid #e4e7ed;
      
      .nav-btn {
        height: 28px;
        padding: 0 10px;
        font-size: 15px;
        background: #fff;
        border: 1px solid #dcdfe6;
        color: #606266;
        
        &:hover:not(:disabled) {
          color: #00b96b;
          border-color: #00b96b;
          background: #f0f9f5;
        }
        
        &:first-child { border-radius: 4px 0 0 4px; }
        &:last-child { border-radius: 0 4px 4px 0; }
      }
    }
  }
}

.drawer-layout-flex {
  display: flex;
  height: 100%;
  padding-top: 44px; /* Space for fixed header */
  
  .layout-sidebar-left {
    /* width: 260px; Removed fixed width */
    border-right: none; /* Handled by resizer */
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  
  .layout-resizer {
    width: 4px;
    background: #eef2f7;
    cursor: col-resize;
    position: relative;
    z-index: 10;
    transition: background 0.2s;
    flex-shrink: 0;
    
    &:hover, &.is-resizing {
      background: #409eff;
    }
  }

  .layout-main {
    flex: 1;
    overflow: hidden;
    background: #fff;
  }
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.animate__animated {
  animation-duration: 0.5s;
  animation-fill-mode: both;
}
.animate__fadeInDown { animation-name: fadeInDown; }
.animate__fadeInUp { animation-name: fadeInUp; }

@keyframes studentCardEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translate3d(0, -20px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translate3d(0, 20px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
</style>
