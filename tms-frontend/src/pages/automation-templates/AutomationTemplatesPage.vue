<template>
  <main class="tpl-page">
    <!-- Header -->
    <header class="tpl-header">
      <div class="header-title">
        <h2>Excel 模板中心</h2>
        <p class="header-sub">集中维护每个自动化页面的 Excel 模板，替换后页面下载入口会同步使用最新模板。</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" :disabled="loading" @click="loadTemplates">
          <AppIcon name="refresh-cw" :class="{ spin: loading }" />
          刷新模板
        </button>
      </div>
    </header>

    <!-- Compact Editor Toolbar (single-row) -->
    <div class="editor-bar">
      <div v-if="!canEditTemplateForm" class="editor-row editor-row--idle">
        <div class="toolbar-empty">
          <span class="toolbar-empty-dot"></span>
          <div>
            <strong>先选择一个模板</strong>
            <span>点击下方表格左侧小圆点后，再下载、替换或停用模板。</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="startNewTemplate">
          <AppIcon name="plus" />
          新增模板
        </button>
        <label class="toggle">
          <input v-model="includeInactive" type="checkbox" @change="loadTemplates" />
          <span class="toggle-track"></span>
          <span class="toggle-label">显示停用</span>
        </label>
      </div>

      <div v-else class="editor-row">
        <!-- Left: Template identity -->
        <div class="editor-section">
          <template v-if="creatingTemplate">
            <div class="custom-select" ref="moduleDropdownRef">
              <button class="select-trigger" @click="toggleModuleDropdown">
                <span class="trigger-label">{{ moduleLabel(form.moduleId) }}</span>
                <AppIcon name="chevron-down" class="trigger-chevron" :class="{ open: moduleDropdownOpen }" />
              </button>
              <Transition name="dropdown">
                <div v-if="moduleDropdownOpen" class="select-menu">
                  <button
                    v-for="module in automationModules"
                    :key="module.id"
                    class="select-option"
                    :class="{ active: form.moduleId === module.id }"
                    @click="selectModule(module.id)"
                  >{{ module.navLabel }}</button>
                </div>
              </Transition>
            </div>

            <div class="template-type-group" :class="{ 'template-type-group--single': selectedTemplateTypes.length === 1 }">
              <button
                v-for="type in selectedTemplateTypes"
                :key="type.key"
                type="button"
                class="template-type-pill"
                :class="{ active: form.templateKey === type.key }"
                :aria-pressed="form.templateKey === type.key"
                :disabled="selectedTemplateTypes.length === 1"
                @click="selectTemplateType(type.key)"
              >
                <span class="template-type-check" aria-hidden="true"></span>
                {{ type.label }}
              </button>
            </div>
          </template>

          <div v-else class="selected-summary">
            <span class="selected-summary-dot"></span>
            <span class="selected-summary-text">{{ moduleLabel(form.moduleId) }}<span class="selected-summary-sep"> · </span>{{ templateTypeLabel(form.moduleId, form.templateKey) }}</span>
          </div>
        </div>

        <!-- Middle: Name + File -->
        <div class="editor-section editor-inputs">
          <div class="mini-input flex-1">
            <input
              v-model.trim="form.displayName"
              :placeholder="creatingTemplate ? '新模板显示名称' : '模板显示名称'"
            />
          </div>

          <label
            class="file-btn"
            :class="{ 'has-file': selectedFile }"
            :title="creatingTemplate ? '选择新模板文件' : '选择文件替换当前模板'"
          >
            <AppIcon :name="selectedFile ? 'files' : 'upload'" />
            <span>{{ selectedFile ? selectedFile.name : (creatingTemplate ? '选择模板文件' : '选择文件替换') }}</span>
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls,.xlsm"
              @change="handleFileChange"
            />
          </label>
        </div>

        <!-- Right: Primary actions -->
        <div class="editor-section editor-actions">
          <button
            v-if="selectedFile"
            class="btn btn-primary"
            :disabled="saving"
            :title="uploadButtonTitle"
            @click="uploadTemplate"
          >
            <AppIcon name="upload" />
            {{ creatingTemplate ? '创建模板' : '替换文件' }}
          </button>
          <button v-if="editingTemplate" class="btn" :disabled="saving" @click="saveTemplateMeta">
            <AppIcon name="files" />
            保存名称
          </button>
        </div>

        <!-- Far right: Utility actions + toggle -->
        <div class="editor-section editor-utils">
          <button v-if="editingTemplate" class="btn-icon" title="下载模板" @click="downloadSelectedTemplate">
            <AppIcon name="download" />
          </button>
          <button v-if="editingTemplate" class="btn-icon" :title="editingTemplate?.isActive === false ? '启用' : '停用'" :disabled="saving" @click="toggleSelectedTemplate">
            <AppIcon :name="editingTemplate?.isActive === false ? 'play-circle' : 'stop-circle'" />
          </button>
          <span class="utils-divider"></span>
          <button class="btn btn-ghost" @click="resetForm">
            <AppIcon name="arrow-left" />
            取消
          </button>
          <label class="toggle">
            <input v-model="includeInactive" type="checkbox" @change="loadTemplates" />
            <span class="toggle-track"></span>
            <span class="toggle-label">显示停用</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Template Table -->
    <section class="card table-card">
      <div class="card-head">
        <strong>模板清单</strong>
        <span class="badge">{{ templates.length }} 个模板</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>选择</th>
              <th>自动化页面</th>
              <th>模板名称 & 类型</th>
              <th>源文件</th>
              <th>状态</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(template, index) in templates"
              :key="template.id"
              class="row-enter"
              :class="{ inactive: template.isActive === false, selected: selectedTemplateId === template.id }"
              :style="{ animationDelay: `${index * 0.025}s` }"
              @click="selectTemplateForOperation(template)"
            >
              <td>
                <button
                  type="button"
                  class="row-selector"
                  :class="{ active: selectedTemplateId === template.id }"
                  :aria-pressed="selectedTemplateId === template.id"
                  title="选择这个模板"
                  @click.stop="selectTemplateForOperation(template)"
                >
                  <span class="row-selector-dot" aria-hidden="true"></span>
                </button>
              </td>
              <td><span class="tag">{{ moduleLabel(template.moduleId) }}</span></td>
              <td>
                <span class="cell-name">{{ template.displayName }}</span>
                <span class="cell-key">{{ templateTypeLabel(template.moduleId, template.templateKey) }}</span>
              </td>
              <td>
                <div class="file-cell">
                  <AppIcon name="file-text" class="fc-icon" />
                  <div>
                    <span class="fc-name" :title="template.originalFilename">{{ template.originalFilename }}</span>
                    <span class="fc-meta">{{ formatSize(template.fileSize) }} · {{ shortHash(template.sha256) }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="pill" :class="template.isActive === false ? 'pill--off' : 'pill--on'">
                  <span class="pill-dot"></span>
                  {{ template.isActive === false ? '已停用' : '启用中' }}
                </span>
              </td>
              <td><span class="cell-date">{{ formatDate(template.updatedAt || template.createdAt) }}</span></td>
            </tr>
            <tr v-if="!templates.length && !loading">
              <td colspan="6" class="empty-cell">
                <AppIcon name="archive" class="empty-icon" />
                <p>暂无模板记录</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import AppIcon from '../../shared/ui/AppIcon.vue'
import { showAppAlert, showAppConfirm } from '../../shared/ui/appAlert'
import { tosModules } from '../../domain/moduleCatalog'
import {
  automationTemplateModules,
  findAutomationTemplateModule,
  getDefaultTemplateKey,
  getTemplateTypeLabel,
  normalizeTemplateKeyForModule,
} from './automationTemplateModules'
import {
  deleteAutomationTemplate,
  downloadAutomationTemplate,
  fetchAllAutomationTemplates,
  updateAutomationTemplate,
  uploadAutomationTemplate,
  type AutomationTemplate,
} from '../web-automation/webAutomationApi'

// ---- State ----
const loading = ref(false)
const saving = ref(false)
const includeInactive = ref(false)
const templates = ref<AutomationTemplate[]>([])
const editingTemplate = ref<AutomationTemplate | null>(null)
const selectedTemplateId = ref<number | null>(null)
const creatingTemplate = ref(false)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  moduleId: 'shipping-automation',
  templateKey: 'default',
  displayName: '',
})

// ---- Custom Dropdown State ----
const moduleDropdownOpen = ref(false)
const moduleDropdownRef = ref<HTMLElement | null>(null)

function toggleModuleDropdown() {
  moduleDropdownOpen.value = !moduleDropdownOpen.value
}
function selectModule(id: string) {
  form.moduleId = id
  form.templateKey = normalizeTemplateKeyForModule(id, form.templateKey)
  moduleDropdownOpen.value = false
}
function selectTemplateType(templateKey: string) {
  form.templateKey = normalizeTemplateKeyForModule(form.moduleId, templateKey)
}
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (moduleDropdownRef.value && !moduleDropdownRef.value.contains(target)) {
    moduleDropdownOpen.value = false
  }
}

onMounted(() => {
  form.moduleId = automationModules.value[0]?.id || 'shipping-automation'
  document.addEventListener('click', handleClickOutside, true)
  void loadTemplates()
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

// ---- Computed ----
const automationModules = computed(() => automationTemplateModules)
const selectedTemplateTypes = computed(() =>
  findAutomationTemplateModule(form.moduleId)?.templateTypes || [{ key: 'default', label: '默认模板' }],
)
const canEditTemplateForm = computed(() => creatingTemplate.value || Boolean(editingTemplate.value))
const uploadButtonTitle = computed(() => {
  if (!canEditTemplateForm.value) return '请先勾选模板，或点击新增模板'
  if (!selectedFile.value) return '请先选择 Excel 文件'
  return creatingTemplate.value ? '上传新的模板文件' : '替换当前选中模板的文件'
})

// ---- Data ----
async function loadTemplates(): Promise<void> {
  loading.value = true
  try {
    templates.value = await fetchAllAutomationTemplates(includeInactive.value)
    syncSelectedTemplateAfterLoad()
  } finally {
    loading.value = false
  }
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
  if (selectedFile.value && !form.displayName) {
    form.displayName = selectedFile.value.name.replace(/\.(xlsx|xls|xlsm)$/i, '')
  }
}

async function uploadTemplate(): Promise<void> {
  if (!selectedFile.value) return
  saving.value = true
  try {
    await uploadAutomationTemplate({
      moduleId: form.moduleId,
      templateKey: normalizeTemplateKeyForModule(form.moduleId, form.templateKey),
      displayName: form.displayName || selectedFile.value.name,
      file: selectedFile.value,
    })
    resetForm()
    await loadTemplates()
  } finally {
    saving.value = false
  }
}

function selectTemplateForOperation(template: AutomationTemplate): void {
  if (selectedTemplateId.value === template.id) {
    resetForm()
    return
  }
  selectedTemplateId.value = template.id
  creatingTemplate.value = false
  editingTemplate.value = template
  form.moduleId = template.moduleId
  form.templateKey = normalizeTemplateKeyForModule(template.moduleId, template.templateKey)
  form.displayName = template.displayName
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function saveTemplateMeta(): Promise<void> {
  if (!editingTemplate.value) return
  saving.value = true
  try {
    await updateAutomationTemplate(editingTemplate.value.id, {
      moduleId: form.moduleId,
      templateKey: normalizeTemplateKeyForModule(form.moduleId, form.templateKey),
      displayName: form.displayName || 'Excel 模板',
      isActive: editingTemplate.value.isActive !== false,
    })
    resetForm()
    await loadTemplates()
  } finally {
    saving.value = false
  }
}

async function toggleTemplate(template: AutomationTemplate, isActive: boolean): Promise<void> {
  await updateAutomationTemplate(template.id, { isActive })
  resetForm()
  await loadTemplates()
}

async function removeTemplate(template: AutomationTemplate): Promise<void> {
  const confirmed = await showAppConfirm(
    `确定停用模板「${template.displayName}」吗？停用后该模板将不再出现在下载选项中。`,
    { title: '停用模板', confirmText: '确定停用', cancelText: '取消', tone: 'warning' },
  )
  if (!confirmed) return
  await deleteAutomationTemplate(template.id)
  resetForm()
  await loadTemplates()
}

async function downloadSelectedTemplate(): Promise<void> {
  if (!editingTemplate.value) return
  await downloadTemplate(editingTemplate.value)
}

async function toggleSelectedTemplate(): Promise<void> {
  if (!editingTemplate.value) return
  if (editingTemplate.value.isActive === false) {
    await toggleTemplate(editingTemplate.value, true)
    return
  }
  await removeTemplate(editingTemplate.value)
}

async function downloadTemplate(template: AutomationTemplate): Promise<void> {
  try {
    await downloadAutomationTemplate(template)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : '模板下载失败。'
    void showAppAlert(message, { tone: 'warning' })
  }
}

function resetForm(): void {
  editingTemplate.value = null
  selectedTemplateId.value = null
  creatingTemplate.value = false
  selectedFile.value = null
  form.moduleId = automationModules.value[0]?.id || 'shipping-automation'
  form.templateKey = getDefaultTemplateKey(form.moduleId)
  form.displayName = ''
  if (fileInput.value) fileInput.value.value = ''
}

function startNewTemplate(): void {
  resetForm()
  creatingTemplate.value = true
}

function syncSelectedTemplateAfterLoad(): void {
  if (!selectedTemplateId.value) return
  const refreshed = templates.value.find((template) => template.id === selectedTemplateId.value)
  if (!refreshed) {
    resetForm()
    return
  }
  editingTemplate.value = refreshed
  form.moduleId = refreshed.moduleId
  form.templateKey = normalizeTemplateKeyForModule(refreshed.moduleId, refreshed.templateKey)
  form.displayName = refreshed.displayName
}

// ---- Helpers ----
function moduleLabel(moduleId: string): string {
  const templateModule = findAutomationTemplateModule(moduleId)
  if (templateModule) return templateModule.navLabel
  return tosModules.find((module) => module.id === moduleId)?.navLabel || moduleId
}
function templateTypeLabel(moduleId: string, templateKey: string): string {
  return getTemplateTypeLabel(moduleId, templateKey)
}
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
function formatSize(size: number): string {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
function shortHash(value: string): string {
  return value ? value.slice(0, 10) : 'no hash'
}
</script>

<style scoped>
/* ==========================================================================
   Template Page — Compact Professional Layout
   Palette: Teal (#0d9488) + Blue (#3b82f6) | White cards | Thin borders
   Zero purple. Zero glassmorphism.
   ========================================================================== */

.tpl-page {
  --teal: #0d9488;
  --teal-600: #0f766e;
  --teal-400: #2dd4bf;
  --teal-50: #f0fdfa;
  --blue: #3b82f6;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-700: #334155;
  --slate-900: #0f172a;
  --white: #ffffff;
  --red-50: #fef2f2;
  --red-100: #fee2e2;
  --red-600: #dc2626;
  --green-50: #f0fdf4;
  --green-100: #dcfce7;
  --green-600: #059669;
  --amber-600: #d97706;
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --shadow-xs: 0 1px 2px rgba(0,0,0,.03);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.03);
  --shadow-md: 0 4px 12px rgba(0,0,0,.05), 0 1px 4px rgba(0,0,0,.04);
  --transition: 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);

  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 12px 16px;
  color: var(--slate-900);
  background: linear-gradient(180deg, #f5f8fb 0%, #eef7f6 100%);
  overflow: visible;
  box-sizing: border-box;
}

/* ---- Animations ---- */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes spin { 100% { transform: rotate(360deg); } }

.spin { animation: spin 1s linear infinite; }

/* ---- Transitions ---- */
.dropdown-enter-active { animation: scaleIn 0.18s cubic-bezier(0.22, 0.61, 0.36, 1); }
.dropdown-leave-active { animation: scaleIn 0.12s cubic-bezier(0.22, 0.61, 0.36, 1) reverse; }

/* ---- Scrollbar ---- */
.tpl-page ::-webkit-scrollbar { width: 5px; height: 5px; }
.tpl-page ::-webkit-scrollbar-track { background: transparent; }
.tpl-page ::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 10px; }
.tpl-page ::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

/* ==========================================================================
   Header
   ========================================================================== */
.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.header-title h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--slate-900);
  padding-left: 14px;
  position: relative;
  line-height: 1.25;
}
.header-title h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 24px;
  background: linear-gradient(180deg, var(--teal), var(--blue));
  border-radius: 4px;
}
.header-sub {
  margin: 3px 0 0 14px;
  font-size: 12px;
  color: var(--slate-500);
  font-weight: 500;
}
.header-actions { flex-shrink: 0; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--slate-700);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: var(--teal-50);
  border-color: #99f6e4;
  color: var(--teal);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(13,148,136,.1);
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--teal), var(--teal-600));
  border-color: var(--teal-600);
  box-shadow: 0 2px 8px rgba(13,148,136,.25);
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #14b8a6, var(--teal));
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(13,148,136,.35);
}

/* ==========================================================================
   Editor Bar — Compact single-row toolbar (~52px visual height)
   ========================================================================== */
.editor-bar {
  padding: 8px 12px;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0,0,0,.03), 0 4px 12px rgba(0,0,0,.02);
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.05s both;
  transition: box-shadow 0.3s ease;
  position: relative;
  z-index: 10;
}
.editor-bar:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,.04), 0 12px 32px rgba(37,102,139,.06);
}
.editor-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.editor-row--idle {
  min-height: 36px;
}

/* Editor sections — logical groups */
.editor-section {
  display: flex;
  align-items: center;
  gap: 8px;
}
.editor-inputs {
  flex: 1;
  min-width: 0;
}
.editor-utils {
  gap: 4px;
  margin-left: auto;
}

/* Vertical divider between action groups */
.utils-divider {
  width: 1px;
  height: 20px;
  background: var(--slate-200);
  margin: 0 2px;
  flex-shrink: 0;
}

/* Icon-only button */
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--slate-500);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
}
.btn-icon:hover:not(:disabled) {
  background: var(--teal-50);
  border-color: #99f6e4;
  color: var(--teal);
  transform: translateY(-1px);
}
.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Ghost button (no border background) */
.btn-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--slate-400);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--slate-50);
  border-color: var(--slate-200);
  color: var(--slate-600);
}

.toolbar-empty {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  max-width: 360px;
  padding: 4px 10px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-700);
  flex: 1;
}
.toolbar-empty strong {
  display: block;
  font-size: 12px;
  font-weight: 800;
  color: var(--slate-900);
  line-height: 1.2;
}
.toolbar-empty span {
  display: block;
  font-size: 11px;
  color: var(--slate-500);
  line-height: 1.35;
}

.selected-summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-700);
  white-space: nowrap;
  flex-shrink: 0;
}
.selected-summary-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--slate-700);
}
.selected-summary-sep {
  color: var(--slate-300);
  font-weight: 400;
}
.toolbar-empty-dot,
.selected-summary-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.toolbar-empty-dot {
  background: var(--slate-300);
}
.selected-summary-dot {
  background: var(--teal);
  box-shadow: 0 0 0 4px rgba(13,148,136,.12);
}

/* ---- Custom Select ---- */
.custom-select {
  position: relative;
  flex-shrink: 0;
}
.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 140px;
  height: 32px;
  padding: 0 10px 0 12px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-700);
  cursor: pointer;
  transition: all var(--transition);
}
.select-trigger:hover {
  border-color: #99f6e4;
  background: var(--white);
}
.select-trigger:focus-visible {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(13,148,136,.1);
}
.trigger-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trigger-chevron {
  width: 14px;
  height: 14px;
  color: var(--slate-400);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.trigger-chevron.open { transform: rotate(180deg); }
.select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  min-width: 100%;
  max-height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06);
  padding: 4px;
}
.select-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.select-option:hover {
  background: #f0fdfa;
  color: #0d9488;
}
.select-option.active {
  background: linear-gradient(135deg, rgba(13,148,136,.1), rgba(59,130,246,.06));
  color: #0d9488;
  font-weight: 700;
}

/* ---- Template Type Pills ---- */
.template-type-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 32px;
  padding: 3px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
}
.template-type-group--single {
  background: #f8fbfc;
}
.template-type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  max-width: 180px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--slate-500);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.template-type-pill:hover:not(:disabled) {
  color: var(--teal);
  background: #ecfdf5;
}
.template-type-pill.active {
  color: var(--teal-600);
  background: var(--white);
  box-shadow: var(--shadow-xs);
}
.template-type-pill:disabled {
  cursor: default;
  opacity: 0.9;
}
.template-type-check {
  position: relative;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--slate-300);
  border-radius: 4px;
  background: var(--white);
  flex-shrink: 0;
}
.template-type-pill.active .template-type-check {
  border-color: var(--teal);
  background: var(--teal);
}
.template-type-pill.active .template-type-check::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 1px;
  width: 4px;
  height: 7px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* ---- Mini Input ---- */
.mini-input {
  flex-shrink: 0;
  width: 130px;
}
.mini-input.flex-1 { flex: 1; min-width: 120px; max-width: 200px; }
.mini-input input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-900);
  font-size: 12px;
  font-weight: 500;
  outline: none;
  transition: all var(--transition);
  box-sizing: border-box;
}
.mini-input select {
  width: 100%;
  height: 32px;
  padding: 0 30px 0 10px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-900);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  transition: all var(--transition);
  box-sizing: border-box;
}
.mini-input input::placeholder { color: var(--slate-400); font-weight: 400; }
.mini-input input:hover,
.mini-input select:hover { border-color: #99f6e4; background: var(--white); }
.mini-input input:focus {
  border-color: var(--teal);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(13,148,136,.08);
}
.mini-input select:focus {
  border-color: var(--teal);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(13,148,136,.08);
}

/* ---- Compact File Button ---- */
.file-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px dashed var(--slate-300);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-500);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
  position: relative;
}
.file-btn:hover {
  border-color: var(--teal-400);
  background: var(--teal-50);
  color: var(--teal);
}
.file-btn.has-file {
  border-style: solid;
  border-color: var(--teal-400);
  background: var(--teal-50);
  color: var(--teal);
}
.file-btn input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.file-btn span {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Toggle ---- */
.toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-500);
  margin-left: auto;
  user-select: none;
}
.toggle input { display: none; }
.toggle-track {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--slate-300);
  border-radius: 18px;
  transition: all 0.3s ease;
  flex-shrink: 0;
}
.toggle-track::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  left: 3px;
  top: 3px;
  background: var(--white);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
  box-shadow: 0 1px 2px rgba(0,0,0,.1);
}
.toggle input:checked + .toggle-track {
  background: var(--teal);
}
.toggle input:checked + .toggle-track::before {
  transform: translateX(14px);
}

/* ==========================================================================
   Table Card
   ========================================================================== */
.card {
  display: flex;
  flex-direction: column;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(0,0,0,.03), 0 4px 16px rgba(0,0,0,.02);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
  flex: 1;
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.1s both;
}
.card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,.04), 0 12px 32px rgba(37,102,139,.06);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--slate-100);
  background: rgba(248,250,252,.6);
}
.card-head strong {
  font-size: 13px;
  font-weight: 700;
  color: var(--slate-900);
}
.badge {
  padding: 3px 10px;
  background: linear-gradient(135deg, var(--teal-50), #ecfdf5);
  color: var(--teal);
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

/* ---- Table ---- */
.table-wrap {
  flex: 1;
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
th {
  padding: 9px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-400);
  background: rgba(248,250,252,.9);
  position: sticky;
  top: 0;
  z-index: 10;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
th:first-child {
  width: 54px;
  text-align: center;
}
td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(226,232,240,.5);
  vertical-align: middle;
}
td:first-child {
  text-align: center;
}
tbody tr {
  transition: background 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;
}
tbody tr:hover {
  background: rgba(240,253,250,.35);
}
tbody tr.selected {
  background: rgba(240,253,250,.75);
  box-shadow: inset 3px 0 0 var(--teal);
}
tbody tr.inactive {
  opacity: 0.6;
  background: var(--slate-50);
}
tbody tr.inactive.selected {
  background: rgba(248,250,252,.95);
  opacity: 0.85;
}

/* ---- Row Selector (radio-style button) ---- */
.row-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid var(--slate-300);
  border-radius: 50%;
  background: var(--slate-100);
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
  position: relative;
}
.row-selector:hover {
  border-color: var(--slate-400);
  background: var(--white);
  transform: scale(1.1);
}
.row-selector.active {
  border-color: var(--teal);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(13,148,136,.1);
}
.row-selector-dot {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--slate-400);
  transition: all 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.row-selector:hover .row-selector-dot {
  background: var(--slate-500);
}
.row-selector.active .row-selector-dot {
  background: var(--teal);
  width: 10px;
  height: 10px;
}

.row-enter {
  animation: slideIn 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.row-selector {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition);
}
.row-selector:hover {
  background: var(--teal-50);
}
.row-selector-dot {
  width: 13px;
  height: 13px;
  border: 2px solid var(--slate-300);
  border-radius: 999px;
  background: var(--white);
  box-shadow: inset 0 0 0 3px var(--white);
  transition: all var(--transition);
}
.row-selector.active .row-selector-dot {
  border-color: var(--teal);
  background: var(--teal);
  box-shadow: inset 0 0 0 3px var(--white), 0 0 0 3px rgba(13,148,136,.12);
}

.tag {
  display: inline-flex;
  padding: 3px 8px;
  background: var(--slate-100);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-500);
}
.cell-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-900);
  margin-bottom: 1px;
}
.cell-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: var(--slate-400);
}

/* File Cell */
.file-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fc-icon { width: 16px; height: 16px; color: var(--teal-400); flex-shrink: 0; }
.fc-name {
  display: block;
  font-size: 12px;
  color: var(--slate-900);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
.fc-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: var(--slate-400);
}

/* Status Pill */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.pill--on  { background: var(--green-100); color: var(--green-600); }
.pill--on .pill-dot  { background: var(--green-600); }
.pill--off { background: var(--slate-100); color: var(--slate-500); }
.pill--off .pill-dot { background: var(--slate-400); }

.cell-date {
  font-size: 11px;
  color: var(--slate-400);
  white-space: nowrap;
}

/* Actions */
.actions { display: flex; gap: 5px; }
.act-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  background: var(--slate-100);
  color: var(--slate-500);
  cursor: pointer;
  transition: all var(--transition);
}
.act-btn:hover {
  background: var(--slate-200);
  transform: translateY(-1px);
}
.act--teal  { color: var(--teal); background: var(--teal-50); }
.act--teal:hover  { background: #ccfbf1; }
.act--green { color: var(--green-600); background: var(--green-100); }
.act--green:hover { background: var(--green-200); }
.act--red   { color: var(--red-600); background: var(--red-100); }
.act--red:hover   { background: #fecaca; }

.empty-cell {
  text-align: center;
  padding: 56px 20px;
  color: var(--slate-400);
}
.empty-icon { width: 40px; height: 40px; opacity: 0.15; margin-bottom: 8px; }

/* ==========================================================================
   Responsive
   ========================================================================== */
@media (max-width: 1100px) {
  .editor-row { gap: 6px; }
  .mini-input { width: 110px; }
  .file-btn span { max-width: 100px; }
}
@media (max-width: 900px) {
  .editor-row {
    gap: 8px;
  }
  .editor-section {
    flex: 1 1 100%;
    min-width: 0;
  }
  .editor-inputs {
    flex-wrap: wrap;
  }
  .editor-utils {
    margin-left: 0;
  }
  .custom-select { flex: 1; min-width: 130px; }
  .mini-input { flex: 1; min-width: 100px; }
  .mini-input.flex-1 { max-width: none; }
  .file-btn { flex: 1; }
  .toggle { margin-left: 0; }
}
@media (max-width: 768px) {
  .tpl-page { padding: 8px 10px; gap: 8px; }
  .tpl-header { flex-direction: column; align-items: flex-start; }
  .header-title h2 { font-size: 20px; }
}
</style>
