<template>
  <div class="student-report-page" v-loading="pageLoading">
    <div class="hero">
      <div>
        <div class="hero-breadcrumb">学习分析 / 提交报告</div>
        <h2>个人实训报告</h2>
        <p>每次提交都会沉淀为一份独立报告，包含评分结果、验收说明、学习过程摘要与资源建议。</p>
      </div>
      <div class="hero-actions">
        <el-button @click="loadAllData">刷新</el-button>
        <el-button
          type="primary"
          :loading="exportingReportId === selectedReportId"
          :disabled="!selectedReportId || detailLoading"
          @click="handleExport(selectedReportId)"
        >
          导出当前 Word 报告
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="metrics">
      <el-col :xs="12" :md="6">
        <el-card><div class="metric"><span>总任务</span><strong>{{ overview.totalTasks || 0 }}</strong></div></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card><div class="metric"><span>已完成</span><strong>{{ overview.completedTasks || 0 }}</strong></div></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card><div class="metric"><span>平均分</span><strong>{{ formatScore(overview.averageScore) }}</strong></div></el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card><div class="metric"><span>提交报告数</span><strong>{{ reportList.length }}</strong></div></el-card>
      </el-col>
    </el-row>

    <div class="report-layout">
      <el-card class="report-list-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">报告清单</div>
              <div class="card-subtitle">按提交记录生成，可逐份查看与导出。</div>
            </div>
          </div>
        </template>

        <div v-if="reportList.length === 0" class="empty-text">暂无可生成的提交报告</div>

        <div v-else class="report-list">
          <div
            v-for="item in reportList"
            :key="item.submissionId"
            class="report-item"
            :class="{ active: selectedReportId === item.submissionId }"
            role="button"
            tabindex="0"
            @click="selectReport(item.submissionId)"
            @keyup.enter="selectReport(item.submissionId)"
            @keyup.space.prevent="selectReport(item.submissionId)"
          >
            <div class="report-item-head">
              <div class="report-item-title">{{ item.caseName || '未命名案例' }}</div>
              <el-tag size="small" effect="plain" :type="getStatusTagType(item.submissionStatus)">
                {{ item.submissionStatusLabel || '处理中' }}
              </el-tag>
            </div>

            <div class="report-item-desc">{{ item.taskDescription || '暂无任务描述' }}</div>

            <div class="report-item-meta">
              <span>{{ item.caseModeLabel || '完整实训案例' }}</span>
              <span>{{ item.submissionTypeLabel || '在线提交' }}</span>
              <span>V{{ item.submissionVersion || 1 }}</span>
            </div>

            <div class="report-item-foot">
              <span>{{ formatDateTime(item.submissionTime) }}</span>
              <strong>{{ formatScore(item.finalScore) }} / {{ formatScore(item.maxScore) }}</strong>
            </div>

            <div class="report-item-actions">
              <el-button size="small" @click.stop="selectReport(item.submissionId)">查看详情</el-button>
              <el-button
                size="small"
                type="primary"
                plain
                :loading="exportingReportId === item.submissionId"
                @click.stop="handleExport(item.submissionId)"
              >
                导出 Word
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="report-detail-card" v-loading="detailLoading">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">报告详情</div>
              <div class="card-subtitle">展示评分、验收、学习轨迹与个性化反馈。</div>
            </div>
            <el-tag v-if="currentReport?.submissionStatusLabel" effect="plain" round>
              {{ currentReport.submissionStatusLabel }}
            </el-tag>
          </div>
        </template>

        <div v-if="!currentReport" class="empty-text">请选择左侧一份提交报告查看详情</div>

        <div v-else class="detail-content">
          <div class="detail-hero">
            <div>
              <div class="detail-breadcrumb">{{ currentReport.caseModeLabel }} / {{ currentReport.submissionTypeLabel }}</div>
              <h3>{{ currentReport.caseName }}</h3>
              <p>{{ currentReport.taskTitle }}</p>
            </div>
            <div class="detail-score">
              <span>最终得分</span>
              <strong>{{ formatScore(currentReport.finalScore) }}</strong>
              <small>/ {{ formatScore(currentReport.maxScore) }}</small>
            </div>
          </div>

          <el-row :gutter="12" class="detail-metrics">
            <el-col :xs="12" :md="6"><div class="mini-metric"><span>自动评分</span><strong>{{ formatScore(currentReport.autoScore) }}</strong></div></el-col>
            <el-col :xs="12" :md="6"><div class="mini-metric"><span>AI评分</span><strong>{{ formatScore(currentReport.aiScore) }}</strong></div></el-col>
            <el-col :xs="12" :md="6"><div class="mini-metric"><span>教师评分</span><strong>{{ formatScore(currentReport.manualScore) }}</strong></div></el-col>
            <el-col :xs="12" :md="6"><div class="mini-metric"><span>验收通过</span><strong>{{ currentReport.passedValidationCount || 0 }} / {{ currentReport.totalValidationCount || 0 }}</strong></div></el-col>
          </el-row>

          <div class="section-block">
            <div class="section-label">报告概述</div>
            <div class="summary-box">{{ currentReport.summary || '暂无概述' }}</div>
          </div>

          <div class="section-block two-column">
            <div class="info-card">
              <div class="section-label">提交信息</div>
              <div class="info-row"><span>提交版本</span><strong>V{{ currentReport.submissionVersion || 1 }}</strong></div>
              <div class="info-row"><span>提交时间</span><strong>{{ formatDateTime(currentReport.submissionTime) }}</strong></div>
              <div class="info-row"><span>文件名称</span><strong>{{ currentReport.fileName || '在线填写' }}</strong></div>
              <div class="info-row"><span>评分来源</span><strong>{{ currentReport.scoreSource || '待评分' }}</strong></div>
            </div>
            <div class="info-card">
              <div class="section-label">任务背景</div>
              <div class="info-paragraph">{{ currentReport.backgroundStory || currentReport.taskRequirements || '暂无背景说明' }}</div>
            </div>
          </div>

          <div v-if="currentReport.learningProcessSummary" class="section-block">
            <div class="section-label">学习过程轨迹</div>
            <div class="learning-metrics">
              <div class="learning-metric-card">
                <span>过程事件</span>
                <strong>{{ currentReport.learningProcessSummary.totalEvents || 0 }}</strong>
              </div>
              <div class="learning-metric-card">
                <span>草稿保存</span>
                <strong>{{ currentReport.learningProcessSummary.draftSaveCount || 0 }}</strong>
              </div>
              <div class="learning-metric-card">
                <span>附件上传</span>
                <strong>{{ currentReport.learningProcessSummary.attachmentUploadCount || 0 }}</strong>
              </div>
              <div class="learning-metric-card">
                <span>报告查看</span>
                <strong>{{ currentReport.learningProcessSummary.reportViewCount || 0 }}</strong>
              </div>
            </div>
            <div class="learning-meta-line">
              <span>任务查看 {{ currentReport.learningProcessSummary.taskViewCount || 0 }} 次</span>
              <span>数据集导出 {{ currentReport.learningProcessSummary.datasetExportCount || 0 }} 次</span>
              <span>成果提交 {{ currentReport.learningProcessSummary.submissionCount || 0 }} 次</span>
              <span>活跃时长 {{ formatDuration(currentReport.learningProcessSummary.activeDurationSeconds) }}</span>
            </div>
            <div v-if="(currentReport.learningProcessSummary.timeline || []).length" class="timeline-list">
              <div
                v-for="item in currentReport.learningProcessSummary.timeline.slice(0, 10)"
                :key="item.id"
                class="timeline-item"
              >
                <div class="timeline-dot"></div>
                <div class="timeline-body">
                  <div class="timeline-top">
                    <strong>{{ item.actionLabel || item.actionType }}</strong>
                    <span>{{ formatDateTime(item.createdAt) }}</span>
                  </div>
                  <div class="timeline-sub">
                    <span v-if="item.sourcePage">{{ item.sourcePage }}</span>
                    <span v-if="item.attachmentCount">附件 {{ item.attachmentCount }} 个</span>
                    <span v-if="item.durationSeconds">用时 {{ formatDuration(item.durationSeconds) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-block">
            <div class="section-label">验收结果</div>
            <el-table :data="currentReport.validationItems || []" stripe size="small">
              <el-table-column prop="validationRule" label="规则项" min-width="220" />
              <el-table-column label="结果" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.passed ? 'success' : 'danger'">{{ row.passed ? '通过' : '需修改' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
              <el-table-column label="得分" width="120">
                <template #default="{ row }">{{ formatScore(row.score) }} / {{ formatScore(row.maxScore) }}</template>
              </el-table-column>
            </el-table>
          </div>

          <div class="section-block">
            <div class="section-label">评分细则</div>
            <el-table :data="currentReport.criterionScores || []" stripe size="small">
              <el-table-column prop="criterionName" label="评分项" min-width="220" />
              <el-table-column label="得分" width="120">
                <template #default="{ row }">{{ formatScore(row.score) }} / {{ formatScore(row.maxScore) }}</template>
              </el-table-column>
              <el-table-column label="得分率" width="120">
                <template #default="{ row }">{{ formatScore(row.scoreRate) }}%</template>
              </el-table-column>
            </el-table>
          </div>

          <div class="section-block two-column">
            <div class="info-card">
              <div class="section-label">优势分析</div>
              <div class="tag-list">
                <el-tag v-for="item in currentReport.strengths || []" :key="item" type="success" effect="light">{{ item }}</el-tag>
              </div>
            </div>
            <div class="info-card">
              <div class="section-label">改进建议</div>
              <div class="tag-list">
                <el-tag v-for="item in currentReport.improvements || []" :key="item" type="warning" effect="light">{{ item }}</el-tag>
              </div>
            </div>
          </div>

          <div class="section-block two-column">
            <div class="info-card">
              <div class="section-label">教师评语</div>
              <div class="info-paragraph">{{ currentReport.teacherFeedback || '暂无教师评语' }}</div>
            </div>
            <div class="info-card">
              <div class="section-label">AI评语</div>
              <div class="info-paragraph">{{ currentReport.aiFeedback || '暂无 AI 评语' }}</div>
            </div>
          </div>

          <div class="section-block">
            <div class="section-label">推荐学习资源</div>
            <div v-if="(currentReport.recommendedResources || []).length === 0" class="empty-text">暂无推荐资源</div>
            <div v-else class="resource-list">
              <div v-for="item in currentReport.recommendedResources || []" :key="`${item.name}-${item.url}`" class="resource-card">
                <div class="resource-top">
                  <strong>{{ item.name }}</strong>
                  <el-tag size="small" effect="plain">{{ item.type }}</el-tag>
                </div>
                <div class="resource-reason">{{ item.reason }}</div>
                <a :href="item.url" target="_blank" rel="noopener noreferrer">查看资源</a>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  exportStudentSubmissionReport,
  getStudentReport,
  getStudentSubmissionReportDetail,
  getStudentSubmissionReportList
} from '@/api/student/statistics'

const pageLoading = ref(false)
const detailLoading = ref(false)
const overview = ref({})
const reportList = ref([])
const currentReport = ref(null)
const selectedReportId = ref(null)
const exportingReportId = ref(null)

const formatDateTime = (value) => {
  if (!value) return '暂无'
  return String(value).replace('T', ' ')
}

const formatScore = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '')
}

const formatDuration = (value) => {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) {
    return remainSeconds ? `${minutes}m ${remainSeconds}s` : `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes ? `${hours}h ${remainMinutes}m` : `${hours}h`
}

const getStatusTagType = (status) => {
  switch (status) {
    case 3: return 'success'
    case 4: return 'danger'
    case 5: return 'warning'
    case 2: return 'warning'
    default: return 'info'
  }
}

const loadOverview = async () => {
  const res = await getStudentReport()
  if (res.code === 200) {
    overview.value = res.data || {}
  }
}

const loadReportList = async () => {
  const res = await getStudentSubmissionReportList()
  if (res.code === 200) {
    reportList.value = res.data || []
    const hasSelected = reportList.value.some(item => item.submissionId === selectedReportId.value)
    if (!reportList.value.length) {
      selectedReportId.value = null
      currentReport.value = null
    } else if (!selectedReportId.value || !hasSelected) {
      selectedReportId.value = reportList.value[0].submissionId
    }
  }
}

const loadReportDetail = async (submissionId) => {
  if (!submissionId) {
    currentReport.value = null
    return
  }
  detailLoading.value = true
  try {
    const res = await getStudentSubmissionReportDetail(submissionId)
    if (res.code === 200) {
      currentReport.value = res.data || null
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载报告详情失败')
  } finally {
    detailLoading.value = false
  }
}

const loadAllData = async () => {
  pageLoading.value = true
  try {
    await Promise.all([loadOverview(), loadReportList()])
    if (selectedReportId.value) {
      await loadReportDetail(selectedReportId.value)
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载报告数据失败')
  } finally {
    pageLoading.value = false
  }
}

const selectReport = async (submissionId) => {
  selectedReportId.value = submissionId
  await loadReportDetail(submissionId)
}

const resolveFileName = (headers, fallbackId) => {
  const disposition = headers?.['content-disposition'] || headers?.['Content-Disposition']
  if (!disposition) return `submission-report-${fallbackId}.docx`
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const normalMatch = disposition.match(/filename="?([^"]+)"?/i)
  return normalMatch?.[1] || `submission-report-${fallbackId}.docx`
}

const handleExport = async (submissionId) => {
  if (!submissionId) return
  exportingReportId.value = submissionId
  try {
    const response = await exportStudentSubmissionReport(submissionId)
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = resolveFileName(response.headers, submissionId)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('报告导出成功')
  } catch (e) {
    ElMessage.error(e?.message || '导出报告失败')
  } finally {
    exportingReportId.value = null
  }
}

onMounted(loadAllData)
</script>

<style scoped lang="scss">
.student-report-page {
  padding: 16px;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    margin: 0 0 6px;
    color: #0f172a;
  }

  p {
    margin: 0;
    color: #64748b;
  }
}

.hero-breadcrumb {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}

.hero-actions {
  display: flex;
  gap: 10px;
}

.metrics {
  margin-bottom: 16px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    color: #64748b;
    font-size: 13px;
  }

  strong {
    font-size: 24px;
    color: #0f172a;
  }
}

.report-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-item {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;

  &:hover {
    border-color: #bfdbfe;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  }

  &:focus-visible {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
  }

  &.active {
    border-color: #60a5fa;
    background: linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%);
    box-shadow: 0 14px 28px rgba(59, 130, 246, 0.12);
  }
}

.report-item-head,
.report-item-foot,
.report-item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.report-item-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.report-item-desc {
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
}

.report-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #64748b;
}

.report-item-foot {
  margin-bottom: 10px;
  font-size: 12px;
  color: #64748b;

  strong {
    font-size: 13px;
    color: #0f172a;
  }
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fbff 0%, #ffffff 100%);

  h3 {
    margin: 4px 0 6px;
    font-size: 22px;
    color: #0f172a;
  }

  p {
    margin: 0;
    color: #64748b;
  }
}

.detail-breadcrumb {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}

.detail-score {
  min-width: 140px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-size: 32px;
    color: #0f172a;
    line-height: 1.1;
  }

  small {
    color: #64748b;
  }
}

.detail-metrics {
  margin-bottom: -4px;
}

.mini-metric {
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-size: 20px;
    color: #0f172a;
  }
}

.section-block {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
}

.section-label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.summary-box,
.info-paragraph {
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
  white-space: pre-wrap;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.info-card {
  padding: 14px;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  background: #fcfdff;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #eef2f7;
  font-size: 13px;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  span {
    color: #64748b;
  }

  strong {
    color: #0f172a;
    text-align: right;
  }
}

.learning-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.learning-metric-card {
  padding: 12px 14px;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  background: #fcfdff;
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-size: 20px;
    color: #0f172a;
  }
}

.learning-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #64748b;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  background: #fcfdff;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
  flex-shrink: 0;
}

.timeline-body {
  min-width: 0;
  flex: 1;
}

.timeline-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #0f172a;
}

.timeline-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #64748b;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.resource-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.resource-card {
  padding: 14px;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  background: #fcfdff;
}

.resource-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.resource-reason {
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
}

.empty-text {
  color: #94a3b8;
  font-size: 13px;
}

@media (max-width: 1200px) {
  .report-layout {
    grid-template-columns: 1fr;
  }

  .learning-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .hero {
    flex-direction: column;
  }

  .hero-actions {
    width: 100%;
  }

  .two-column,
  .resource-list,
  .learning-metrics {
    grid-template-columns: 1fr;
  }

  .detail-hero {
    flex-direction: column;
  }

  .detail-score {
    align-items: flex-start;
  }

  .timeline-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
