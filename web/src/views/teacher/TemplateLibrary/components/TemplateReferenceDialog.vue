<template>
  <el-dialog
    v-model="dialogVisible"
    width="1400px"
    top="4vh"
    :teleported="false"
    :close-on-click-modal="false"
    destroy-on-close
    class="template-reference-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <div class="dialog-icon">
            <el-icon><Reading /></el-icon>
          </div>
          <div>
            <div class="dialog-title">{{ detail?.templateName || '模板参考详情' }}</div>
            <div class="dialog-subtitle">
              用于帮助教师看清这个模板会如何影响案例生成、学生提交结构和评分审查结果。
            </div>
          </div>
        </div>
        <div class="dialog-tags" v-if="detail">
          <el-tag type="primary" effect="plain" round>
            <el-icon><CollectionTag /></el-icon>
            {{ formatTemplateType(detail.templateType) }}
          </el-tag>
          <el-tag :type="difficultyTagType(detail.difficultyLevel)" effect="plain" round>
            <el-icon><Aim /></el-icon>
            {{ difficultyLabel(detail.difficultyLevel) }}
          </el-tag>
        </div>
      </div>
    </template>

    <div class="reference-workbench" v-loading="loading">
      <template v-if="detail">
        <aside class="reference-sidebar">
          <el-card shadow="never" class="sidebar-card">
            <template #header>
              <div class="section-header">
                <el-icon><DataBoard /></el-icon>
                <span>模板概览</span>
              </div>
            </template>
            <div class="summary-list">
              <div class="summary-item">
                <span class="label">案例主题</span>
                <span class="value strong">{{ detail.inputSample?.trainingTopic || detail.templateName || '-' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">推荐难度</span>
                <span class="value">{{ detail.inputSample?.difficultyLabel || difficultyLabel(detail.difficultyLevel) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">数据规模</span>
                <span class="value">{{ detail.inputSample?.datasetScale || '-' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">交付物数量</span>
                <span class="value strong">{{ (detail.inputSample?.deliverables || []).length }} 项</span>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" class="sidebar-card">
            <template #header>
              <div class="section-header">
                <el-icon><InfoFilled /></el-icon>
                <span>教师怎么使用</span>
              </div>
            </template>
            <ol class="hint-list">
              <li>先看“模板输入参考”，判断这个模板是否适合当前课程与班级。</li>
              <li>再看“案例生成效果”，确认 AI 生成出来的案例结构是不是你想要的。</li>
              <li>最后结合“学生提交样例”和“评分审核参考”，决定是否复制为自己的私有模板使用。</li>
            </ol>
          </el-card>

          <el-card shadow="never" class="sidebar-card" v-if="detail.usageTips?.length">
            <template #header>
              <div class="section-header">
                <el-icon><MagicStick /></el-icon>
                <span>参考建议</span>
              </div>
            </template>
            <ul class="hint-list bullet">
              <li v-for="item in detail.usageTips" :key="item">{{ item }}</li>
            </ul>
          </el-card>
        </aside>

        <section class="reference-main">
          <el-tabs v-model="activeTab" class="reference-tabs">
            <el-tab-pane name="input" label="模板输入参考" />
            <el-tab-pane name="generated" label="案例生成效果" />
            <el-tab-pane name="submission" label="学生提交样例" />
            <el-tab-pane name="review" label="评分审核参考" />
          </el-tabs>

          <el-scrollbar class="tab-scrollbar">
            <div v-if="activeTab === 'input'" class="tab-section">
              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><EditPen /></el-icon>
                    <span>自动回填内容</span>
                  </div>
                </template>
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="案例主题">
                    {{ detail.inputSample?.trainingTopic || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="推荐难度">
                    {{ detail.inputSample?.difficultyLabel || difficultyLabel(detail.difficultyLevel) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="数据规模">
                    {{ detail.inputSample?.datasetScale || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="场景风格">
                    {{ detail.inputSample?.storyStyle || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="技术栈" :span="2">
                    <div class="tag-list">
                      <el-tag
                        v-for="item in detail.inputSample?.techStackRequirements || []"
                        :key="item"
                        type="info"
                        effect="plain"
                        round
                      >
                        {{ item }}
                      </el-tag>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="交付物要求" :span="2">
                    <div class="tag-list">
                      <el-tag
                        v-for="item in detail.inputSample?.deliverables || []"
                        :key="item"
                        type="primary"
                        effect="light"
                        round
                      >
                        {{ item }}
                      </el-tag>
                    </div>
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <div class="grid-two">
                <el-card shadow="never" class="content-card">
                  <template #header>
                    <div class="section-header">
                      <el-icon><ChatDotSquare /></el-icon>
                      <span>提示词示例</span>
                    </div>
                  </template>
                  <div class="text-panel">{{ formatTextBlock(detail.promptExample, '暂无提示词示例') }}</div>
                </el-card>

                <el-card shadow="never" class="content-card">
                  <template #header>
                    <div class="section-header">
                      <el-icon><Connection /></el-icon>
                      <span>期望数据结构</span>
                    </div>
                  </template>
                  <div class="text-panel">{{ formatTextBlock(detail.expectedDataSchema, '暂无数据结构说明') }}</div>
                </el-card>
              </div>

              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><List /></el-icon>
                    <span>任务清单示例</span>
                  </div>
                </template>
                <ol class="ordered-list">
                  <li v-for="item in normalizeTextList(detail.taskListExample)" :key="item">{{ item }}</li>
                </ol>
              </el-card>
            </div>

            <div v-else-if="activeTab === 'generated'" class="tab-section">
              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><Monitor /></el-icon>
                    <span>生成案例效果</span>
                  </div>
                </template>
                <div class="preview-block">
                  <div class="preview-title">{{ detail.generatedCaseSample?.caseName || '暂无案例名称' }}</div>

                  <div class="preview-section">
                    <div class="preview-label">业务背景</div>
                    <div class="text-panel">
                      {{ formatTextBlock(detail.generatedCaseSample?.backgroundStory, '暂无业务背景说明') }}
                    </div>
                  </div>

                  <div class="preview-section">
                    <div class="preview-label">任务拆解</div>
                    <ol class="ordered-list">
                      <li v-for="item in detail.generatedCaseSample?.taskList || []" :key="item">{{ item }}</li>
                    </ol>
                  </div>

                  <div class="preview-section">
                    <div class="preview-label">模拟数据摘要</div>
                    <div class="text-panel">
                      {{ formatTextBlock(detail.generatedCaseSample?.mockDataSummary, '暂无模拟数据说明') }}
                    </div>
                  </div>

                  <div class="preview-section">
                    <div class="preview-label">预期学生产出</div>
                    <div class="tag-list">
                      <el-tag
                        v-for="item in detail.generatedCaseSample?.expectedArtifacts || []"
                        :key="item"
                        type="success"
                        effect="light"
                        round
                      >
                        {{ item }}
                      </el-tag>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>

            <div v-else-if="activeTab === 'submission'" class="tab-section">
              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><DocumentChecked /></el-icon>
                    <span>学生提交样例</span>
                  </div>
                </template>
                <el-descriptions :column="2" border class="mb-16">
                  <el-descriptions-item label="学生姓名">
                    <div class="icon-text">
                      <el-icon><User /></el-icon>
                      <span>{{ detail.studentSubmissionSample?.studentName || '-' }}</span>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="提交时间">
                    <div class="icon-text">
                      <el-icon><Clock /></el-icon>
                      <span>{{ detail.studentSubmissionSample?.submittedAt || '-' }}</span>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="提交摘要" :span="2">
                    {{ detail.studentSubmissionSample?.submissionSummary || '-' }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="subsection">
                  <div class="subsection-title">
                    <el-icon><Files /></el-icon>
                    <span>提交文件</span>
                  </div>
                  <el-table :data="detail.studentSubmissionSample?.files || []" border>
                    <el-table-column prop="fileName" label="文件名" min-width="240" />
                    <el-table-column prop="fileType" label="类型" width="100" align="center" />
                    <el-table-column prop="status" label="状态" width="110" align="center">
                      <template #default="{ row }">
                        <el-tag
                          size="small"
                          :type="row.status === '正常' || row.status === '已校验' ? 'success' : 'warning'"
                          effect="light"
                        >
                          {{ row.status }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="comment" label="说明" min-width="220" show-overflow-tooltip />
                  </el-table>
                </div>

                <div class="subsection">
                  <div class="subsection-title">
                    <el-icon><CircleCheck /></el-icon>
                    <span>结构化检查重点</span>
                  </div>
                  <ul class="bullet-list">
                    <li v-for="item in detail.studentSubmissionSample?.validationHighlights || []" :key="item">
                      {{ item }}
                    </li>
                  </ul>
                </div>
              </el-card>
            </div>

            <div v-else class="tab-section">
              <div class="score-overview">
                <div class="score-card">
                  <div class="score-label">
                    <el-icon><DataAnalysis /></el-icon>
                    <span>AI 初评</span>
                  </div>
                  <div class="score-value">{{ formatScore(detail.aiEvaluationSample?.autoScore) }}</div>
                </div>
                <div class="score-card">
                  <div class="score-label">
                    <el-icon><UserFilled /></el-icon>
                    <span>教师评分</span>
                  </div>
                  <div class="score-value">{{ formatScore(detail.teacherReviewSample?.teacherScore) }}</div>
                </div>
                <div class="score-card final">
                  <div class="score-label">
                    <el-icon><Medal /></el-icon>
                    <span>最终参考结果</span>
                  </div>
                  <div class="score-value">{{ formatScore(detail.finalScoreSample?.finalScore) }}</div>
                </div>
              </div>

              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><List /></el-icon>
                    <span>评分细则示例</span>
                  </div>
                </template>
                <el-table :data="detail.aiEvaluationSample?.rubricScores || []" border>
                  <el-table-column prop="item" label="评分项" min-width="220" />
                  <el-table-column label="得分" width="120" align="center">
                    <template #default="{ row }">
                      {{ formatScore(row.score) }} / {{ formatScore(row.maxScore) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="reason" label="评分理由" min-width="260" show-overflow-tooltip />
                </el-table>
              </el-card>

              <div class="grid-two">
                <el-card shadow="never" class="content-card">
                  <template #header>
                    <div class="section-header">
                      <el-icon><Star /></el-icon>
                      <span>AI 认为做得好的地方</span>
                    </div>
                  </template>
                  <ul class="bullet-list">
                    <li v-for="item in detail.aiEvaluationSample?.strengths || []" :key="item">{{ item }}</li>
                  </ul>
                </el-card>

                <el-card shadow="never" class="content-card">
                  <template #header>
                    <div class="section-header">
                      <el-icon><Warning /></el-icon>
                      <span>建议改进的地方</span>
                    </div>
                  </template>
                  <ul class="bullet-list">
                    <li v-for="item in detail.aiEvaluationSample?.improvements || []" :key="item">{{ item }}</li>
                  </ul>
                </el-card>
              </div>

              <el-card shadow="never" class="content-card">
                <template #header>
                  <div class="section-header">
                    <el-icon><ChatLineSquare /></el-icon>
                    <span>教师审核意见</span>
                  </div>
                </template>

                <div class="review-summary">
                  <div class="decision-row">
                    <span class="decision-label">审核结论</span>
                    <el-tag type="success" effect="dark" round>
                      {{ detail.teacherReviewSample?.decision || '暂无' }}
                    </el-tag>
                  </div>
                  <div class="review-comment">
                    {{ detail.teacherReviewSample?.teacherComment || '暂无教师审核意见' }}
                  </div>
                </div>

                <div v-if="detail.teacherReviewSample?.focusPoints?.length" class="tag-list mt-16">
                  <el-tag
                    v-for="item in detail.teacherReviewSample.focusPoints"
                    :key="item"
                    type="danger"
                    effect="light"
                    round
                  >
                    <el-icon><Aim /></el-icon>
                    {{ item }}
                  </el-tag>
                </div>
              </el-card>
            </div>
          </el-scrollbar>
        </section>
      </template>

      <div v-else class="empty-wrap">
        <el-empty description="暂无模板参考数据" :image-size="72" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  Aim,
  ChatDotSquare,
  ChatLineSquare,
  CircleCheck,
  Clock,
  CollectionTag,
  DataAnalysis,
  DataBoard,
  Document,
  DocumentChecked,
  EditPen,
  Files,
  InfoFilled,
  List,
  MagicStick,
  Medal,
  Monitor,
  Reading,
  Star,
  User,
  UserFilled,
  Warning,
  Connection
} from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  loading: Boolean,
  detail: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible'])

const activeTab = ref('input')

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      activeTab.value = 'input'
    }
  }
)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const difficultyLabel = (value) => {
  if (Number(value) === 1) return '初级'
  if (Number(value) === 3) return '高级'
  return '中级'
}

const difficultyTagType = (value) => {
  if (Number(value) === 1) return 'success'
  if (Number(value) === 3) return 'danger'
  return 'warning'
}

const formatTemplateType = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return '通用模板'

  const map = {
    LIBRARY: '图书管理',
    ECOMMERCE: '电商订单',
    COURSE_SELECTION: '选课管理',
    MEETING: '会议预约',
    BLOG: '博客平台'
  }

  return map[raw.toUpperCase()] || raw
}

const normalizeTextList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }

  const text = String(value || '').trim()
  if (!text) return []

  const lineItems = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (lineItems.length > 1) {
    return lineItems
  }

  return text
    .split(/(?=\d+[.)、])/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatTextBlock = (value, emptyText = '-') => {
  const text = String(value || '').trim()
  return text || emptyText
}

const formatScore = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number : String(value)
}
</script>

<style scoped lang="scss">
.template-reference-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

.template-reference-dialog :deep(.el-dialog__header) {
  margin: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #ebeef5;
}

.template-reference-dialog :deep(.el-dialog__body) {
  padding: 0;
  background: #f5f7fa;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecf5ff;
  color: #409eff;
  font-size: 20px;
  flex-shrink: 0;
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.dialog-subtitle {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: #909399;
}

.dialog-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.dialog-tags .el-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dialog-tags .el-tag :deep(.el-icon) {
  margin-right: 0;
}

.reference-workbench {
  display: flex;
  min-height: 104vh;
  max-height: 104vh;
}

.reference-sidebar {
  width: 300px;
  flex-shrink: 0;
  padding: 20px 0 20px 20px;
  background: #fff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-card {
  border: 1px solid #ebeef5;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-item .label {
  font-size: 12px;
  color: #909399;
}

.summary-item .value {
  font-size: 14px;
  color: #303133;
}

.summary-item .strong {
  font-weight: 600;
}

.hint-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.75;
  color: #606266;
}

.hint-list.bullet {
  list-style: disc;
}

.reference-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.reference-tabs {
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.tab-scrollbar {
  flex: 1;
  height: 100%;
}

.tab-section {
  padding: 20px;
}

.content-card + .content-card {
  margin-top: 16px;
}

.grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.text-panel {
  white-space: pre-wrap;
  line-height: 1.75;
  color: #303133;
  background: #f8fafc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
}

.ordered-list,
.bullet-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  color: #303133;
}

.bullet-list {
  list-style: disc;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-list .el-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-list .el-tag :deep(.el-icon) {
  margin-right: 0;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.preview-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-label,
.subsection-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.subsection + .subsection {
  margin-top: 18px;
}

.icon-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mb-16 {
  margin-bottom: 16px;
}

.score-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.score-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 18px 20px;
}

.score-card.final {
  border-color: #409eff;
  background: #f0f7ff;
}

.score-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.score-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.review-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.review-summary .el-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.review-summary .el-tag :deep(.el-icon) {
  margin-right: 0;
}

.decision-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.decision-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.review-comment {
  background: #f8fafc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
  line-height: 1.75;
  color: #303133;
}

.mt-16 {
  margin-top: 16px;
}

.empty-wrap {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

@media (max-width: 1280px) {
  .reference-workbench {
    flex-direction: column;
    max-height: none;
  }

  .reference-sidebar {
    width: 100%;
    padding: 20px;
    border-right: 0;
    border-bottom: 1px solid #ebeef5;
  }

  .grid-two,
  .score-overview {
    grid-template-columns: 1fr;
  }

  .dialog-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
