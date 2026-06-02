<template>
  <div class="task-management-container">
    <!-- 顶部标题区 -->
    <div class="page-header animate__animated animate__fadeInDown">
      <div class="header-content">
          <div class="title-group">
            <div>
              <h2 class="page-title">任务分配中心</h2>
              <p class="page-subtitle">高效管理实训任务，支持统一指定与随机分配策略</p>
            </div>
          </div>
        <div class="header-actions">
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit" :disabled="selectionList.length === 0">
            <el-icon class="el-icon--left"><Check /></el-icon> 确认并提交分配
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主体内容区：左右分栏 -->
    <div class="main-content animate__animated animate__fadeInUp">
      <el-row :gutter="16" class="full-height-row">
        <!-- 左侧：学生名单 -->
        <el-col :span="9">
          <el-card shadow="hover" class="student-list-card">
            <template #header>
              <div class="card-header">
                <div class="left">
                  <span class="title">待分配学生</span>
                  <el-tag type="info" round size="small" class="count-tag">{{ selectionList.length }}人</el-tag>
                </div>
                <el-button type="primary" link :icon="Plus" @click="handleOpenStudentSelector">添加</el-button>
              </div>
            </template>
            
            <div class="student-list-wrapper">
              <el-empty v-if="selectionList.length === 0" description="请先添加学生" :image-size="100" />
              <el-scrollbar v-else height="calc(100% - 320px)">
                <div class="student-item" v-for="(student, index) in selectionList" :key="student.studentId">
                  <div class="student-info">
                    <el-avatar :size="32" :src="student.avatar">{{ student.studentName?.charAt(0) }}</el-avatar>
                    <div class="text">
                      <div class="name">{{ student.studentName }}</div>
                      <div class="sub">{{ student.studentId }}</div>
                    </div>
                  </div>
                  <div class="assign-status">
                    <el-tag v-if="student.caseId" type="success" size="small" effect="light">
                      {{ getCaseName(student.caseId) }}
                    </el-tag>
                    <el-tag v-else type="warning" size="small" effect="plain">未分配</el-tag>
                    <el-button type="danger" :icon="Delete" circle size="small" plain class="del-btn" @click="removeRow(index)" />
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </el-card>
        </el-col>

        <!-- 右侧：分配策略配置 -->
        <el-col :span="15">
          <el-card shadow="hover" class="config-card">
            <template #header>
              <span class="title">分配策略配置</span>
            </template>

            <div class="strategy-section">
              <div class="section-label">选择分配模式</div>
              <el-radio-group v-model="currentStrategy" size="large" class="strategy-radio-group">
                <el-radio-button label="batch">
                  <div class="radio-content">
                    <el-icon><Document /></el-icon> 统一指定
                  </div>
                </el-radio-button>
                <el-radio-button label="random">
                  <div class="radio-content">
                    <el-icon><MagicStick /></el-icon> 随机分配
                  </div>
                </el-radio-button>
              </el-radio-group>
            </div>

            <el-divider />

            <!-- 策略配置区域 -->
            <div class="config-area">
              <!-- 1. 统一指定 -->
              <div v-if="currentStrategy === 'batch'" class="strategy-form animate__animated animate__fadeIn">
                <el-alert title="所有选中的学生将使用同一个实训案例" type="info" :closable="false" show-icon class="mb-4" />
                <el-form label-position="top">
                  <el-form-item label="选择案例">
                    <el-select v-model="batchConfig.caseId" placeholder="请选择案例" filterable style="width: 100%" @change="applyBatchStrategy" :teleported="false">
                      <el-option v-for="c in cases" :key="c.id" :label="c.caseName" :value="c.id">
                        <span style="float: left">{{ c.caseName }}</span>
                      </el-option>
                    </el-select>
                  </el-form-item>
                </el-form>
              </div>

              <!-- 2. 随机分配 -->
              <div v-if="currentStrategy === 'random'" class="strategy-form animate__animated animate__fadeIn">
                <el-alert title="系统将只从公共案例池中随机为每位学生抽取一个已发布案例" type="warning" :closable="false" show-icon class="mb-4" />
                <div class="random-panel">
                  <div class="random-summary-bar">
                    <div class="summary-item">
                      <span class="summary-label">待分配学生</span>
                      <span class="summary-value">{{ selectionList.length }} 人</span>
                    </div>
                    <div class="summary-item">
                      <span class="summary-label">已选公共案例</span>
                      <span class="summary-value">{{ randomConfig.pool.length }} 个</span>
                    </div>
                    <div class="summary-item">
                      <span class="summary-label">公共案例总量</span>
                      <span class="summary-value">{{ cases.length }} 个</span>
                    </div>
                  </div>

                  <div class="random-actions">
                    <el-button
                      type="primary"
                      @click="openRandomCaseDialog"
                      :disabled="selectionList.length === 0 || cases.length === 0"
                    >
                      选择公共案例池
                    </el-button>
                    <el-button
                      plain
                      @click="applyRandomStrategy"
                      :loading="randomAssigning"
                      :disabled="selectionList.length === 0 || randomConfig.pool.length === 0"
                    >
                      <el-icon class="el-icon--left"><Refresh /></el-icon> 一键重新随机分配
                    </el-button>
                  </div>

                  <div v-if="selectedRandomCases.length" class="selected-case-preview">
                    <div class="preview-label">当前参与随机分配的公共案例</div>
                    <div class="preview-list">
                      <div
                        v-for="caseItem in selectedRandomCases.slice(0, 6)"
                        :key="caseItem.id"
                        class="preview-card"
                      >
                        <div class="preview-title">{{ caseItem.caseName }}</div>
                        <div class="preview-meta">
                          <span>{{ formatDateTime(caseItem.createdAt) || '未记录时间' }}</span>
                          <span>{{ getDifficultyText(caseItem.difficultyLevel) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="selectedRandomCases.length > 6" class="preview-more">
                      另有 {{ selectedRandomCases.length - 6 }} 个案例已加入公共案例池
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <el-divider />

            <!-- 全局设置 -->
            <div class="global-settings">
              <div class="section-label">其他设置</div>
              <el-form inline>
                <el-form-item label="截止时间">
                  <el-date-picker 
                    v-model="globalDeadline" 
                    type="datetime" 
                    placeholder="选择截止时间" 
                    :shortcuts="dateShortcuts"
                    style="width: 220px"
                    @change="applyGlobalDeadline"
                    :teleported="true"
                    placement="bottom-start"
                    popper-class="task-deadline-popper"
                  />
                </el-form-item>
              </el-form>
            </div>

          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 学生选择弹窗 -->
    <StudentSelector
      v-model:visible="studentDialogVisible"
      :class-list="classList"
      :all-students="allStudents"
      :initial-selected="selectionList"
      :loading="loadingStudents"
      @confirm="handleConfirmStudents"
    />

    <el-dialog
      v-model="randomCaseDialogVisible"
      title="随机分配公共案例池"
      width="980px"
      append-to-body
      class="random-case-dialog"
      :close-on-click-modal="false"
    >
      <div class="random-dialog-toolbar">
        <div class="toolbar-meta">
          <span>待分配学生 {{ selectionList.length }} 人</span>
          <span>公共案例 {{ cases.length }} 个</span>
          <span>已选 {{ randomConfig.pool.length }} 个</span>
        </div>
        <div class="toolbar-actions">
          <el-checkbox
            :model-value="allRandomCasesSelected"
            :indeterminate="randomConfig.pool.length > 0 && !allRandomCasesSelected"
            @change="handleToggleAllRandomCases"
          >
            一键全选
          </el-checkbox>
          <el-button link @click="clearRandomCaseSelection" :disabled="randomConfig.pool.length === 0">
            清空
          </el-button>
        </div>
      </div>

      <el-empty
        v-if="cases.length === 0"
        description="当前没有可用于随机分配的公共案例"
        :image-size="90"
      />
      <el-scrollbar v-else height="520px">
        <div class="random-case-grid">
          <div
            v-for="caseItem in cases"
            :key="caseItem.id"
            class="random-case-card"
            :class="{ selected: isRandomCaseSelected(caseItem.id) }"
            @click="toggleRandomCaseSelection(caseItem.id)"
          >
            <div class="card-top">
              <el-checkbox
                :model-value="isRandomCaseSelected(caseItem.id)"
                @click.stop
                @change="(checked) => setRandomCaseSelection(caseItem.id, checked)"
              />
              <el-tag :type="getDifficultyType(caseItem.difficultyLevel)" effect="plain" round size="small">
                {{ getDifficultyText(caseItem.difficultyLevel) }}
              </el-tag>
            </div>
            <div class="case-title">{{ caseItem.caseName }}</div>
            <div class="case-meta">
              <span>生成日期：{{ formatDateTime(caseItem.createdAt) || '暂无' }}</span>
            </div>
            <div v-if="getKeywordList(caseItem.keywords).length" class="case-tags">
              <el-tag
                v-for="tag in getKeywordList(caseItem.keywords)"
                :key="`${caseItem.id}-${tag}`"
                type="primary"
                effect="plain"
                size="small"
                round
              >
                {{ tag }}
              </el-tag>
            </div>
            <div class="case-desc">{{ getCaseSummary(caseItem) }}</div>
          </div>
        </div>
      </el-scrollbar>

      <template #footer>
        <el-button @click="randomCaseDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="randomAssigning"
          :disabled="selectionList.length === 0 || randomConfig.pool.length === 0"
          @click="applyRandomStrategy"
        >
          随机分配到当前学生
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Document, MagicStick, Check, Refresh } from '@element-plus/icons-vue'
import request from '@/utils/request'

import StudentSelector from './components/StudentSelector.vue'

// --- 状态管理 ---
const selectionList = ref([])
const cases = ref([])
const classList = ref([])
const allStudents = ref([])
const globalDeadline = ref('')
const submitting = ref(false)

// 策略相关
const currentStrategy = ref('batch') // batch, random
const batchConfig = reactive({
  caseId: null
})
const randomConfig = reactive({
  pool: []
})

// 弹窗控制
const studentDialogVisible = ref(false)
const randomCaseDialogVisible = ref(false)
const loadingStudents = ref(false)
const randomAssigning = ref(false)

const selectedRandomCases = computed(() => {
  if (!randomConfig.pool.length) return []
  const selectedIds = new Set(randomConfig.pool.map(id => Number(id)))
  return cases.value.filter(item => selectedIds.has(Number(item.id)))
})

const allRandomCasesSelected = computed(() => {
  return cases.value.length > 0 && randomConfig.pool.length === cases.value.length
})

const dateShortcuts = [
  { text: '今天', value: new Date() },
  { text: '明天', value: () => { const date = new Date(); date.setTime(date.getTime() + 3600 * 1000 * 24); return date } },
  { text: '一周后', value: () => { const date = new Date(); date.setTime(date.getTime() + 3600 * 1000 * 24 * 7); return date } },
]

// --- 生命周期 ---
onMounted(async () => {
  fetchCases()
  await fetchClasses()
  // 延迟加载所有学生，避免阻塞
  setTimeout(() => loadAllStudents(), 500)
})

// --- API 方法 ---
const fetchCases = async () => {
  try {
    const res = await request.get('/training/cases/published')
    cases.value = res.data || []
  } catch (error) {
    console.error('获取案例失败', error)
  }
}

const fetchClasses = async () => {
  try {
    const res = await request.get('/classes/my')
    classList.value = res.data || []
  } catch (error) {
    console.error('获取班级失败', error)
  }
}

const loadAllStudents = async () => {
  loadingStudents.value = true
  try {
    if (!classList.value || classList.value.length === 0) {
      allStudents.value = []
      return
    }
    const results = await Promise.all(
      classList.value.map(async (cls) => {
        const res = await request.get(`/classes/${cls.id}/students`)
        const students = res.data || []
        return students.map(s => ({
          ...s,
          userId: s.id,
          studentId: s.studentId,
          name: s.realName || s.username,
          studentName: s.realName || s.username,
          classId: cls.id,
          className: cls.className || cls.name,
          avatar: s.avatar
        }))
      })
    )
    allStudents.value = results.flat()
  } catch (error) {
    console.error('加载学生列表失败', error)
  } finally {
    loadingStudents.value = false
  }
}

// --- 业务逻辑 ---

const handleOpenStudentSelector = () => {
  studentDialogVisible.value = true
}

const openRandomCaseDialog = () => {
  if (selectionList.value.length === 0) {
    ElMessage.warning('请先添加学生，再选择公共案例池')
    return
  }
  randomCaseDialogVisible.value = true
}

const handleConfirmStudents = (selected) => {
  const newList = selected.map(s => {
    const existing = selectionList.value.find(old => old.studentId === s.studentId)
    if (existing) return existing
    return {
      studentId: s.studentId,
      userId: s.userId, // 确保有 userId
      studentName: s.studentName,
      className: s.className,
      avatar: s.avatar,
      caseId: null,
      deadline: globalDeadline.value || ''
    }
  })
  selectionList.value = newList
  ElMessage.success(`已更新学生列表，当前共 ${selectionList.value.length} 人`)
}

const removeRow = (index) => {
  selectionList.value.splice(index, 1)
}

const getCaseName = (id) => {
  const c = cases.value.find(i => i.id === id)
  return c ? c.caseName : '未知案例'
}

const getDifficultyText = (level) => {
  const map = { 1: '初级', 2: '中级', 3: '高级' }
  return map[Number(level)] || '未知难度'
}

const getDifficultyType = (level) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[Number(level)] || 'info'
}

const getKeywordList = (keywords) => {
  if (!keywords) return []
  return String(keywords)
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4)
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getCaseSummary = (caseItem) => {
  const summary = caseItem?.description || caseItem?.backgroundStory || '该公共案例可参与随机分配。'
  return summary.length > 88 ? `${summary.slice(0, 88)}...` : summary
}

const isRandomCaseSelected = (caseId) => {
  return randomConfig.pool.some(id => Number(id) === Number(caseId))
}

const setRandomCaseSelection = (caseId, checked) => {
  if (checked) {
    if (!isRandomCaseSelected(caseId)) {
      randomConfig.pool = [...randomConfig.pool, caseId]
    }
    return
  }
  randomConfig.pool = randomConfig.pool.filter(id => Number(id) !== Number(caseId))
}

const toggleRandomCaseSelection = (caseId) => {
  setRandomCaseSelection(caseId, !isRandomCaseSelected(caseId))
}

const handleToggleAllRandomCases = (checked) => {
  randomConfig.pool = checked ? cases.value.map(item => item.id) : []
}

const clearRandomCaseSelection = () => {
  randomConfig.pool = []
}

// 策略应用逻辑
const applyBatchStrategy = () => {
  if (!batchConfig.caseId) return
  selectionList.value.forEach(item => {
    item.caseId = batchConfig.caseId
  })
  ElMessage.success('已应用统一案例')
}

const applyRandomStrategy = async () => {
  if (selectionList.value.length === 0) {
    return ElMessage.warning('请先添加学生')
  }
  if (randomConfig.pool.length === 0) {
    return ElMessage.warning('请先选择参与随机分配的公共案例')
  }

  const studentIds = selectionList.value
    .map(item => item.userId)
    .filter(id => id !== null && id !== undefined)

  if (studentIds.length !== selectionList.value.length) {
    return ElMessage.error('学生信息不完整，请重新选择学生后再试')
  }

  randomAssigning.value = true
  try {
    const res = await request.post('/training/tasks/random-preview', {
      studentIds,
      caseIds: randomConfig.pool
    })

    const assignmentList = res.data || []
    const assignmentMap = new Map(
      assignmentList.map(item => [String(item.studentId), item.caseId])
    )

    if (assignmentMap.size !== selectionList.value.length) {
      throw new Error('后端返回的随机分配结果不完整')
    }

    selectionList.value = selectionList.value.map(item => ({
      ...item,
      caseId: assignmentMap.get(String(item.userId)) ?? item.caseId
    }))

    randomCaseDialogVisible.value = false
    ElMessage.success(`已为 ${assignmentMap.size} 名学生生成随机分配结果`)
  } catch (error) {
    ElMessage.error('随机分配失败：' + (error.message || '未知错误'))
  } finally {
    randomAssigning.value = false
  }
}

const applyGlobalDeadline = () => {
  if (!globalDeadline.value) return
  selectionList.value.forEach(item => {
    item.deadline = globalDeadline.value
  })
  ElMessage.success('已更新截止时间')
}

// 提交逻辑
const handleSubmit = async () => {
  const assignedList = selectionList.value.filter(item => item.caseId)

  if (assignedList.length === 0) {
    return ElMessage.warning('请先添加学生并分配案例')
  }

  // 检查是否有未分配的
  const unassigned = selectionList.value.filter(item => !item.caseId)
  if (unassigned.length > 0) {
    try {
      await ElMessageBox.confirm(`还有 ${unassigned.length} 名学生未分配案例，是否仅提交已分配的任务？`, '提示', {
        confirmButtonText: '仅提交已分配',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  submitting.value = true
  try {
    // 按 caseId + deadline 分组
    const groups = new Map()
    assignedList.forEach((item) => {
      const key = `${item.caseId}|${item.deadline}`
      if (!groups.has(key)) {
        groups.set(key, { caseId: item.caseId, deadline: item.deadline, studentIds: [] })
      }
      groups.get(key).studentIds.push(item.userId) // 注意用 userId
    })

    const requests = Array.from(groups.values()).map(g =>
      request.post('/training/tasks/assign', {
        caseId: g.caseId,
        studentIds: g.studentIds,
        deadline: g.deadline
      })
    )

    await Promise.all(requests)
    ElMessage.success(`成功分配 ${assignedList.length} 个任务`)
    selectionList.value = selectionList.value.filter(item => !item.caseId)
  } catch (error) {
    ElMessage.error('分配失败：' + (error.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.task-management-container {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  padding: 12px;
  background-color: #f8fafc;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 17px;

  :deep(.el-button) {
    font-size: 17px;
  }

  :deep(.el-tag) {
    font-size: 15px;
  }

  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-form-item__label),
  :deep(.el-radio-button__inner),
  :deep(.el-alert__title),
  :deep(.el-alert__description),
  :deep(.el-dialog__title),
  :deep(.el-checkbox) {
    font-size: 17px;
  }
}

.page-header {
  background: #fff;
  padding: 8px 16px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  flex-shrink: 0;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-group {
    display: flex;
    align-items: center;

    .page-title {
      margin: 0;
      font-size: 30px;
      font-weight: 600;
      color: #1e293b;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        display: block;
        width: 3px;
        height: 20px;
        background: #3b82f6;
        border-radius: 2px;
      }
    }

    .page-subtitle {
      margin: 2px 0 0;
      padding-left: 10px;
      font-size: 17px;
      color: #64748b;
    }
  }

  .header-actions {
    .el-button {
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.18);
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.full-height-row {
  flex: 1;
  display: flex;
  min-height: 0;
  margin: 0 !important;
  
  .el-col {
    display: flex;
    flex-direction: column;
  }
}

.student-list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: none;
  min-height: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(to right, #ffffff, #f8fafc);
  }

  :deep(.el-card__body) {
    flex: 1;
    padding: 0;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .left {
      display: flex;
      align-items: center;
      gap: 8px;
      .title {
        font-weight: 700;
        color: #0f172a;
      }
    }
  }

  .student-list-wrapper {
    height: 100%;
    padding: 10px;
  }

  .student-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 8px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 8px;
    transition: all 0.2s;

    &:hover {
      background: #f8fbff;
      border-color: #dbeafe;
    }

    .student-info {
      display: flex;
      align-items: center;
      gap: 8px;
      .text {
        .name { font-weight: 500; font-size: 17px; }
        .sub { font-size: 15px; color: #909399; }
      }
    }

    .assign-status {
      display: flex;
      align-items: center;
      gap: 4px;
      .del-btn {
        opacity: 0;
        transition: opacity 0.2s;
      }
    }

    &:hover .del-btn {
      opacity: 1;
    }
  }
}

.config-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: 10px;
  border: none;
  min-height: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(to right, #ffffff, #f8fafc);
  }

  :deep(.el-card__body) {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .title {
    font-weight: 700;
    font-size: 21px;
    color: #0f172a;
  }

  .strategy-section {
    margin-bottom: 16px;
    .section-label {
      font-size: 16px;
      color: #475569;
      margin-bottom: 8px;
      font-weight: 600;
    }
  }

  .strategy-radio-group {
    width: 100%;
    
    :deep(.el-radio-button) {
      flex: 1;

      .el-radio-button__inner {
        width: 100%;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #475569;
        box-shadow: none;
      }

      &:not(:first-child) .el-radio-button__inner,
      &:first-child .el-radio-button__inner {
        border-left: 1px solid #e2e8f0;
      }
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
    }

    :deep(.el-radio-button__inner:hover) {
      color: #2563eb;
      border-color: #bfdbfe;
    }

    :deep(.el-radio-button:first-child .el-radio-button__inner) {
      border-radius: 8px;
    }

    :deep(.el-radio-button:last-child .el-radio-button__inner) {
      border-radius: 8px;
    }

    :deep(.el-radio-button + .el-radio-button) {
      margin-left: 8px;
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner:hover) {
      color: #fff;
      border-color: transparent;
    }

    :deep(.el-radio-button .el-radio-button__inner::before),
    :deep(.el-radio-button .el-radio-button__inner::after) {
      display: none;
    }
  }

  .config-area {
    min-height: 200px;
    padding: 4px 0 8px;
    position: relative;
    z-index: 3;
  }

  .strategy-form {
    position: relative;
    z-index: 3;
  }

  .random-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .random-summary-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .summary-item {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  }

  .summary-label {
    display: block;
    margin-bottom: 6px;
    font-size: 15px;
    color: #64748b;
  }

  .summary-value {
    display: block;
    font-size: 23px;
    font-weight: 700;
    color: #0f172a;
  }

  .random-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .selected-case-preview {
    padding: 14px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .preview-label {
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 600;
    color: #475569;
  }

  .preview-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .preview-card {
    padding: 12px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }

  .preview-title {
    font-size: 18px;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.5;
  }

  .preview-meta {
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 15px;
    color: #64748b;
  }

  .preview-more {
    margin-top: 10px;
    font-size: 15px;
    color: #64748b;
  }

  .global-settings {
    position: relative;
    z-index: 1;

    .section-label {
      font-size: 16px;
      color: #475569;
      margin-bottom: 10px;
      font-weight: 600;
    }

    :deep(.el-form--inline) {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
    }

    :deep(.el-form-item) {
      margin-right: 0;
      margin-bottom: 0;
      align-items: center;
    }

    :deep(.el-form-item__label) {
      font-size: 16px;
      color: #64748b;
      font-weight: 500;
    }
  }

  .mb-4 {
    margin-bottom: 12px;
  }

  .radio-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  :deep(.el-select__popper),
  :deep(.el-picker__popper),
  :deep(.task-deadline-popper) {
    z-index: 3200 !important;
  }
}

:deep(.task-management-container .el-select__wrapper),
:deep(.task-management-container .el-input__wrapper) {
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  border-radius: 8px;
  background: #f8fafc;
}

:deep(.task-management-container .el-date-editor.el-input__wrapper:hover),
:deep(.task-management-container .el-select__wrapper:hover),
:deep(.task-management-container .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #bfdbfe inset;
}

:deep(.task-management-container .el-alert) {
  border-radius: 10px;
}

.random-dialog-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 2px;
}

.toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 16px;
  color: #475569;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.random-case-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 2px;
}

.random-case-card {
  padding: 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #bfdbfe;
    box-shadow: 0 10px 24px rgba(148, 163, 184, 0.12);
    transform: translateY(-1px);
  }

  &.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.18), 0 10px 24px rgba(59, 130, 246, 0.12);
    background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
  }
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.case-title {
  margin-top: 12px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.5;
}

.case-meta {
  margin-top: 8px;
  font-size: 15px;
  color: #64748b;
}

.case-tags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.case-desc {
  margin-top: 12px;
  font-size: 16px;
  line-height: 1.7;
  color: #475569;
}

:deep(.random-case-dialog .el-dialog) {
  border-radius: 18px;
  overflow: hidden;
}

:deep(.random-case-dialog .el-dialog__header) {
  padding: 18px 24px 12px;
  border-bottom: 1px solid #f1f5f9;
}

:deep(.random-case-dialog .el-dialog__body) {
  padding: 18px 24px;
}

:deep(.random-case-dialog .el-dialog__footer) {
  padding: 0 24px 22px;
}

@media (max-width: 1200px) {
  .full-height-row {
    display: block;
  }

  .full-height-row .el-col {
    max-width: 100%;
    flex: 0 0 100%;
    width: 100%;
    margin-bottom: 10px;
  }
}

@media (max-width: 768px) {
  .page-header .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .config-card {
    :deep(.el-form--inline) {
      display: block;
    }
  }

  .config-card .random-summary-bar,
  .preview-list,
  .random-case-grid {
    grid-template-columns: 1fr;
  }

  .random-dialog-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    justify-content: space-between;
  }
}
</style>
