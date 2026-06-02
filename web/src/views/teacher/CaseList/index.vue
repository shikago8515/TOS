<template>
  <div class="case-list-container page-container">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">案例库管理</h2>
        <p class="page-subtitle">管理所有教学案例，查看学生完成情况</p>
      </div>
      <div class="header-right">
        <el-button 
          v-if="activeTab === 'personalized'"
          type="info" 
          plain 
          @click="handleSelectAll"
          class="mr-3"
          size="small"
        >
          <el-icon class="mr-1"><Select /></el-icon> 全选当前页
        </el-button>
        <el-button 
          v-if="publishableCases.length > 0" 
          type="success" 
          plain 
          @click="handleBatchPublish"
          :loading="batchPublishing"
          class="mr-3"
          size="small"
        >
          <el-icon class="mr-1"><Upload /></el-icon> 批量发布 ({{ publishableCases.length }})
        </el-button>
        <el-button 
          v-if="withdrawableCases.length > 0" 
          type="warning" 
          plain 
          @click="handleBatchWithdraw"
          :loading="batchWithdrawing"
          class="mr-3"
          size="small"
        >
          <el-icon class="mr-1"><Download /></el-icon> 批量撤回 ({{ withdrawableCases.length }})
        </el-button>
        <el-button 
          v-if="selectedCases.length > 0" 
          type="danger" 
          plain 
          @click="handleBatchDelete"
          class="mr-3"
          size="small"
        >
          <el-icon class="mr-1"><Delete /></el-icon> 批量删除 ({{ selectedCases.length }})
        </el-button>
        <el-button type="primary" size="small" @click="handleCreate" class="create-btn">
          <el-icon class="mr-2"><Plus /></el-icon> 新建案例
        </el-button>
      </div>
    </div>

    <div class="resource-overview-grid">
      <div class="overview-card">
        <span class="overview-label">我的案例</span>
        <strong>{{ formatMetric(resourceOverview.totalCases) }}</strong>
        <small>教师私有与公共案例总数</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">已发布案例</span>
        <strong>{{ formatMetric(resourceOverview.publishedCases) }}</strong>
        <small>可复用、可分享的教学资源</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">优秀案例</span>
        <strong>{{ formatMetric(resourceOverview.featuredCases) }}</strong>
        <small>按质量分与复用表现筛出的优质案例</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">复用副本</span>
        <strong>{{ formatMetric(resourceOverview.reuseCopies) }}</strong>
        <small>跨教师复制沉淀出的二次案例数量</small>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="case-tabs">
      <!-- 公共案例库 -->
      <el-tab-pane label="公共案例库" name="public">
        <template #label>
          <span class="custom-tab-label">
            <el-icon><Collection /></el-icon>
            <span>公共案例库</span>
          </span>
        </template>

        <div class="public-view-switch">
          <el-radio-group v-model="publicSubView" size="small">
            <el-radio-button label="cases">公共案例视图</el-radio-button>
            <el-radio-button label="insights">附属榜单视图</el-radio-button>
          </el-radio-group>
        </div>

        <PublicCaseTable
          v-if="publicSubView === 'cases'"
          ref="publicTableRef"
          :cases="publicCases"
          :loading="loading"
          :server-total="publicPagination.total"
          :current-page="publicPagination.page"
          :page-size="publicPagination.size"
          @selection-change="handleSelectionChange"
          @page-change="handlePageChange"
          @size-change="handlePageSizeChange"
          @view-assignments="handleViewAssignments"
          @edit="handleEdit"
          @delete="handleDelete"
          @withdraw="handleWithdraw"
          @copy="handleCopy"
          @set-visibility="handleSetVisibility"
          @rate="handleRate"
        />

        <div v-else class="public-resource-board">
          <div class="resource-insights resource-insights-inline">
            <div class="insight-card">
              <div class="insight-head">
                <div>
                  <div class="insight-title">优秀案例库</div>
                  <div class="insight-subtitle">按质量分、平均成绩和参与度筛选，可直接复用为草稿。</div>
                </div>
              </div>
              <div v-if="featuredCases.length === 0" class="insight-empty">暂无优秀案例</div>
              <div v-else class="insight-list">
                <div v-for="item in featuredCases" :key="item.caseId" class="insight-item">
                  <div class="insight-item-main">
                    <div class="insight-item-title">{{ item.caseName }}</div>
                    <div class="insight-item-meta">
                      <span>{{ item.teacherName || '未知教师' }}</span>
                      <span>难度 {{ item.difficultyLevel || '-' }}</span>
                      <span>质量 {{ formatMetric(item.qualityScore) }}</span>
                      <span>复用 {{ formatMetric(item.reuseCount) }}</span>
                    </div>
                    <div class="insight-item-tags">
                      <el-tag
                        v-for="badge in item.badges || []"
                        :key="`${item.caseId}-${badge}`"
                        size="small"
                        effect="plain"
                        type="success"
                      >
                        {{ badge }}
                      </el-tag>
                    </div>
                  </div>
                  <el-button size="small" type="primary" plain @click="handleCopy(item)">复用</el-button>
                </div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-head">
                <div>
                  <div class="insight-title">案例复用榜</div>
                  <div class="insight-subtitle">查看哪些案例被复用最多，方便持续沉淀优秀资源。</div>
                </div>
              </div>
              <div v-if="reuseStats.length === 0" class="insight-empty">暂无复用统计</div>
              <div v-else class="insight-list">
                <div v-for="item in reuseStats" :key="`${item.caseId}-${item.sourceCaseId}`" class="insight-item compact">
                  <div class="insight-item-main">
                    <div class="insight-item-title">{{ item.caseName }}</div>
                    <div class="insight-item-meta">
                      <span>来源 {{ item.sourceCaseName || '原创案例' }}</span>
                      <span>副本 {{ formatMetric(item.reuseCopyCount) }}</span>
                      <span>任务 {{ formatMetric(item.taskAssignmentCount) }}</span>
                      <span>认领 {{ formatMetric(item.studentClaimCount) }}</span>
                    </div>
                    <div class="insight-item-meta">
                      <span>平均分 {{ formatMetric(item.averageScore) }}</span>
                      <span>质量 {{ formatMetric(item.qualityScore) }}</span>
                      <span>最近复用 {{ formatDateTime(item.lastReuseAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 个性化案例视图 -->
      <el-tab-pane label="个性化案例" name="personalized">
        <template #label>
          <span class="custom-tab-label">
            <el-icon><User /></el-icon>
            <span>个性化案例</span>
          </span>
        </template>

        <PersonalizedCaseTable 
          ref="personalizedTableRef"
          :cases="personalizedCases"
          :loading="loading"
          :server-total="personalizedPagination.total"
          :current-page="personalizedPagination.page"
          :page-size="personalizedPagination.size"
          @selection-change="handleSelectionChange"
          @page-change="handlePageChange"
          @size-change="handlePageSizeChange"
          @view-assignments="handleViewAssignments"
          @edit="handleEdit"
          @delete="handleDelete"
          @withdraw="handleWithdraw"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- Assignments Dialog Component -->
    <AssignmentDialog ref="assignmentDialogRef" />

    <!-- 可见范围设置 Dialog -->
    <el-dialog v-model="visibilityDialog.visible" title="设置案例可见范围" width="400px">
      <el-form label-width="90px">
        <el-form-item label="可见范围">
          <el-radio-group v-model="visibilityDialog.visibility">
            <el-radio :label="0">仅自己可见</el-radio>
            <el-radio :label="1">指定班级</el-radio>
            <el-radio :label="2">全体公开</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="可见班级" v-if="visibilityDialog.visibility === 1">
          <el-select
            v-model="visibilityDialog.classIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            placeholder="请选择可见班级"
          >
            <el-option v-for="cls in classOptions" :key="cls.id" :label="cls.className || cls.name" :value="cls.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visibilityDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="visibilityDialog.loading" @click="submitVisibility">确定</el-button>
      </template>
    </el-dialog>

    <!-- 案例质量评分 Dialog -->
    <el-dialog v-model="rateDialog.visible" title="案例质量评分" width="480px">
      <el-form label-width="100px">
        <el-form-item label="背景故事">
          <el-rate v-model="rateDialog.form.storyScore" :max="5" show-score />
        </el-form-item>
        <el-form-item label="任务设计">
          <el-rate v-model="rateDialog.form.taskScore" :max="5" show-score />
        </el-form-item>
        <el-form-item label="数据集质量">
          <el-rate v-model="rateDialog.form.datasetScore" :max="5" show-score />
        </el-form-item>
        <el-form-item label="评价意见">
          <el-input v-model="rateDialog.form.comment" type="textarea" :rows="3" placeholder="选填，对案例的综合评价" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rateDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="rateDialog.loading" @click="submitRate">提交评分</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Collection, User, Select, Upload, Download, Delete } from '@element-plus/icons-vue'
import { getTeacherCaseList, deleteCase, batchPublishCases, withdrawCase, batchWithdrawCases, copyCase, setCaseVisibility, rateCase, getCaseResourceOverview, getFeaturedCases, getCaseReuseStats } from '@/api/teacher/case'
import { getMyClasses } from '@/api/teacher/class'
/** @typedef {import('@/api/types').TrainingCase} TrainingCase */

import PublicCaseTable from './components/PublicCaseTable.vue'
import PersonalizedCaseTable from './components/PersonalizedCaseTable.vue'
import AssignmentDialog from './components/AssignmentDialog.vue'

const router = useRouter()
const publicCases = ref<any[]>([])
const personalizedCases = ref<any[]>([])
const activeTab = ref('public')
const publicSubView = ref('cases')
const selectedCases = ref<any[]>([])
const batchPublishing = ref(false)
const batchWithdrawing = ref(false)
const loading = ref(false)
const publicPagination = ref({ page: 1, size: 15, total: 0 })
const personalizedPagination = ref({ page: 1, size: 15, total: 0 })

const publicTableRef = ref()
const personalizedTableRef = ref()
const assignmentDialogRef = ref()
const classOptions = ref<any[]>([])
const resourceOverview = ref<any>({
  totalCases: 0,
  publishedCases: 0,
  featuredCases: 0,
  reuseCopies: 0,
  taskAssignments: 0,
  averageQualityScore: 0,
  averageOutcomeScore: 0
})
const featuredCases = ref<any[]>([])
const reuseStats = ref<any[]>([])

// 可发布的案例（状态不是已发布的）
const publishableCases = computed(() => {
  return selectedCases.value.filter(c => c.status !== 2)
})

// 可撤回的案例（状态是已发布的）
const withdrawableCases = computed(() => {
  return selectedCases.value.filter(c => c.status === 2)
})

const formatMetric = (value: any) => {
  if (value === null || value === undefined || value === '') return '0'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

const formatDateTime = (value: any) => {
  if (!value) return '暂无'
  return String(value).replace('T', ' ')
}

const getCurrentType = () => (activeTab.value === 'public' ? 1 : 2)

const getCurrentPagination = () => {
  return activeTab.value === 'public' ? publicPagination.value : personalizedPagination.value
}

const clearTableSelections = () => {
  selectedCases.value = []
  publicTableRef.value?.clearSelection?.()
  personalizedTableRef.value?.clearSelection?.()
}

const loadCases = async () => {
  loading.value = true
  try {
    const currentPagination = getCurrentPagination()
    const response = await getTeacherCaseList({
      page: currentPagination.page,
      size: currentPagination.size,
      type: getCurrentType()
    })
    const payload = response.data
    const records = Array.isArray(payload) ? payload : (payload?.records || [])
    const total = Array.isArray(payload) ? payload.length : (payload?.total || 0)

    if (activeTab.value === 'public') {
      publicCases.value = records
      publicPagination.value.total = total
    } else {
      personalizedCases.value = records
      personalizedPagination.value.total = total
    }
    await loadResourceInsights()
  } catch (error: any) {
    ElMessage.error(error.message || '加载案例失败')
  } finally {
    loading.value = false
  }
}

const loadResourceInsights = async () => {
  try {
    const [overviewRes, featuredRes, reuseRes] = await Promise.all([
      getCaseResourceOverview(),
      getFeaturedCases({ limit: 6 }),
      getCaseReuseStats({ limit: 6 })
    ])
    if (overviewRes?.code === 200) {
      resourceOverview.value = {
        ...resourceOverview.value,
        ...(overviewRes.data || {})
      }
    }
    if (featuredRes?.code === 200) {
      featuredCases.value = featuredRes.data || []
    }
    if (reuseRes?.code === 200) {
      reuseStats.value = reuseRes.data || []
    }
  } catch (error) {
    console.warn('loadResourceInsights failed', error)
  }
}

const handlePageChange = (page: number) => {
  const currentPagination = getCurrentPagination()
  currentPagination.page = page
  selectedCases.value = []
  loadCases()
}

const handlePageSizeChange = (size: number) => {
  const currentPagination = getCurrentPagination()
  currentPagination.size = size
  currentPagination.page = 1
  selectedCases.value = []
  loadCases()
}

const handleCreate = () => {
  router.push('/teacher/cases/create')
}

const handleSelectionChange = (val: any[]) => {
  selectedCases.value = val || []
}

const handleSelectAll = () => {
  personalizedTableRef.value?.selectAll()
}

const handleBatchPublish = () => {
  if (publishableCases.value.length === 0) {
    ElMessage.warning('没有可发布的案例')
    return
  }
  
  ElMessageBox.confirm(
    `确定要发布选中的 ${publishableCases.value.length} 个案例吗？`,
    '批量发布确认',
    {
      confirmButtonText: '确定发布',
      cancelButtonText: '取消',
      type: 'info',
    }
  ).then(async () => {
    batchPublishing.value = true
    try {
      const caseIds = publishableCases.value.map(c => c.id)
      await batchPublishCases(caseIds)
      ElMessage.success('批量发布成功')
      selectedCases.value = []
      loadCases()
    } catch (error: any) {
      ElMessage.error(error.message || '批量发布失败')
    } finally {
      batchPublishing.value = false
    }
  })
}

const handleBatchWithdraw = () => {
  if (withdrawableCases.value.length === 0) {
    ElMessage.warning('没有可撤回的案例')
    return
  }
  
  ElMessageBox.confirm(
    `确定要撤回选中的 ${withdrawableCases.value.length} 个已发布案例吗？只有未被分配或领取的案例才能撤回。`,
    '批量撤回确认',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    batchWithdrawing.value = true
    try {
      const caseIds = withdrawableCases.value.map(c => c.id)
      await batchWithdrawCases(caseIds)
      ElMessage.success('批量撤回成功')
      selectedCases.value = []
      loadCases()
    } catch (error: any) {
      ElMessage.error(error.message || '批量撤回失败')
    } finally {
      batchWithdrawing.value = false
    }
  })
}

const handleBatchDelete = () => {
  if (selectedCases.value.length === 0) return
  
  ElMessageBox.confirm(
    `确定要批量删除选中的 ${selectedCases.value.length} 个案例吗？此操作不可恢复。`,
    '批量删除警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      const deletePromises = selectedCases.value.map(item => deleteCase(item.id))
      await Promise.all(deletePromises)
      ElMessage.success('批量删除成功')
      selectedCases.value = [] // Clear selection
      loadCases()
    } catch (error: any) {
      ElMessage.error(error.message || '批量删除失败')
    }
  })
}

const handleViewAssignments = (caseItem: any) => {
  assignmentDialogRef.value?.open(caseItem)
}

const handleEdit = (caseItem: any) => {
  router.push({ name: 'CaseEdit', params: { id: caseItem.id } })
}

const handleDelete = (caseItem: any) => {
  ElMessageBox.confirm(
    `确定要删除案例 "${caseItem.caseName}" 吗？此操作不可恢复。`,
    '警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await deleteCase(caseItem.id)
      ElMessage.success('删除成功')
      loadCases()
    } catch (error: any) {
      ElMessage.error(error.message || '删除失败')
    }
  })
}

const handleWithdraw = (caseItem: any) => {
  ElMessageBox.confirm(
    `确定要撤回案例 "${caseItem.caseName}" 吗？撤回后案例将变为草稿状态。`,
    '撤回确认',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await withdrawCase(caseItem.id)
      ElMessage.success('撤回成功')
      loadCases()
    } catch (error: any) {
      ElMessage.error(error.message || '撤回失败')
    }
  })
}

const handleCopy = async (caseItem: any) => {
  try {
    await copyCase(caseItem.id || caseItem.caseId)
    ElMessage.success('案例复制成功，已生成草稿')
    loadCases()
  } catch (error: any) {
    ElMessage.error(error.message || '复制失败')
  }
}

// 可见范围弹窗状态
const visibilityDialog = ref({ visible: false, caseId: null as number | null, visibility: 0, classIds: [] as number[], loading: false })

const handleSetVisibility = (caseItem: any) => {
  visibilityDialog.value = {
    visible: true,
    caseId: caseItem.id,
    visibility: caseItem.visibility ?? 0,
    classIds: Array.isArray(caseItem.visibleClassIds) ? caseItem.visibleClassIds : [],
    loading: false
  }
}

const submitVisibility = async () => {
  visibilityDialog.value.loading = true
  try {
    if (visibilityDialog.value.visibility === 1 && (!visibilityDialog.value.classIds || visibilityDialog.value.classIds.length === 0)) {
      ElMessage.warning('请选择至少一个可见班级')
      return
    }
    await setCaseVisibility(visibilityDialog.value.caseId, {
      visibility: visibilityDialog.value.visibility,
      classIds: visibilityDialog.value.visibility === 1 ? visibilityDialog.value.classIds : []
    })
    ElMessage.success('可见范围设置成功')
    visibilityDialog.value.visible = false
    loadCases()
  } catch (error: any) {
    ElMessage.error(error.message || '设置失败')
  } finally {
    visibilityDialog.value.loading = false
  }
}

// 质量评分弹窗状态
const rateDialog = ref({
  visible: false,
  caseId: null as number | null,
  loading: false,
  form: { storyScore: 3, taskScore: 3, datasetScore: 3, comment: '' }
})

const handleRate = (caseItem: any) => {
  rateDialog.value = {
    visible: true,
    caseId: caseItem.id,
    loading: false,
    form: { storyScore: 3, taskScore: 3, datasetScore: 3, comment: '' }
  }
}

const submitRate = async () => {
  rateDialog.value.loading = true
  try {
    await rateCase(rateDialog.value.caseId, rateDialog.value.form)
    ElMessage.success('评分提交成功')
    rateDialog.value.visible = false
    loadCases()
  } catch (error: any) {
    ElMessage.error(error.message || '评分失败')
  } finally {
    rateDialog.value.loading = false
  }
}

watch(activeTab, () => {
  clearTableSelections()
  loadCases()
})

watch(publicSubView, () => {
  clearTableSelections()
})

onMounted(() => {
  getMyClasses().then((res: any) => {
    if (res?.code === 200) {
      classOptions.value = res.data || []
    }
  }).catch(() => {})
  loadCases()
})
</script>

<style scoped lang="scss">
.case-list-container {
  width: 100%;
  max-width: 100%;
  background-color: #f8fafc;
  padding: 12px;
  box-sizing: border-box;
  animation: fadeIn 0.4s ease-out;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-radio-button__inner),
  :deep(.el-dialog__title),
  :deep(.el-form-item__label) {
    font-size: 17px;
  }

  :deep(.el-tag) {
    font-size: 15px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    background: #fff;
    padding: 8px 16px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    
    .header-left {
      .page-title {
        font-size: 32px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 2px 0;
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
        color: #64748b;
        font-size: 17px;
        margin: 0;
        padding-left: 10px;
      }
    }

    .header-right {
      display: flex;
      gap: 6px;
      align-items: center;

      .el-button {
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 6px;
        padding: 8px 14px;
        height: 34px;
        font-size: 16px;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        
        &.create-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          color: white;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
          
          &:hover {
            box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
            transform: translateY(-1px) scale(1.02);
          }
        }
      }
    }
  }
}

.case-tabs {
  background: #fff;
  border-radius: 10px;
  padding: 4px 12px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-tab-pane) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: #f1f5f9;
  }
  
  :deep(.el-tabs__item) {
    font-size: 16px;
    font-weight: 500;
    color: #64748b;
    padding: 0 16px;
    height: 36px;
    line-height: 36px;
    transition: all 0.3s ease;
    
    &.is-active {
      color: #2563eb;
      font-weight: 600;
    }
    
    &:hover {
      color: #3b82f6;
    }
  }

  :deep(.el-tabs__active-bar) {
    height: 2px;
    border-radius: 2px 2px 0 0;
    background-color: #3b82f6;
  }

  .custom-tab-label {
    display: flex;
    align-items: center;
    gap: 4px;
    
    .el-icon {
      font-size: 18px;
      transition: transform 0.3s ease;
    }
  }

  :deep(.el-tabs__item.is-active) .custom-tab-label .el-icon {
    transform: scale(1.1);
  }
}

.resource-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 10px;
}

.overview-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 6px;

  strong {
    font-size: 38px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1;
  }

  small {
    font-size: 15px;
    color: #64748b;
    line-height: 1.5;
  }
}

.overview-label {
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
}

.resource-insights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.resource-insights-inline {
  margin-bottom: 0;
}

.public-view-switch {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.public-resource-board {
  display: flex;
  flex-direction: column;
}

.insight-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  padding: 14px;
}

.insight-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.insight-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.insight-subtitle {
  margin-top: 4px;
  font-size: 16px;
  color: #64748b;
  line-height: 1.5;
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #edf2f7;
  background: #fff;

  &.compact {
    align-items: flex-start;
  }
}

.insight-item-main {
  min-width: 0;
  flex: 1;
}

.insight-item-title {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.5;
}

.insight-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 6px;
  font-size: 15px;
  color: #64748b;
}

.insight-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.insight-empty {
  font-size: 16px;
  color: #94a3b8;
  padding: 12px 0;
}

@media (max-width: 1200px) {
  .resource-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .resource-insights {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .resource-overview-grid {
    grid-template-columns: 1fr;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
