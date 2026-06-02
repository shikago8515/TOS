<template>
  <el-dialog
    v-model="dialogVisible"
    width="70vw"
    align-center
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
    class="template-editor-dialog-70"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-main">
          <div class="dialog-kicker">{{ isCreateMode ? '模板新建' : '模板维护' }}</div>
          <h3>{{ isCreateMode ? '新建案例模板' : '编辑案例模板' }}</h3>
          <p>
            {{ isCreateMode
              ? '维护教师自己的私有模板，并可通过右侧 AI 助手参考优秀案例自动生成模板草稿。'
              : '维护当前模板的场景说明、提示词、数据结构和任务清单，保存后可继续用于 AI 案例生成。' }}
          </p>
        </div>
      </div>
    </template>

    <div class="editor-workbench">
      <aside class="summary-panel">
        <el-card shadow="never" class="summary-card">
          <template #header>
            <div class="section-header">
              <el-icon><EditPen /></el-icon>
              <span>模板概览</span>
            </div>
          </template>
          <div class="summary-list">
            <div class="summary-item">
              <span class="label">模板名称</span>
              <span class="value strong">{{ form.templateName || '未填写' }}</span>
            </div>
            <div class="summary-item">
              <span class="label">适用场景</span>
              <span class="value">{{ formatTemplateType(form.templateType) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">推荐难度</span>
              <el-tag :type="difficultyTagType(form.difficultyLevel)" effect="plain" round size="small">
                {{ difficultyLabel(form.difficultyLevel) }}
              </el-tag>
            </div>
            <div class="summary-item">
              <span class="label">回填状态</span>
              <span class="value strong">{{ filledFieldCount }}/5 已就绪</span>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="summary-card">
          <template #header>
            <div class="section-header">
              <el-icon><CircleCheck /></el-icon>
              <span>内容完整度</span>
            </div>
          </template>
          <div class="field-status-list">
            <div
              v-for="item in fieldStatusList"
              :key="item.label"
              class="field-status-item"
            >
              <div class="status-left">
                <el-icon :class="{ ready: item.ready }"><CircleCheck /></el-icon>
                <span>{{ item.label }}</span>
              </div>
              <span :class="['status-text', { ready: item.ready }]">
                {{ item.ready ? '已就绪' : '待补充' }}
              </span>
            </div>
          </div>
        </el-card>

        <el-alert
          title="填写建议"
          type="info"
          :closable="false"
          show-icon
          class="usage-alert"
        >
          <template #default>
            <ul class="usage-list">
              <li>模板说明用于告诉教师这个模板适合什么课程、解决什么训练问题。</li>
              <li>提示词示例越具体，后续生成出来的案例结构越稳定。</li>
              <li>任务清单尽量按教学步骤拆开，方便后续直接套用。</li>
            </ul>
          </template>
        </el-alert>
      </aside>

      <section class="form-panel">
        <el-scrollbar class="form-scrollbar">
          <el-form :model="form" label-position="top" class="editor-form">
            <el-card shadow="never" class="section-card">
              <template #header>
                <div class="section-header">
                  <el-icon><CollectionTag /></el-icon>
                  <span>基础信息</span>
                </div>
              </template>

              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="模板名称">
                    <el-input
                      v-model="form.templateName"
                      clearable
                      placeholder="例如：图书管理系统实训模板"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="适用场景">
                    <el-select
                      v-model="form.templateType"
                      filterable
                      allow-create
                      default-first-option
                      placeholder="例如：图书管理 / 电商订单 / 选课管理"
                      style="width: 100%"
                      :teleported="false"
                    >
                      <el-option
                        v-for="option in templateTypeOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="推荐难度">
                    <el-segmented
                      v-model="form.difficultyLevel"
                      :options="difficultyOptions"
                      block
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <div class="inline-tip">
                    <div class="inline-tip-title">难度说明</div>
                    <div class="inline-tip-text">
                      初级适合单表与基础流程，中级适合多实体协作，高级适合完整业务链与综合分析。
                    </div>
                  </div>
                </el-col>
              </el-row>

              <el-form-item label="模板说明">
                <el-input
                  v-model="form.description"
                  type="textarea"
                  resize="vertical"
                  :autosize="{ minRows: 4, maxRows: 8 }"
                  placeholder="说明这个模板适合什么课程、什么业务背景、希望学生最终完成哪些训练成果。"
                />
              </el-form-item>
            </el-card>

            <el-card shadow="never" class="section-card">
              <template #header>
                <div class="section-header">
                  <el-icon><Document /></el-icon>
                  <span>生成参考内容</span>
                </div>
              </template>

              <el-form-item label="提示词示例">
                <el-input
                  v-model="form.promptExample"
                  type="textarea"
                  resize="vertical"
                  :autosize="{ minRows: 6, maxRows: 12 }"
                  placeholder="建议写清角色、业务背景、核心功能、数据库要求、统计分析任务和交付要求。"
                />
              </el-form-item>

              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="期望数据结构">
                    <el-input
                      v-model="form.expectedDataSchema"
                      type="textarea"
                      resize="vertical"
                      :autosize="{ minRows: 8, maxRows: 14 }"
                      placeholder="说明核心实体、关键字段、主外键关系，以及必要的约束要求。"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="任务清单示例">
                    <el-input
                      v-model="form.taskListExample"
                      type="textarea"
                      resize="vertical"
                      :autosize="{ minRows: 8, maxRows: 14 }"
                      placeholder="例如：1. 绘制 ER 图；2. 编写建表 SQL；3. 实现核心流程；4. 输出统计图表；5. 提交实验报告。"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>
          </el-form>
        </el-scrollbar>
      </section>

      <TemplateAiGenerateDialog
        v-if="showAiAssistant"
        :idea="aiIdea"
        :loading="aiLoading"
        :reference-count="aiReferenceCount"
        :reference-case-names="aiReferenceCases"
        :field-status-list="fieldStatusList"
        @update:idea="$emit('update:aiIdea', $event)"
        @submit="$emit('generate-ai')"
      />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-tip">
          保存后可在 AI 案例生成页面直接选用，并自动回填相关模板内容。
        </div>
        <div class="footer-actions">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="$emit('save')">
            {{ editingId ? '保存修改' : '保存模板' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import {
  CircleCheck,
  CollectionTag,
  Document,
  EditPen
} from '@element-plus/icons-vue'
import TemplateAiGenerateDialog from './TemplateAiGenerateDialog.vue'

const props = defineProps({
  visible: Boolean,
  editingId: [Number, String, null],
  form: {
    type: Object,
    required: true
  },
  templateTypeOptions: {
    type: Array,
    default: () => []
  },
  showAiAssistant: {
    type: Boolean,
    default: false
  },
  aiIdea: {
    type: String,
    default: ''
  },
  aiLoading: {
    type: Boolean,
    default: false
  },
  aiReferenceCount: {
    type: Number,
    default: 0
  },
  aiReferenceCases: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:visible',
  'update:aiIdea',
  'generate-ai',
  'save'
])

const dialogVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const isCreateMode = computed(() => !props.editingId)

const difficultyOptions = [
  { label: '初级', value: 1 },
  { label: '中级', value: 2 },
  { label: '高级', value: 3 }
]

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
  if (!raw) return '未设置'
  const upper = raw.toUpperCase()
  const matched = props.templateTypeOptions.find(item => item.value === raw || item.value === upper)
  return matched?.label || raw
}

const fieldStatusList = computed(() => [
  {
    label: '模板名称',
    ready: Boolean(String(props.form.templateName || '').trim())
  },
  {
    label: '模板说明',
    ready: Boolean(String(props.form.description || '').trim())
  },
  {
    label: '提示词示例',
    ready: Boolean(String(props.form.promptExample || '').trim())
  },
  {
    label: '期望数据结构',
    ready: Boolean(String(props.form.expectedDataSchema || '').trim())
  },
  {
    label: '任务清单示例',
    ready: Boolean(String(props.form.taskListExample || '').trim())
  }
])

const filledFieldCount = computed(() => fieldStatusList.value.filter(item => item.ready).length)
</script>

<style scoped lang="scss">
@keyframes slideInUp {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* 核心弹窗布局修正与美化 */
:global(.template-editor-dialog-70) {
  border-radius: 16px !important;
  display: flex !important;
  flex-direction: column;
  margin: 0 !important;
  width: 96vw !important;  
  height: 116vh !important; 
  min-width: 1600px !important; /* 进一步扩大最小宽度保护 */
  max-width: none !important; /* 移除最大宽度约束，让大屏幕完全伸展 */
  max-height: none !important;
  overflow: hidden;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.12), 0 12px 24px -8px rgba(0, 0, 0, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  animation: slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
}

/* 恢复 Element 原本遮罩的 flex 居中属性 */
:global(.el-overlay-dialog) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  box-sizing: border-box;
}

:global(.template-editor-dialog-70 .el-dialog__headerbtn) {
  top: 12px !important;
  right: 16px !important;
}

:global(.template-editor-dialog-70 .el-dialog__header) {
  margin: 0;
  padding: 12px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

:global(.template-editor-dialog-70 .el-dialog__body) {
  flex: 1;
  padding: 0;
  background: #f1f5f9;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:global(.template-editor-dialog-70 .el-dialog__footer) {
  padding: 12px 24px;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

/* 头部样式优化 */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .dialog-kicker {
    display: inline-block;
    padding: 2px 8px;
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #0ea5e9;
    background: #e0f2fe;
    border-radius: 4px;
    width: fit-content;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: #64748b;
  }
}

/* 工作区结构 */
.editor-workbench {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* 左侧概览栏创新设计 */
.summary-panel {
  width: 340px;
  flex-shrink: 0;
  padding: 24px 32px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 5;
}

.summary-card {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 12px;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.03);
    border-color: #cbd5e1;
    transform: translateY(-2px);
  }
}

.summary-card :deep(.el-card__header) {
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.5);
}

.summary-card :deep(.el-card__body) {
  padding: 6px 10px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.section-header .el-icon {
  color: #3b82f6;
  font-size: 18px;
  padding: 6px;
  background: #eff6ff;
  border-radius: 8px;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.summary-item .label {
  color: #64748b;
  font-weight: 500;
}

.summary-item .value {
  color: #0f172a;
  text-align: right;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-item .value.strong {
  font-weight: 700;
  color: #0ea5e9;
}

.field-status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #f1f5f9;
  }
}

.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.status-left .el-icon {
  font-size: 18px;
  color: #cbd5e1;
  transition: color 0.3s ease;
}

.status-left .el-icon.ready {
  color: #10b981;
}

.status-text {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.status-text.ready {
  color: #059669;
  background: #d1fae5;
}

.usage-alert {
  margin-top: auto;
  border-radius: 12px;
  border: none;
  background-color: #f0f9ff;
  border-left: 4px solid #0ea5e9;
}

.usage-alert :deep(.el-alert__title) {
  font-size: 14px;
  font-weight: 700;
  color: #0369a1;
}

.usage-alert :deep(.el-alert__icon) {
  color: #0ea5e9;
}

.usage-list {
  margin: 10px 0 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
  color: #0c4a6e;
}

/* 右侧表单区美化 */
.form-panel {
  flex: 1;
  min-width: 0;
  position: relative;
}

.form-scrollbar {
  height: 100%;
}

.editor-form {
  padding: 32px;
  max-width: 800px;
  margin: 0 auto;
}

.section-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  margin-bottom: 24px;
  background: #ffffff;
  overflow: hidden;
}

.section-card :deep(.el-card__header) {
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  padding: 16px 24px;
}

.section-card :deep(.el-card__body) {
  padding: 24px;
}

.editor-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: #334155;
  padding-bottom: 8px;
}

.editor-form :deep(.el-input__wrapper),
.editor-form :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #cbd5e1 inset;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 0 0 1px #94a3b8 inset;
  }
  
  &.is-focus, &:focus {
    box-shadow: 0 0 0 2px #3b82f6 inset;
    background: #ffffff;
  }
}

.inline-tip {
  height: calc(100% - 24px);
  padding: 16px;
  border-radius: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.inline-tip-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #d97706;
}

.inline-tip-text {
  font-size: 13px;
  line-height: 1.6;
  color: #92400e;
}

/* 底部操作区 */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-tip {
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
  }
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.footer-actions :deep(.el-button) {
  border-radius: 8px;
  padding: 10px 24px;
  font-weight: 600;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:active {
    transform: scale(0.96);
  }
}

.footer-actions :deep(.el-button--primary) {
  background-color: #2563eb;
  border-color: #2563eb;
  
  &:hover {
    background-color: #1d4ed8;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }
}

/* 针对小屏幕和响应式的最终优化 */
@media (max-width: 1100px) {
  .editor-workbench {
    flex-direction: column;
    overflow-y: auto;
  }

  .template-editor-dialog :deep(.el-dialog__body) {
    display: block; // 配合外层滚动
  }

  .summary-panel {
    width: 100%;
    max-height: none;
    padding: 20px;
    border-right: 0;
    border-bottom: 1px solid #e2e8f0;
    z-index: 1;
  }

  .editor-form {
    padding: 20px;
  }
}
</style>
