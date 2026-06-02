<template>
  <div class="task-info-container">
    <!-- 案例概览（多端统一展示） -->
    <div v-if="caseData || caseLoading" class="case-overview-block">
      <div class="overview-header">
        <span class="overview-title">案例概览</span>
        <span v-if="caseData?.caseName" class="overview-case-name">{{ caseData.caseName }}</span>
        <el-tag
          v-if="task?.caseModeLabel"
          size="small"
          :type="task?.caseMode === 'PURE_CODING' ? 'success' : 'warning'"
          effect="light"
          round
        >
          {{ task.caseModeLabel }}
        </el-tag>
      </div>
      <div v-if="caseLoading" style="padding: 16px 0; text-align: center;">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span style="margin-left: 8px; color: #64748b; font-size: 13px;">加载中...</span>
      </div>
      <CaseSummaryView
        v-else-if="caseData"
        :background-story="caseData.backgroundStory"
        :task-list="caseData.taskList"
        :expected-output="caseData.expectedOutput"
      />
    </div>

    <div class="section-divider" v-if="caseData && !hideTaskDetailContent"></div>

    <div v-if="!hideTaskDetailContent" class="simple-card">
      <!-- 实验报告格式提示（仅含 requiredSections 的报告型任务显示） -->
      <template v-if="reportSections.length">
        <el-alert
          title="实验报告严格按照实验步骤书写，各步骤标题与格式须与实验任务书一致"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 16px;"
        />
        <div class="info-section" style="margin-bottom: 16px;">
          <h3 class="section-title">报告结构要求</h3>
          <div class="section-content">
            <div class="required-sections-list">
              <el-tag
                v-for="(sec, i) in reportSections"
                :key="i"
                type="info"
                effect="plain"
                style="margin: 4px 8px 4px 0;"
              >{{ i + 1 }}. {{ sec }}</el-tag>
            </div>
          </div>
        </div>
        <div class="section-divider"></div>
      </template>

      <!-- 任务描述 -->
      <div class="info-section">
        <h3 class="section-title">任务描述</h3>
        <div class="section-content">
          <p>{{ task.taskDescription }}</p>
        </div>
      </div>

      <div class="section-divider"></div>

      <!-- 任务要求 -->
      <div class="info-section">
        <h3 class="section-title">具体要求</h3>
        <div class="section-content">
          <div class="markdown-body">{{ task.taskRequirements }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import CaseSummaryView from '@/components/CaseSummaryView.vue'
import { getCaseDetail } from '@/api/student/task'

const props = defineProps({
  task: Object,
  hideTaskDetailContent: {
    type: Boolean,
    default: false
  }
})

const caseData = ref(null)
const caseLoading = ref(false)

const loadCase = async (caseId) => {
  if (!caseId) return
  caseLoading.value = true
  try {
    const res = await getCaseDetail(caseId)
    caseData.value = res?.data || null
  } catch {
    caseData.value = null
  } finally {
    caseLoading.value = false
  }
}

onMounted(() => {
  loadCase(props.task?.caseId)
})

watch(() => props.task?.caseId, (id) => {
  loadCase(id)
})

const hideTaskDetailContent = computed(() => props.hideTaskDetailContent)

const reportSections = computed(() => {
  try {
    const schema = typeof props.task?.validationSchema === 'string'
      ? JSON.parse(props.task.validationSchema)
      : props.task?.validationSchema
    return Array.isArray(schema?.requiredSections) ? schema.requiredSections : []
  } catch {
    return []
  }
})
</script>

<style scoped lang="scss">
.task-info-container {
  padding: 0;
}

.simple-card {
  background: #fff;
  /* Removing heavy shadows and borders for a cleaner look */
  /* border: 1px solid #ebeef5; */ 
  /* border-radius: 8px; */
  /* padding: 24px; */
  /* Actually, since it's inside a tab content which already has padding/bg, 
     we might just want clean text blocks. 
     But let's keep it structurally sound. */
}

.info-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
}

.section-content {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  /* Removed padding-left to align with title */
  
  p {
    margin: 0;
    white-space: pre-wrap;
  }

  .markdown-body {
    white-space: pre-wrap;
    color: #333;
  }
}

.section-divider {
  height: 1px;
  background: #f0f2f5;
  margin: 24px 0;
}

.required-sections-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

/* ---- case overview block ---- */
.case-overview-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 4px;
}

.overview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.overview-title {
  font-size: 14px;
  font-weight: 700;
  color: #6366f1;
  background: #eef2ff;
  padding: 2px 10px;
  border-radius: 20px;
}

.overview-case-name {
  font-size: 13px;
  color: #64748b;
  font-style: italic;
}
</style>
