<template>
  <div class="case-detail-container">
    <div class="page-header">
      <el-button @click="handleGoBack" icon="ArrowLeft" circle class="back-btn" />
      <div class="header-content">
        <h2 class="page-title">案例详情</h2>
        <div class="status-badge" v-if="caseDetail">
          <el-tag :type="getStatusType(caseDetail.status)" effect="dark" round>
            {{ getStatusText(caseDetail.status) }}
          </el-tag>
        </div>
      </div>
      <div class="header-actions" v-if="caseDetail">
        <el-button type="primary" plain icon="Edit" @click="handleEdit">编辑案例</el-button>
        <el-button type="danger" plain icon="Delete" @click="handleDelete">删除</el-button>
        <el-button 
          type="success" 
          icon="Promotion" 
          :disabled="caseDetail.status !== 1" 
          @click="handlePublish"
        >
          发布案例
        </el-button>
      </div>
    </div>

    <div class="content-layout" v-if="caseDetail">
      <!-- 左侧：主要内容 -->
      <div class="left-panel">
        <!-- 概览卡片 -->
        <el-card shadow="never" class="overview-card">
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="label">难度等级</div>
              <div class="value">
                <el-rate v-model="caseDetail.difficultyLevel" disabled show-score text-color="#ff9900" />
              </div>
            </div>
            <div class="metric-item">
              <div class="label">预计耗时</div>
              <div class="value">{{ caseDetail.estimatedHours || 3 }} 小时</div>
            </div>
            <div class="metric-item">
              <div class="label">关键词</div>
              <div class="value tags">
                <el-tag v-for="tag in (caseDetail.keywords ? caseDetail.keywords.split(',') : [])" :key="tag" size="small" effect="plain">
                  {{ tag }}
                </el-tag>
              </div>
            </div>
            <div class="metric-item">
              <div class="label">生成时间</div>
              <div class="value">{{ formatDateTime(caseDetail.createdAt) }}</div>
            </div>
          </div>
        </el-card>

        <!-- 背景故事 -->
        <el-card shadow="never" class="story-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><Reading /></el-icon> 背景故事</span>
            </div>
          </template>
          <div class="story-content">
            {{ caseDetail.backgroundStory }}
          </div>
        </el-card>

        <!-- 任务清单 -->
        <el-card shadow="never" class="tasks-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><List /></el-icon> 任务清单</span>
            </div>
          </template>
          <div class="task-list">
            <div v-for="(task, index) in taskTree" :key="index" class="task-item">
              <div class="task-index">{{ index + 1 }}</div>
              <div class="task-content">{{ task.label }}</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧：数据预览 -->
      <div class="right-panel">
        <el-card shadow="never" class="data-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><DataLine /></el-icon> 数据预览</span>
            </div>
          </template>
          
          <el-tabs class="data-tabs">
            <el-tab-pane label="模拟数据">
              <div class="code-block">
                <pre>{{ formatJson(caseDetail.mockData) }}</pre>
              </div>
            </el-tab-pane>
            <el-tab-pane label="预期输出">
              <div class="code-block">
                <pre>{{ formatJson(caseDetail.expectedOutput) }}</pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>
    
    <el-skeleton v-else :rows="10" animated />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Promotion, Reading, List, DataLine, Edit } from '@element-plus/icons-vue'
import { getCaseDetail, publishCase, deleteCase } from '@/api/teacher/case'
import { getAuthUserId } from '@/utils/authStorage.js'

const route = useRoute()
const router = useRouter()

const userId = ref(getAuthUserId('TEACHER') || '1')
const loading = ref(false)
const caseDetail = ref<any>(null)

const loadCase = async () => {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const res = await getCaseDetail(id)
    caseDetail.value = res.data
  } catch (e) {
    ElMessage.error('加载案例详情失败')
    caseDetail.value = null
  } finally {
    loading.value = false
  }
}

const taskTree = computed(() => {
  try {
    const tasks = JSON.parse(caseDetail.value?.taskList || '[]')
    return tasks.map((t: any, idx: number) => ({
      id: idx,
      label: `${t.title || '任务' + (idx + 1)}: ${t.description || ''}`
    }))
  } catch {
    return []
  }
})

const getStatusText = (status: number) => {
  const map: Record<number, string> = { 1: '草稿', 2: '已发布', 3: '已归档' }
  return map[status] || '未知'
}

const getStatusType = (status: number) => {
  const map: Record<number, string> = { 1: 'info', 2: 'success', 3: 'warning' }
  return map[status] || 'info'
}

const formatJson = (jsonStr: string) => {
  try {
    if (!jsonStr) return '{}'
    const obj = JSON.parse(jsonStr)
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

const formatDateTime = (val: any) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const handlePublish = async () => {
  if (!caseDetail.value) return
  try {
    await publishCase(caseDetail.value.id)
    ElMessage.success('发布成功')
    await loadCase()
  } catch (e) {
    ElMessage.error('发布失败')
  }
}

const handleDelete = () => {
  if (!caseDetail.value) return
  
  ElMessageBox.confirm(
    '确定要删除该案例吗？此操作不可恢复。',
    '警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await deleteCase(caseDetail.value.id)
      ElMessage.success('删除成功')
      router.push('/teacher/cases')
    } catch (e) {
      ElMessage.error('删除失败')
    }
  })
}

const handleEdit = () => {
  if (!caseDetail.value) return
  router.push(`/teacher/cases/${caseDetail.value.id}/edit`)
}

const handleGoBack = () => {
  router.back()
}

onMounted(() => {
  loadCase()
})
</script>

<style scoped lang="scss">
.case-detail-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  
  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    
    .back-btn {
      border: none;
      background: transparent;
      font-size: 18px;
      &:hover {
        background: #f0f2f5;
      }
    }
    
    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      
      .page-title {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        margin: 0;
      }
    }
  }
}

.content-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  align-items: start;
}

.overview-card {
  margin-bottom: 16px;
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    
    .metric-item {
      .label {
        font-size: 12px;
        color: #909399;
        margin-bottom: 8px;
      }
      .value {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        
        &.tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
      }
    }
  }
}

.story-card, .tasks-card, .data-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  margin-bottom: 16px;
  
  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .card-header {
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #303133;
      font-size: 14px;
    }
  }
}

.story-content {
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
  white-space: pre-wrap;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .task-item {
    display: flex;
    gap: 12px;
    
    .task-index {
      width: 24px;
      height: 24px;
      background: #eff6ff;
      color: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .task-content {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
    }
  }
}

.code-block {
  background: #f8fafc;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  max-height: 400px;
  overflow: auto;
  
  pre {
    margin: 0;
    font-family: 'Consolas', monospace;
    font-size: 12px;
    color: #475569;
  }
}
</style>
