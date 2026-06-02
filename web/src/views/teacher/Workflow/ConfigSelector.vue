<template>
  <div class="workflow-config-container">
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title">工作流配置中心</h2>
        <p class="page-desc">案例模式只保留两个，但仍按难度分别维护工作流。</p>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-value">{{ configuredCount }}</span>
          <span class="stat-label">已配置</span>
        </div>
        <div class="stat-divider">/</div>
        <div class="stat-item total">
          <span class="stat-value">{{ totalSlots }}</span>
          <span class="stat-label">总槽位</span>
        </div>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="16">
        <el-card class="config-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="title">
                <el-icon><Operation /></el-icon> 配置选择
              </span>
              <el-tag type="primary" effect="plain">工作流增强模式</el-tag>
            </div>
          </template>

          <div class="selection-area">
            <div class="selection-group">
              <div class="group-label">第一步：选择案例模式</div>
              <div class="option-grid">
                <div
                  v-for="type in caseTypes"
                  :key="type.value"
                  class="option-card"
                  :class="{ active: selectedCaseType === type.value }"
                  @click="selectCaseType(type.value)"
                >
                  <div class="option-icon" :class="type.value.toLowerCase()">
                    <el-icon><component :is="type.icon" /></el-icon>
                  </div>
                  <div class="option-info">
                    <div class="option-name">{{ type.label }}</div>
                    <div class="option-desc">{{ type.desc }}</div>
                  </div>
                  <div class="check-mark" v-if="selectedCaseType === type.value">
                    <el-icon><Check /></el-icon>
                  </div>
                </div>
              </div>
            </div>

            <el-divider border-style="dashed" />

            <div class="selection-group">
              <div class="group-label">第二步：选择难度等级</div>
              <div class="option-grid three-cols">
                <div
                  v-for="diff in difficulties"
                  :key="diff.value"
                  class="option-card"
                  :class="{ active: selectedDifficulty === diff.value }"
                  @click="selectDifficulty(diff.value)"
                >
                  <div class="option-icon" :class="diff.value.toLowerCase()">
                    <el-icon><component :is="diff.icon" /></el-icon>
                  </div>
                  <div class="option-info">
                    <div class="option-name">{{ diff.label }}</div>
                    <div class="option-desc">{{ diff.desc }}</div>
                  </div>
                  <div class="check-mark" v-if="selectedDifficulty === diff.value">
                    <el-icon><Check /></el-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <div class="sticky-panel">
          <el-card class="status-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="title">当前配置状态</span>
              </div>
            </template>

            <div class="status-content" v-if="selectedCaseType && selectedDifficulty">
              <div class="status-summary">
                <div class="summary-item">
                  <span class="label">模式</span>
                  <span class="value">{{ caseTypeLabel }}</span>
                </div>
                <div class="summary-separator">+</div>
                <div class="summary-item">
                  <span class="label">难度</span>
                  <span class="value">{{ difficultyLabel }}</span>
                </div>
              </div>

              <div class="status-indicator" :class="currentWorkflow ? 'configured' : 'empty'">
                <div class="indicator-icon">
                  <el-icon v-if="currentWorkflow"><CircleCheckFilled /></el-icon>
                  <el-icon v-else><WarningFilled /></el-icon>
                </div>
                <div class="indicator-text">
                  <h3>{{ currentWorkflow ? '已配置工作流' : '暂未配置' }}</h3>
                  <p>{{ currentWorkflow ? '该组合已启用自定义 Agent 工作流。' : '当前使用系统默认工作流。' }}</p>
                </div>
              </div>

              <div class="action-buttons">
                <el-button
                  type="primary"
                  size="large"
                  class="action-btn main-btn"
                  @click="goToDesigner"
                >
                  {{ currentWorkflow ? '编辑工作流' : '创建工作流' }}
                </el-button>

                <div class="sub-actions" v-if="currentWorkflow">
                  <el-button plain @click="handlePreviewWorkflow" icon="View">
                    预览
                  </el-button>
                  <el-button type="danger" plain @click="handleDeleteWorkflow" icon="Delete">
                    删除
                  </el-button>
                </div>
              </div>
            </div>

            <div class="empty-selection" v-else>
              <el-empty description="请先在左侧选择模式和难度" :image-size="100" />
            </div>
          </el-card>

          <el-card class="overview-card" shadow="hover">
            <div class="overview-list">
              <div class="overview-title">全局配置概览</div>
              <div v-for="type in caseTypes" :key="type.value" class="overview-group">
                <div class="group-name">{{ type.label }}</div>
                <div class="diff-badges">
                  <el-tooltip
                    v-for="diff in difficulties"
                    :key="diff.value"
                    :content="`${type.label} - ${diff.label}: ${isConfigured(type.value, diff.value) ? '已配置' : '未配置'}`"
                    placement="top"
                    :teleported="false"
                  >
                    <div
                      class="diff-dot"
                      :class="{
                        active: isConfigured(type.value, diff.value),
                        current: selectedCaseType === type.value && selectedDifficulty === diff.value
                      }"
                      @click="selectConfig(type.value, diff.value)"
                    >
                      {{ diff.label[0] }}
                    </div>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Operation,
  Check,
  CircleCheckFilled,
  WarningFilled,
  EditPen,
  Coffee,
  TrendCharts,
  Trophy
} from '@element-plus/icons-vue'
import { deleteWorkflowTemplate, getWorkflowByCaseDifficulty } from '@/api/teacher/case'
import {
  WORKFLOW_MODES,
  getRecommendedWorkflowTemplateType,
  getWorkflowModeLabel
} from './workflowModes'

const router = useRouter()

const caseTypes = WORKFLOW_MODES.map(mode => ({
  label: mode.label,
  value: mode.value,
  icon: mode.icon === 'EditPen' ? EditPen : Operation,
  desc: mode.description
}))

const difficulties = [
  {
    label: '初级',
    value: 'EASY',
    icon: Coffee,
    desc: '适合入门或规则较少的案例'
  },
  {
    label: '中级',
    value: 'MEDIUM',
    icon: TrendCharts,
    desc: '兼顾完整流程与可控复杂度'
  },
  {
    label: '高级',
    value: 'HARD',
    icon: Trophy,
    desc: '适合复杂业务和高要求验证链路'
  }
]

const selectedCaseType = ref('FULL_PRACTICE')
const selectedDifficulty = ref('MEDIUM')
const currentWorkflow = ref(null)
const configStates = ref({})
const loading = ref(false)

const totalSlots = computed(() => caseTypes.length * difficulties.length)

const caseTypeLabel = computed(() => getWorkflowModeLabel(selectedCaseType.value))

const difficultyLabel = computed(() => {
  const diff = difficulties.find(item => item.value === selectedDifficulty.value)
  return diff ? diff.label : ''
})

const configuredCount = computed(() => Object.values(configStates.value).filter(Boolean).length)

const isConfigured = (caseType, difficulty) => {
  return !!configStates.value[`${caseType}-${difficulty}`]
}

const selectCaseType = (value) => {
  selectedCaseType.value = value
  if (selectedDifficulty.value) {
    loadCurrentWorkflow()
  }
}

const selectDifficulty = (value) => {
  selectedDifficulty.value = value
  if (selectedCaseType.value) {
    loadCurrentWorkflow()
  }
}

const selectConfig = (caseType, difficulty) => {
  selectedCaseType.value = caseType
  selectedDifficulty.value = difficulty
  loadCurrentWorkflow()
}

const loadCurrentWorkflow = async () => {
  if (!selectedCaseType.value || !selectedDifficulty.value) return

  try {
    loading.value = true
    const res = await getWorkflowByCaseDifficulty(selectedCaseType.value, selectedDifficulty.value)
    const data = res?.data || res
    currentWorkflow.value = data?.exists ? data.template : null
  } catch (error) {
    console.error('加载工作流失败', error)
    ElMessage.error('加载工作流状态失败')
  } finally {
    loading.value = false
  }
}

const loadAllConfigStates = async () => {
  loading.value = true

  for (const caseType of caseTypes) {
    for (const difficulty of difficulties) {
      const key = `${caseType.value}-${difficulty.value}`
      try {
        const res = await getWorkflowByCaseDifficulty(caseType.value, difficulty.value)
        const data = res?.data || res
        configStates.value[key] = !!data?.exists
      } catch (error) {
        configStates.value[key] = false
      }
    }
  }

  loading.value = false
}

const goToDesigner = async () => {
  if (!selectedCaseType.value || !selectedDifficulty.value) return

  if (!currentWorkflow.value) {
    try {
      await ElMessageBox.confirm(
        '即将为该模式和难度组合创建新的 Agent 工作流。你可以从推荐模板开始，也可以直接空白设计。',
        '创建新流程',
        {
          confirmButtonText: '从推荐模板开始',
          cancelButtonText: '空白画布',
          type: 'info'
        }
      )

      router.push({
        path: '/teacher/workflow/design',
        query: {
          caseType: selectedCaseType.value,
          difficulty: selectedDifficulty.value,
          loadTemplate: getRecommendedWorkflowTemplateType(selectedCaseType.value)
        }
      })
    } catch (action) {
      if (action === 'cancel') {
        router.push({
          path: '/teacher/workflow/design',
          query: {
            caseType: selectedCaseType.value,
            difficulty: selectedDifficulty.value
          }
        })
      }
    }
    return
  }

  router.push({
    path: '/teacher/workflow/design',
    query: {
      caseType: selectedCaseType.value,
      difficulty: selectedDifficulty.value
    }
  })
}

const handleDeleteWorkflow = async () => {
  if (!currentWorkflow.value?.id) {
    ElMessage.warning('当前没有可删除的自定义工作流')
    return
  }

  try {
    await ElMessageBox.confirm(
      '删除后该模式与难度组合将恢复为系统默认工作流，确定继续吗？',
      '确认删除配置',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await deleteWorkflowTemplate(currentWorkflow.value.id)
    ElMessage.success('工作流配置已删除，当前组合已恢复为默认流程')
    await loadCurrentWorkflow()
    await loadAllConfigStates()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除工作流失败', error)
      ElMessage.error(error?.message || '删除工作流失败')
    }
  }
}

const handlePreviewWorkflow = () => {
  if (!currentWorkflow.value) return

  router.push({
    path: '/teacher/workflow/design',
    query: {
      caseType: selectedCaseType.value,
      difficulty: selectedDifficulty.value,
      readonly: true
    }
  })
}

onMounted(async () => {
  await loadAllConfigStates()
  await loadCurrentWorkflow()
})
</script>

<style scoped lang="scss">
.workflow-config-container {
  padding: 24px 32px;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100%;
  box-sizing: border-box;
  background-color: #f8fafc;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;

  .header-content {
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
    }

    .page-desc {
      color: #64748b;
      font-size: 14px;
      margin: 0;
    }
  }

  .header-stats {
    display: flex;
    align-items: baseline;
    gap: 8px;
    background: white;
    padding: 12px 24px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-value {
        font-size: 24px;
        font-weight: 800;
        color: #2563eb;
        line-height: 1;
      }

      .stat-label {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
      }

      &.total .stat-value {
        color: #94a3b8;
      }
    }

    .stat-divider {
      font-size: 20px;
      color: #cbd5e1;
      margin: 0 8px;
    }
  }
}

.config-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  :deep(.el-card__header) {
    border-bottom: 1px solid #f1f5f9;
    padding: 20px 24px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

.selection-area {
  padding: 8px 0;

  .selection-group {
    margin-bottom: 24px;

    .group-label {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  &.three-cols {
    grid-template-columns: repeat(3, 1fr);
  }
}

.option-card {
  position: relative;
  display: flex;
  align-items: center;
  padding: 20px;
  background: #f8fafc;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: white;
    border-color: #cbd5e1;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  &.active {
    background: #eff6ff;
    border-color: #2563eb;

    .option-icon {
      background: #2563eb;
      color: white;
    }

    .option-name {
      color: #1e40af;
    }
  }

  .option-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: #e2e8f0;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-right: 16px;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &.full_practice {
      color: #0f766e;
      background: #ccfbf1;
    }

    &.pure_coding {
      color: #1d4ed8;
      background: #dbeafe;
    }

    &.easy {
      color: #10b981;
      background: #d1fae5;
    }

    &.medium {
      color: #f59e0b;
      background: #fef3c7;
    }

    &.hard {
      color: #ef4444;
      background: #fee2e2;
    }
  }

  .option-info {
    flex: 1;

    .option-name {
      font-weight: 600;
      color: #334155;
      margin-bottom: 4px;
      font-size: 16px;
    }

    .option-desc {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }
  }

  .check-mark {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 24px;
    height: 24px;
    background: #2563eb;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }
}

.sticky-panel {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-card,
.overview-card {
  border: none;
  border-radius: 16px;
}

.status-content {
  .status-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;

      .label {
        font-size: 11px;
        color: #94a3b8;
      }

      .value {
        font-weight: 600;
        color: #334155;
      }
    }

    .summary-separator {
      color: #cbd5e1;
      font-weight: bold;
    }
  }

  .status-indicator {
    text-align: center;
    margin-bottom: 32px;

    .indicator-icon {
      font-size: 64px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }

    &.configured {
      .indicator-icon {
        color: #10b981;
      }

      .indicator-text h3 {
        color: #059669;
      }
    }

    &.empty {
      .indicator-icon {
        color: #f59e0b;
      }

      .indicator-text h3 {
        color: #d97706;
      }
    }

    .indicator-text {
      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }
    }
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .main-btn {
      height: 48px;
      font-size: 16px;
      border-radius: 8px;
    }

    .sub-actions {
      display: flex;
      gap: 12px;

      .el-button {
        flex: 1;
      }
    }
  }
}

.empty-selection {
  padding: 40px 0;
  text-align: center;
}

.overview-list {
  .overview-title {
    font-size: 13px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .overview-group {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .group-name {
      font-size: 14px;
      color: #334155;
      font-weight: 500;
    }

    .diff-badges {
      display: flex;
      gap: 8px;

      .diff-dot {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #f1f5f9;
        color: #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        border: 2px solid transparent;

        &:hover {
          background: #e2e8f0;
        }

        &.active {
          background: #dcfce7;
          color: #10b981;
        }

        &.current {
          border-color: #2563eb;
          transform: scale(1.1);
        }
      }
    }
  }
}
</style>
