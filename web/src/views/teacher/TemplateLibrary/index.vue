<template>
  <div
    ref="pageRootRef"
    class="template-library-page page-container"
    :class="{ 'dialog-active': dialogVisible }"
    v-loading="loading"
  >
    <section class="page-header">
      <div class="header-main">
        <h2 class="page-title">案例模板库</h2>
        <p class="page-subtitle">
          集中维护当前教师自己的私有模板。模板可用于 AI 案例生成时自动回填背景、要求、数据结构和任务清单；公共参考模板放在右上角独立入口中查看。
        </p>
      </div>
      <div class="header-actions">
        <el-button class="reference-btn" plain @click="openPublicTemplateDrawer">
          <el-icon><Reading /></el-icon>
          公共参考模板
        </el-button>
        <el-button class="secondary-btn" @click="openImportDialog">
          <el-icon><Download /></el-icon>
          导入分享
        </el-button>
        <el-button type="primary" class="create-btn" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建模板
        </el-button>
      </div>
    </section>

    <div class="quick-stats-strip">
      <div class="stat-pill">
        <span class="label">我的模板</span>
        <strong class="value">{{ formatMetric(templates.length) }}</strong>
      </div>
      <el-divider direction="vertical" />
      <div class="stat-pill">
        <span class="label">高级难度</span>
        <strong class="value">{{ formatMetric(advancedTemplateCount) }}</strong>
      </div>
      <el-divider direction="vertical" />
      <div class="stat-pill">
        <span class="label">分享导入</span>
        <strong class="value">{{ formatMetric(importedTemplateCount) }}</strong>
      </div>
    </div>

    <el-card shadow="hover" class="main-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">我的模板</div>
            <div class="card-subtitle">
              这里只展示当前教师自己维护的模板，可编辑、分享、删除，也可以先用 AI 生成草稿再人工确认保存。
            </div>
          </div>
          <el-tag effect="plain" type="primary" round>共 {{ templates.length }} 个</el-tag>
        </div>
      </template>

      <el-table
        :data="templates"
        row-key="id"
        stripe
        class="template-table"
        :header-cell-style="tableHeaderStyle"
      >
        <el-table-column label="模板信息" min-width="360">
          <template #default="{ row }">
            <div class="name-cell">
              <div class="name-top">
                <span class="template-name">{{ row.templateName }}</span>
                <el-tag
                  v-if="isImportedTemplate(row)"
                  type="success"
                  effect="plain"
                  size="small"
                  round
                >
                  分享导入
                </el-tag>
              </div>
              <p class="template-desc">
                {{ row.description || '建议补充适用课程、业务背景和训练目标，方便后续在案例生成页直接套用。' }}
              </p>
              <div class="template-meta-line">
                <span>创建时间：{{ formatDateTime(row.createdAt) }}</span>
                <span v-if="row.updatedAt">最近维护：{{ formatDateTime(row.updatedAt) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="场景" width="140" align="center">
          <template #default="{ row }">
            <el-tag effect="plain" size="small" type="primary">
              {{ formatTemplateType(row.templateType) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="难度" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="difficultyTagType(row.difficultyLevel)" effect="plain" round size="small">
              {{ difficultyLabel(row.difficultyLevel) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="回填内容" min-width="220">
          <template #default="{ row }">
            <div class="usage-cell">
              <div class="usage-tags">
                <el-tag
                  v-for="item in getBackfillTags(row)"
                  :key="`${row.id}-${item}`"
                  size="small"
                  effect="plain"
                  :type="item === '待补充' ? 'info' : 'success'"
                >
                  {{ item }}
                </el-tag>
              </div>
              <small>生成案例时将作为默认参考自动带入。</small>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="最近更新" width="160" align="center">
          <template #default="{ row }">
            <div class="time-cell">
              <span>{{ formatDateTime(row.updatedAt || row.createdAt) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="320" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" link size="small" @click="openReferenceDialog(row)">
                <el-icon><View /></el-icon>
                查看参考
              </el-button>
              <el-divider direction="vertical" />
              <el-button type="primary" link size="small" @click="openEditDialog(row)">
                <el-icon><EditPen /></el-icon>
                编辑
              </el-button>
              <el-divider direction="vertical" />
              <el-button type="success" link size="small" @click="openShareDialog(row)">
                <el-icon><Promotion /></el-icon>
                分享
              </el-button>
              <el-divider direction="vertical" />
              <el-button type="danger" link size="small" @click="removeTemplate(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty
            description="当前还没有私有模板。你可以新建一份模板，或通过分享编号导入其他教师分享的模板副本。"
            :image-size="72"
          />
        </template>
      </el-table>
    </el-card>

    <TemplateEditorDialog
      v-model:visible="dialogVisible"
      :editing-id="editingId"
      :form="form"
      :template-type-options="templateTypeOptions"
      :show-ai-assistant="!editingId"
      :ai-idea="aiGenerateForm.idea"
      :ai-loading="aiGeneratingTemplate"
      :ai-reference-count="aiDraftMeta.referenceCount"
      :ai-reference-cases="aiDraftMeta.referenceCaseNames"
      @update:ai-idea="aiGenerateForm.idea = $event"
      @generate-ai="submitAIGenerate"
      @save="saveTemplate"
    />

    <TemplateReferenceDialog
      v-model:visible="referenceVisible"
      :loading="referenceLoading"
      :detail="referenceDetail"
    />

    <TemplateShareDialog
      v-model:visible="shareDialogVisible"
      :template-name="shareState.templateName"
      :share-code="shareState.shareCode"
      @copy="copyShareCode"
    />

    <TemplateImportDialog
      v-model:visible="importDialogVisible"
      :share-code="importForm.shareCode"
      :loading="importingShareTemplate"
      @update:share-code="importForm.shareCode = $event"
      @submit="submitImportByCode"
    />

    <PublicTemplateDrawer
      v-model:visible="publicDrawerVisible"
      :loading="publicLoading"
      :templates="publicTemplates"
      @preview="previewPublicTemplate"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  Download,
  EditPen,
  MagicStick,
  Plus,
  Promotion,
  Reading,
  View
} from '@element-plus/icons-vue'
import {
  createCaseTemplate,
  deleteCaseTemplate,
  generateCaseTemplateByAi,
  generateCaseTemplateShareCode,
  getCaseTemplateList,
  getCaseTemplateReference,
  getPublicCaseTemplateList,
  importCaseTemplateByShareCode,
  updateCaseTemplate
} from '@/api/teacher/template'
import PublicTemplateDrawer from './components/PublicTemplateDrawer.vue'
import TemplateEditorDialog from './components/TemplateEditorDialog.vue'
import TemplateImportDialog from './components/TemplateImportDialog.vue'
import TemplateReferenceDialog from './components/TemplateReferenceDialog.vue'
import TemplateShareDialog from './components/TemplateShareDialog.vue'

const loading = ref(false)
const pageRootRef = ref(null)
const publicLoading = ref(false)
const templates = ref([])
const publicTemplates = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const referenceVisible = ref(false)
const referenceLoading = ref(false)
const referenceDetail = ref(null)
const shareDialogVisible = ref(false)
const importDialogVisible = ref(false)
const importingShareTemplate = ref(false)
const aiGeneratingTemplate = ref(false)
const publicDrawerVisible = ref(false)

const shareState = reactive({
  templateName: '',
  shareCode: ''
})

const importForm = reactive({
  shareCode: ''
})

const aiGenerateForm = reactive({
  idea: ''
})

const aiDraftMeta = reactive({
  referenceCount: 0,
  referenceCaseNames: []
})

const tableHeaderStyle = {
  background: '#f8fafc',
  color: '#475569',
  fontWeight: '600',
  fontSize: '14px',
  borderBottom: '1px solid #e2e8f0'
}

const templateTypeOptions = [
  { value: 'LIBRARY', label: '图书管理' },
  { value: 'ECOMMERCE', label: '电商订单' },
  { value: 'COURSE_SELECTION', label: '选课管理' },
  { value: 'MEETING', label: '会议预约' },
  { value: 'BLOG', label: '博客平台' },
  { value: 'OTHER', label: '通用模板' }
]

const templateTypeLabelMap = templateTypeOptions.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

const advancedTemplateCount = computed(() => templates.value.filter(item => Number(item.difficultyLevel) === 3).length)
const importedTemplateCount = computed(() => templates.value.filter(isImportedTemplate).length)

const initialForm = () => ({
  templateName: '',
  templateType: '',
  description: '',
  promptExample: '',
  expectedDataSchema: '',
  taskListExample: '',
  difficultyLevel: 2,
  isPublic: 0
})

const form = reactive(initialForm())

const formatMetric = value => {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

const difficultyLabel = value => {
  if (Number(value) === 1) return '初级'
  if (Number(value) === 3) return '高级'
  return '中级'
}

const difficultyTagType = value => {
  if (Number(value) === 1) return 'success'
  if (Number(value) === 3) return 'danger'
  return 'warning'
}

const formatTemplateType = value => {
  const raw = String(value || '').trim()
  const upper = raw.toUpperCase()
  return templateTypeLabelMap[upper] || raw || '通用模板'
}

const formatDateTime = value => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

function isImportedTemplate(row) {
  const name = String(row?.templateName || '')
  return name.includes('（分享导入）') || name.includes('(分享导入)')
}

const getBackfillTags = row => {
  const tags = []
  if (row?.promptExample) tags.push('提示词')
  if (row?.expectedDataSchema) tags.push('数据结构')
  if (row?.taskListExample) tags.push('任务清单')
  return tags.length ? tags : ['待补充']
}

const resetForm = () => {
  Object.assign(form, initialForm())
}

const resetAiState = () => {
  aiGenerateForm.idea = ''
  aiDraftMeta.referenceCount = 0
  aiDraftMeta.referenceCaseNames = []
}

const applyTemplateData = (source = {}) => {
  Object.assign(form, {
    templateName: source.templateName || '',
    templateType: source.templateType || '',
    description: source.description || '',
    promptExample: source.promptExample || '',
    expectedDataSchema: source.expectedDataSchema || '',
    taskListExample: source.taskListExample || '',
    difficultyLevel: Number(source.difficultyLevel) || 2,
    isPublic: 0
  })
}

const applyAiDraftToForm = (draft = {}) => {
  Object.assign(form, {
    templateName: draft.templateName || form.templateName || '',
    templateType: draft.templateType || form.templateType || '',
    description: draft.description || form.description || '',
    promptExample: draft.promptExample || form.promptExample || '',
    expectedDataSchema: draft.expectedDataSchema || form.expectedDataSchema || '',
    taskListExample: draft.taskListExample || form.taskListExample || '',
    difficultyLevel: Number(draft.difficultyLevel) || Number(form.difficultyLevel) || 2,
    isPublic: 0
  })
  aiDraftMeta.referenceCount = Number(draft.referenceCaseCount || 0)
  aiDraftMeta.referenceCaseNames = Array.isArray(draft.referenceCaseNames)
    ? draft.referenceCaseNames.filter(Boolean)
    : []
}

const loadTemplates = async () => {
  loading.value = true
  try {
    const res = await getCaseTemplateList()
    if (res.code === 200) {
      templates.value = res.data || []
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载模板失败')
  } finally {
    loading.value = false
  }
}

const loadPublicTemplates = async () => {
  publicLoading.value = true
  try {
    const res = await getPublicCaseTemplateList()
    if (res.code === 200) {
      publicTemplates.value = res.data || []
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载公共参考模板失败')
  } finally {
    publicLoading.value = false
  }
}

const openCreateDialog = () => {
  editingId.value = null
  resetForm()
  resetAiState()
  dialogVisible.value = true
}

const openAIGenerateDialog = () => {
  editingId.value = null
  resetForm()
  resetAiState()
  dialogVisible.value = true
}

const openEditDialog = row => {
  editingId.value = row.id
  applyTemplateData(row)
  resetAiState()
  dialogVisible.value = true
}

const openReferenceDialog = async row => {
  referenceVisible.value = true
  referenceLoading.value = true
  referenceDetail.value = null
  try {
    const res = await getCaseTemplateReference(row.id)
    if (res.code === 200) {
      referenceDetail.value = res.data
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载模板参考详情失败')
    referenceVisible.value = false
  } finally {
    referenceLoading.value = false
  }
}

const previewPublicTemplate = async row => {
  publicDrawerVisible.value = false
  await openReferenceDialog(row)
}

const submitAIGenerate = async () => {
  const idea = String(aiGenerateForm.idea || '').trim()
  if (!idea) {
    ElMessage.warning('请先输入模板大概内容')
    return
  }

  aiGeneratingTemplate.value = true
  try {
    const res = await generateCaseTemplateByAi({ idea })
    if (res.code === 200 && res.data) {
      editingId.value = null
      dialogVisible.value = true
      applyAiDraftToForm(res.data)
      const referenceCount = Number(res.data.referenceCaseCount || 0)
      ElMessage.success(
        referenceCount > 0
          ? `AI 已参考 ${referenceCount} 个优秀案例，模板草稿已回填到当前表单`
          : 'AI 模板草稿已回填到当前表单'
      )
    }
  } catch (e) {
    ElMessage.error(e?.message || 'AI 生成模板失败')
  } finally {
    aiGeneratingTemplate.value = false
  }
}

const saveTemplate = async () => {
  try {
    if (!String(form.templateName || '').trim()) {
      ElMessage.warning('模板名称不能为空')
      return
    }
    if (!String(form.templateType || '').trim()) {
      ElMessage.warning('请选择或填写适用场景')
      return
    }

    const payload = {
      ...form,
      templateName: String(form.templateName || '').trim(),
      templateType: String(form.templateType || '').trim(),
      description: String(form.description || '').trim(),
      promptExample: String(form.promptExample || '').trim(),
      expectedDataSchema: String(form.expectedDataSchema || '').trim(),
      taskListExample: String(form.taskListExample || '').trim(),
      isPublic: 0
    }

    if (editingId.value) {
      await updateCaseTemplate(editingId.value, payload)
      ElMessage.success('模板更新成功')
    } else {
      await createCaseTemplate(payload)
      ElMessage.success('模板创建成功')
    }

    dialogVisible.value = false
    await loadTemplates()
  } catch (e) {
    ElMessage.error(e?.message || '保存模板失败')
  }
}

const removeTemplate = async row => {
  try {
    await ElMessageBox.confirm(
      `确认删除模板“${row.templateName}”吗？删除后该模板将不再出现在你的模板列表中。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteCaseTemplate(row.id)
    ElMessage.success('模板删除成功')
    await loadTemplates()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '删除模板失败')
    }
  }
}

const openShareDialog = async row => {
  try {
    const res = await generateCaseTemplateShareCode(row.id)
    if (res.code === 200) {
      shareState.templateName = res.data?.templateName || row.templateName || ''
      shareState.shareCode = res.data?.shareCode || ''
      shareDialogVisible.value = true
    }
  } catch (e) {
    ElMessage.error(e?.message || '生成分享编号失败')
  }
}

const copyShareCode = async () => {
  if (!shareState.shareCode) return
  try {
    await navigator.clipboard.writeText(shareState.shareCode)
    ElMessage.success('分享编号已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制分享编号')
  }
}

const openImportDialog = () => {
  importForm.shareCode = ''
  importDialogVisible.value = true
}

const submitImportByCode = async () => {
  const shareCode = String(importForm.shareCode || '').trim()
  if (!shareCode) {
    ElMessage.warning('请输入分享编号')
    return
  }

  importingShareTemplate.value = true
  try {
    const res = await importCaseTemplateByShareCode(shareCode)
    if (res.code === 200) {
      ElMessage.success(`已导入模板：${res.data?.templateName || '分享模板'}`)
      importDialogVisible.value = false
      importForm.shareCode = ''
      await loadTemplates()
    }
  } catch (e) {
    ElMessage.error(e?.message || '导入分享模板失败')
  } finally {
    importingShareTemplate.value = false
  }
}

const openPublicTemplateDrawer = async () => {
  publicDrawerVisible.value = true
  if (!publicTemplates.value.length && !publicLoading.value) {
    await loadPublicTemplates()
  }
}

watch(dialogVisible, (visible) => {
  const pageRoot = pageRootRef.value
  if (pageRoot) {
    pageRoot.style.overflowY = visible ? 'hidden' : ''
  }
})

onBeforeUnmount(() => {
  const pageRoot = pageRootRef.value
  if (pageRoot) {
    pageRoot.style.overflowY = ''
  }
})

onMounted(async () => {
  await Promise.all([loadTemplates(), loadPublicTemplates()])
})
</script>

<style scoped lang="scss">
.template-library-page {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-library-page.dialog-active {
  overflow-y: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding: 18px 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.header-main {
  min-width: 0;
}

.page-title {
  margin: 6px 0 8px;
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
}

.page-subtitle {
  margin: 0;
  max-width: 960px;
  line-height: 1.75;
  color: #64748b;
  font-size: 14px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.create-btn,
.secondary-btn,
.reference-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
}

.create-btn {
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.18);
}

.secondary-btn {
  border-color: #dbeafe;
  color: #2563eb;
  background: #eff6ff;
}

.reference-btn {
  border-color: #cbd5e1;
  color: #475569;
}

.ai-btn {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.quick-stats-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;

  .el-divider {
    height: 18px;
    border-color: #e2e8f0;
  }
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 8px;

  .label {
    font-size: 13px;
    color: #64748b;
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: #2563eb;
  }
}

.main-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #edf2f7;
  }

  :deep(.el-card__body) {
    padding: 0;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.card-subtitle {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}

.template-table {
  flex: 1;

  :deep(.el-table__row:hover > td) {
    background: #f8fbff !important;
  }

  :deep(.el-table__cell) {
    padding: 14px 0;
  }
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.name-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.template-name {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.template-desc {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.template-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: #94a3b8;
}

.usage-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;

  small {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.6;
  }
}

.usage-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.time-cell {
  font-size: 12px;
  color: #475569;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;

  .el-divider {
    margin: 0 6px;
    border-color: #e2e8f0;
  }
}

@media (max-width: 768px) {
  .page-header,
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
