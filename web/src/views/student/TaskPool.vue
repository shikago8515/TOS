<template>
  <div class="task-pool-container">
    <!-- 顶部导航与筛选区 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">任务池</h2>
        <span class="page-subtitle">探索并领取感兴趣的实训案例</span>
      </div>
      <div class="header-right">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索案例名称或关键词..." 
          prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select v-model="filterDifficulty" placeholder="难度等级" clearable class="filter-select" :teleported="false">
          <el-option :value="1" label="入门">
            <span style="float: left">入门</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px;">
              <el-icon><Star /></el-icon>
            </span>
          </el-option>
          <el-option :value="2" label="进阶">
            <span style="float: left">进阶</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px;">
              <el-icon><Connection /></el-icon>
            </span>
          </el-option>
          <el-option :value="3" label="挑战">
            <span style="float: left">挑战</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px;">
              <el-icon><Trophy /></el-icon>
            </span>
          </el-option>
        </el-select>
        <el-select v-model="filterStatus" placeholder="领取状态" clearable class="filter-select" :teleported="false">
          <el-option value="unclaimed" label="未领取" />
          <el-option value="claimed" label="已领取" />
        </el-select>
        <el-date-picker
          v-model="caseDateRange"
          type="daterange"
          unlink-panels
          range-separator="至"
          start-placeholder="案例开始日期"
          end-placeholder="案例结束日期"
          value-format="YYYY-MM-DD"
          class="filter-select date-filter"
          clearable
          :teleported="false"
        />
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">全部案例</span>
        <span class="stat-value">{{ cases.length }}</span>
      </div>
      <div class="stat-item unclaimed">
        <span class="stat-label">可领取</span>
        <span class="stat-value">{{ unclaimedCases.length }}</span>
      </div>
      <div class="stat-item claimed">
        <span class="stat-label">已领取</span>
        <span class="stat-value">{{ claimedCases.length }}</span>
      </div>
    </div>

    <!-- 案例列表区域 -->
    <div class="case-grid-wrapper" v-loading="loading">
      <!-- 未领取案例区域 -->
      <div v-if="showUnclaimedSection && filteredUnclaimedCases.length > 0" class="case-section">
        <div class="section-header">
          <h3><el-icon><Opportunity /></el-icon> 可领取案例</h3>
          <span class="section-count">{{ filteredUnclaimedCases.length }} 个</span>
        </div>
        <div class="case-grid">
          <div 
            v-for="caseItem in filteredUnclaimedCases" 
            :key="caseItem.id" 
            class="case-card"
          >
            <div class="card-content">
              <div class="card-header">
                <div class="difficulty-tag" :class="`level-${caseItem.difficultyLevel}`">
                  <el-icon class="mr-1"><component :is="getDifficultyIcon(caseItem.difficultyLevel)" /></el-icon>
                  {{ getDifficultyLabel(caseItem.difficultyLevel) }}
                </div>
                <h3 class="case-title" :title="caseItem.caseName">{{ caseItem.caseName }}</h3>
              </div>
              
              <p class="case-desc">
                {{ truncateText(caseItem.backgroundStory || caseItem.description, 70) }}
              </p>
              
              <div class="case-tags">
                <span v-for="tag in getTags(caseItem.keywords)" :key="tag" class="tag-item">#{{ tag }}</span>
              </div>
              
              <div class="card-footer">
                <div class="meta-info">
                  <span class="meta-item"><el-icon><Timer /></el-icon> {{ caseItem.estimatedHours || 3 }}课时</span>
                  <span class="meta-item"><el-icon><Calendar /></el-icon> {{ formatCaseDate(caseItem.createdAt) }}</span>
                </div>
                <div class="action-group">
                  <el-button text bg size="small" @click="handleViewDetail(caseItem)">详情</el-button>
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="handleClaim(caseItem)"
                    :loading="claimingId === caseItem.id"
                  >
                    领取
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 已领取案例区域 -->
      <div v-if="showClaimedSection && filteredClaimedCases.length > 0" class="case-section claimed-section">
        <div class="section-header">
          <h3><el-icon><Check /></el-icon> 已领取案例</h3>
          <span class="section-count">{{ filteredClaimedCases.length }} 个</span>
        </div>
        <div class="case-grid">
          <div 
            v-for="caseItem in filteredClaimedCases" 
            :key="caseItem.id" 
            class="case-card is-claimed"
          >
            <div class="card-status-badge">
              <el-icon><Check /></el-icon> 已领取
            </div>
            
            <div class="card-content">
              <div class="card-header">
                <div class="difficulty-tag" :class="`level-${caseItem.difficultyLevel}`">
                  <el-icon class="mr-1"><component :is="getDifficultyIcon(caseItem.difficultyLevel)" /></el-icon>
                  {{ getDifficultyLabel(caseItem.difficultyLevel) }}
                </div>
                <h3 class="case-title" :title="caseItem.caseName">{{ caseItem.caseName }}</h3>
              </div>
              
              <p class="case-desc">
                {{ truncateText(caseItem.backgroundStory || caseItem.description, 70) }}
              </p>
              
              <div class="case-tags">
                <span v-for="tag in getTags(caseItem.keywords)" :key="tag" class="tag-item">#{{ tag }}</span>
              </div>
              
              <div class="card-footer">
                <div class="meta-info">
                  <span class="meta-item"><el-icon><Timer /></el-icon> {{ caseItem.estimatedHours || 3 }}课时</span>
                  <span class="meta-item"><el-icon><Calendar /></el-icon> {{ formatCaseDate(caseItem.createdAt) }}</span>
                </div>
                <div class="action-group">
                  <el-button text bg size="small" @click="handleViewDetail(caseItem)">详情</el-button>
                  <el-button type="success" size="small" @click="goToMyTasks">
                    <el-icon><Right /></el-icon> 去完成
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="!loading && filteredUnclaimedCases.length === 0 && filteredClaimedCases.length === 0" 
                description="暂无符合条件的案例" :image-size="120" />
    </div>

    <!-- 案例详情弹窗 -->
    <el-dialog 
      v-model="detailVisible" 
      :title="currentCase?.caseName" 
      width="900px"
      :teleported="false"
      class="case-detail-dialog"
      destroy-on-close
      top="8vh"
    >
      <div class="detail-content" v-if="currentCase">
        <div class="detail-header-meta">
          <el-tag :type="getDifficultyType(currentCase.difficultyLevel)" effect="dark">
            <el-icon style="vertical-align: middle; margin-right: 4px"><component :is="getDifficultyIcon(currentCase.difficultyLevel)" /></el-icon>
            {{ getDifficultyLabel(currentCase.difficultyLevel) }}
          </el-tag>
          <span class="meta-divider">|</span>
          <span class="meta-text"><el-icon><Timer /></el-icon> {{ currentCase.estimatedHours || 3 }} 小时</span>
          <span class="meta-divider">|</span>
          <span class="meta-text"><el-icon><Calendar /></el-icon> {{ formatDateTime(currentCase.createdAt) }}</span>
          <span class="meta-divider">|</span>
          <span class="meta-text">关键词: {{ currentCase.keywords }}</span>
        </div>

        <div class="detail-two-column">
          <div class="detail-section">
            <h4><el-icon><Reading /></el-icon> 背景故事</h4>
            <div class="story-box custom-scrollbar">
              <p class="story-text">{{ currentCase.backgroundStory || currentCase.description }}</p>
            </div>
          </div>
          
          <div class="detail-section" v-if="currentTaskList.length > 0">
            <h4><el-icon><List /></el-icon> 任务预览</h4>
            <div class="task-list custom-scrollbar">
              <div v-for="(task, index) in currentTaskList" :key="index" class="task-item">
                <span class="task-num">{{ index + 1 }}</span>
                <div class="task-content">
                  <div class="task-title">{{ task.title }}</div>
                  <div class="task-desc" v-if="task.description">{{ task.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button 
            v-if="currentCase && !claimedMap[currentCase.id]"
            type="primary" 
            @click="handleClaimFromDialog"
            :loading="claimingId === currentCase?.id"
          >
            立即领取
          </el-button>
          <el-button v-else type="success" @click="goToMyTasks">
            <el-icon><Right /></el-icon> 去完成任务
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 领取确认弹窗 -->
    <el-dialog v-model="claimDialogVisible" title="确认领取任务" width="450px" align-center :teleported="false">
      <div class="claim-form">
        <div class="claim-alert">
          <el-icon class="alert-icon"><WarningFilled /></el-icon>
          <div class="alert-content">
            <p class="alert-title">领取须知</p>
            <p class="alert-desc">领取后系统将为您生成独立的任务实例。请合理安排时间，在截止日期前完成提交。</p>
          </div>
        </div>
        <el-form label-position="top">
          <el-form-item label="设置截止时间（可选）">
            <el-date-picker
              v-model="claimDeadline"
              type="datetime"
              placeholder="默认7天后截止"
              class="full-width"
              :disabled-date="disabledDate"
              :teleported="false"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="claimDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmClaim" :loading="claiming">确认领取</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Timer, Check, Reading, List, Search, WarningFilled,
  Star, Connection, Trophy, Opportunity, Right, Calendar
} from '@element-plus/icons-vue'
import { getPublishedCases, claimTask, checkClaimed } from '@/api/student/task'

const router = useRouter()

const loading = ref(false)
const cases = ref([])
const claimedMap = ref({}) // 记录已领取的案例
const claimingId = ref(null)

// 筛选
const searchKeyword = ref('')
const filterDifficulty = ref(null)
const filterStatus = ref(null) // 'claimed' | 'unclaimed' | null
const caseDateRange = ref([])

// 详情弹窗
const detailVisible = ref(false)
const currentCase = ref(null)
const currentTaskList = ref([])

// 领取弹窗
const claimDialogVisible = ref(false)
const claimDeadline = ref(null)
const claiming = ref(false)
const pendingClaimCase = ref(null)

// 分组计算
const claimedCases = computed(() => cases.value.filter(c => claimedMap.value[c.id]))
const unclaimedCases = computed(() => cases.value.filter(c => !claimedMap.value[c.id]))

// 是否显示各区域
const showClaimedSection = computed(() => filterStatus.value !== 'unclaimed')
const showUnclaimedSection = computed(() => filterStatus.value !== 'claimed')

// 筛选后的案例
const filteredUnclaimedCases = computed(() => {
  return unclaimedCases.value.filter(c => matchesFilter(c))
})

const filteredClaimedCases = computed(() => {
  return claimedCases.value.filter(c => matchesFilter(c))
})

const matchesFilter = (c) => {
  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    const matchName = c.caseName?.toLowerCase().includes(keyword)
    const matchKeywords = c.keywords?.toLowerCase().includes(keyword)
    if (!matchName && !matchKeywords) return false
  }
  // 难度筛选
  if (filterDifficulty.value && c.difficultyLevel !== filterDifficulty.value) {
    return false
  }

  if (caseDateRange.value && caseDateRange.value.length === 2) {
    const [startDate, endDate] = caseDateRange.value
    const startTime = new Date(`${startDate} 00:00:00`).getTime()
    const endTime = new Date(`${endDate} 23:59:59`).getTime()
    const caseTime = new Date(c.createdAt).getTime()
    if (Number.isNaN(caseTime) || caseTime < startTime || caseTime > endTime) {
      return false
    }
  }

  return true
}

const formatDateTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatCaseDate = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const loadCases = async () => {
  loading.value = true
  try {
    const res = await getPublishedCases()
    cases.value = res.data || []
    
    // 批量检查领取状态
    const checkPromises = cases.value.map(async (c) => {
      try {
        const checkRes = await checkClaimed(c.id)
        return { id: c.id, claimed: checkRes.data === true }
      } catch {
        return { id: c.id, claimed: false }
      }
    })
    
    const results = await Promise.all(checkPromises)
    const newClaimedMap = {}
    results.forEach(r => {
      newClaimedMap[r.id] = r.claimed
    })
    claimedMap.value = newClaimedMap
  } catch (e) {
    ElMessage.error('加载案例列表失败')
  } finally {
    loading.value = false
  }
}

const getDifficultyLabel = (level) => {
  const map = { 1: '入门', 2: '进阶', 3: '挑战' }
  return map[level] || '未知'
}

const getDifficultyIcon = (level) => {
  const map = { 1: Star, 2: Connection, 3: Trophy }
  return map[level] || Star
}

const getDifficultyType = (level) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[level] || 'info'
}

const getTags = (keywords) => {
  if (!keywords) return []
  return keywords.split(/[,，]/).map(k => k.trim()).filter(k => k).slice(0, 3)
}

const truncateText = (text, maxLen) => {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

const disabledDate = (date) => {
  return date.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

const handleViewDetail = async (caseItem) => {
  currentCase.value = caseItem
  try {
    currentTaskList.value = JSON.parse(caseItem.taskList || '[]')
  } catch {
    currentTaskList.value = []
  }
  detailVisible.value = true
}

const handleClaim = (caseItem) => {
  pendingClaimCase.value = caseItem
  claimDeadline.value = null
  claimDialogVisible.value = true
}

const handleClaimFromDialog = () => {
  if (currentCase.value) {
    pendingClaimCase.value = currentCase.value
    claimDeadline.value = null
    detailVisible.value = false
    claimDialogVisible.value = true
  }
}

const confirmClaim = async () => {
  if (!pendingClaimCase.value) return
  
  claiming.value = true
  claimingId.value = pendingClaimCase.value.id
  
  try {
    await claimTask({
      caseId: pendingClaimCase.value.id,
      deadline: claimDeadline.value
    })
    
    ElMessage.success('任务领取成功！')
    claimedMap.value[pendingClaimCase.value.id] = true
    claimDialogVisible.value = false
    
    // 跳转到我的任务列表
    router.push('/student/tasks')
  } catch (e) {
    ElMessage.error(e.message || '领取失败')
  } finally {
    claiming.value = false
    claimingId.value = null
  }
}

const goToMyTasks = () => {
  detailVisible.value = false
  router.push('/student/tasks')
}

onMounted(() => {
  loadCases()
})
</script>

<style scoped lang="scss">
.task-pool-container {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
  
  .header-left {
    .page-title {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 8px 0;
    }
    .page-subtitle {
      font-size: 14px;
      color: #64748b;
    }
  }
  
  .header-right {
    display: flex;
    gap: 12px;
    
    .search-input {
      width: 260px;
    }

    .filter-select {
      width: 120px;
    }

    .date-filter {
      width: 240px;
    }
  }
}

.stats-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 12px;
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .stat-label {
      font-size: 14px;
      color: #64748b;
    }
    
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }
    
    &.unclaimed .stat-value {
      color: #3b82f6;
    }
    
    &.claimed .stat-value {
      color: #10b981;
    }
  }
}

.case-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.case-section {
  margin-bottom: 40px;
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #3b82f6;
    
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-count {
      font-size: 14px;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 10px;
      border-radius: 12px;
    }
  }
  
  &.claimed-section .section-header {
    border-bottom-color: #10b981;
  }
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.case-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.1);
    border-color: #cbd5e1;
  }
  
  &.is-claimed {
    background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    border-color: #bbf7d0;
    
    .case-title {
      color: #166534;
    }
    
    &:hover {
      border-color: #86efac;
    }
  }
  
  .card-status-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 1;
  }
  
  .card-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .card-header {
    margin-bottom: 12px;
    
    .difficulty-tag {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      
      &.level-1 { background: #ecfdf5; color: #059669; }
      &.level-2 { background: #fff7ed; color: #ea580c; }
      &.level-3 { background: #fef2f2; color: #dc2626; }
    }
    
    .case-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
  
  .case-desc {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    margin: 0 0 16px;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .case-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
    
    .tag-item {
      font-size: 12px;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
    }
  }
  
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
    
    .meta-info {
      display: flex;
      gap: 12px;
      
      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #94a3b8;
      }
    }
    
    .action-group {
      display: flex;
      gap: 8px;
    }
  }
}

// 详情弹窗样式
.detail-header-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  
  .meta-divider {
    color: #cbd5e1;
  }
  
  .meta-text {
    color: #64748b;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.detail-two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  height: 55vh; /* 固定高度，防止弹窗整体滚动 */
  min-height: 400px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  height: 100%;
  overflow: hidden;
  
  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .story-box {
    background: #f8fafc;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #f1f5f9;
    flex: 1;
    overflow-y: auto;
    
    .story-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.8;
      color: #475569;
      white-space: pre-wrap;
    }
  }
  
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
    
    .task-item {
      display: flex;
      gap: 16px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      flex-shrink: 0;
      
      .task-num {
        width: 24px;
        height: 24px;
        background: #eff6ff;
        color: #3b82f6;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }
      
      .task-content {
        .task-title {
          font-weight: 500;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .task-desc {
          font-size: 13px;
          color: #64748b;
        }
      }
    }
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.claim-form {
  .claim-alert {
    display: flex;
    gap: 12px;
    background: #fff7ed;
    border: 1px solid #ffedd5;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    
    .alert-icon {
      color: #ea580c;
      font-size: 20px;
      margin-top: 2px;
    }
    
    .alert-content {
      .alert-title {
        font-weight: 600;
        color: #9a3412;
        margin: 0 0 4px;
        font-size: 14px;
      }
      .alert-desc {
        margin: 0;
        color: #c2410c;
        font-size: 13px;
        line-height: 1.5;
      }
    }
  }
  
  .full-width {
    width: 100%;
  }
}
</style>
