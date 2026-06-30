<template>
  <ExcelProcessPageShell
    title="通用 Excel 映射测试"
    subtitle="上传源文件，选择或上传标准模板，确认字段映射后生成结果。"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <ExcelResultNotice
      :visible="Boolean(message)"
      :tone="messageTone"
      :message="message"
    />

    <div class="jane-grid">
      <div class="jane-main">
        <ExcelUploadSection
          :fields="uploadFields"
          :processing="processing || inspecting"
          :progress="progress"
          badge="源文件 + 模板"
          @update:files="updateUploadFiles"
        >
          <template #after-fields>
            <section class="mapper-panel">
              <div class="mapper-panel__header">
                <h3>模板选择</h3>
                <button class="mapper-btn" type="button" :disabled="templateLoading" @click="loadTemplates">
                  刷新模板
                </button>
              </div>
              <div class="mapper-controls mapper-controls--two">
                <label>
                  <span>模板中心</span>
                  <select v-model="selectedTemplateId" :disabled="templateLoading || templates.length === 0">
                    <option :value="0">不使用模板中心</option>
                    <option v-for="template in templates" :key="template.id" :value="template.id">
                      {{ template.displayName || template.originalFilename }}
                    </option>
                  </select>
                </label>
                <button
                  class="mapper-btn"
                  type="button"
                  :disabled="!templateFile || templateSaving"
                  @click="saveTemplateFile"
                >
                  {{ templateSaving ? '保存中...' : '上传到模板中心' }}
                </button>
              </div>
            </section>

            <section class="mapper-panel">
              <div class="mapper-panel__header">
                <h3>工作表设置</h3>
                <button class="mapper-btn" type="button" :disabled="!canInspect || inspecting" @click="inspectWorkbooks">
                  {{ inspecting ? '识别中...' : '识别字段' }}
                </button>
              </div>
              <div class="mapper-controls">
                <label>
                  <span>源文件 sheet</span>
                  <select v-model="sourceSheetName">
                    <option v-for="sheet in sourceInspection?.sheets || []" :key="sheet.name" :value="sheet.name">
                      {{ sheet.name }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>源表头行</span>
                  <input v-model.number="sourceHeaderRow" min="1" type="number">
                </label>
                <label>
                  <span>源数据起始行</span>
                  <input v-model.number="sourceDataStartRow" min="1" type="number">
                </label>
                <label>
                  <span>模板 sheet</span>
                  <select v-model="templateSheetName">
                    <option v-for="sheet in templateInspection?.sheets || []" :key="sheet.name" :value="sheet.name">
                      {{ sheet.name }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>模板表头行</span>
                  <input v-model.number="templateHeaderRow" min="1" type="number">
                </label>
                <label>
                  <span>模板写入行</span>
                  <input v-model.number="templateDataStartRow" min="1" type="number">
                </label>
              </div>
            </section>

            <section class="mapper-panel">
              <div class="mapper-panel__header">
                <h3>字段匹配</h3>
                <button class="mapper-btn" type="button" :disabled="!canBuildMappings" @click="autoMapFields">
                  自动匹配
                </button>
              </div>
              <div v-if="fieldMappings.length === 0" class="mapper-empty">
                请先上传源文件和模板，并点击识别字段。
              </div>
              <div v-else class="mapper-table-wrap">
                <table class="mapper-table">
                  <thead>
                    <tr>
                      <th>模板字段</th>
                      <th>源文件字段</th>
                      <th>样例值</th>
                      <th>必填</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="mapping in fieldMappings" :key="mapping.targetColumn">
                      <td>{{ mapping.targetHeader || `Column ${mapping.targetColumn}` }}</td>
                      <td>
                        <select
                          :value="mapping.sourceColumn"
                          @change="updateMappingSource(mapping.targetColumn, Number(($event.target as HTMLSelectElement).value))"
                        >
                          <option :value="0">不匹配</option>
                          <option
                            v-for="header in sourceHeaders"
                            :key="header.index"
                            :value="header.index"
                          >
                            {{ header.letter }} - {{ header.label || '(空表头)' }}
                          </option>
                        </select>
                      </td>
                      <td>{{ sourceSampleValue(mapping.sourceColumn) || '-' }}</td>
                      <td>
                        <input
                          type="checkbox"
                          :checked="mapping.required"
                          @change="toggleMappingRequired(mapping.targetColumn, ($event.target as HTMLInputElement).checked)"
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <ResultSummary
              v-if="summaryItems.length > 0"
              :items="summaryItems"
              :status="success ? 'success' : 'error'"
            />
          </template>
        </ExcelUploadSection>
      </div>

      <div class="jane-side">
        <FilePrecheckPanel :groups="fileGroups" />
        <ProcessHistoryPanel :records="historyRecords" @clear="clearHistory" />
      </div>
    </div>
  </ExcelProcessPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import {
  areRequiredFilesReady,
  serializeInputFiles,
} from '../../shared/files/fileGroups'
import {
  appendModuleHistory,
  clearModuleHistory,
  loadModuleHistory,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import {
  buildExcelFileGroups,
  ExcelProcessPageShell,
  ExcelResultNotice,
  ExcelUploadSection,
  type ExcelFileField,
  type ExcelNoticeTone,
  type ExcelPageStat,
  type ExcelToolbarAction,
} from '../../shared/ui/excel-process'
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
import ProcessHistoryPanel from '../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../shared/ui/ResultSummary.vue'
import {
  fetchAutomationTemplates,
  uploadAutomationTemplate,
  type AutomationTemplate,
} from '../web-automation/webAutomationApi'
import {
  downloadExcelTemplateMapperResult,
  inspectExcelTemplateMapperWorkbook,
  processExcelTemplateMapperFiles,
  type ExcelTemplateMapperInspectionResponse,
} from './excelTemplateMapperApi'
import {
  buildAutoFieldMappings,
  buildExcelTemplateMapperSummary,
  excelTemplateMapperModuleId,
  excelTemplateMapperModuleName,
  excelTemplateMapperStorageKey,
  toBackendFieldMappings,
  type ExcelTemplateMapperFieldMapping,
  type ExcelTemplateMapperHeader,
} from './excelTemplateMapperModel'

const sourceFiles = ref<File[]>([])
const templateFiles = ref<File[]>([])
const templates = ref<AutomationTemplate[]>([])
const selectedTemplateId = ref(0)
const sourceInspection = ref<ExcelTemplateMapperInspectionResponse | null>(null)
const templateInspection = ref<ExcelTemplateMapperInspectionResponse | null>(null)
const sourceSheetName = ref('')
const templateSheetName = ref('')
const sourceHeaderRow = ref(1)
const sourceDataStartRow = ref(2)
const templateHeaderRow = ref(1)
const templateDataStartRow = ref(2)
const fieldMappings = ref<ExcelTemplateMapperFieldMapping[]>([])
const inspecting = ref(false)
const processing = ref(false)
const templateLoading = ref(false)
const templateSaving = ref(false)
const progress = ref(0)
const message = ref('')
const messageTone = ref<ExcelNoticeTone>('info')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(excelTemplateMapperModuleId),
)

const sourceFile = computed(() => sourceFiles.value[0] ?? null)
const templateFile = computed(() => templateFiles.value[0] ?? null)
const sourceHeaders = computed<ExcelTemplateMapperHeader[]>(() => sourceInspection.value?.selected_sheet.headers ?? [])
const templateHeaders = computed<ExcelTemplateMapperHeader[]>(() => templateInspection.value?.selected_sheet.headers ?? [])
const canInspect = computed(() => Boolean(sourceFile.value && (templateFile.value || selectedTemplateId.value > 0)))
const canBuildMappings = computed(() => sourceHeaders.value.length > 0 && templateHeaders.value.length > 0)
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value) && fieldMappings.value.length > 0)
const selectedFileCount = computed(() => sourceFiles.value.length + templateFiles.value.length)

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'source',
    label: '用户源 Excel',
    files: sourceFiles.value,
    accept: '.xls,.xlsx,.xlsm',
    acceptLabel: '支持 .xls / .xlsx / .xlsm',
    expectedCount: 1,
  },
  {
    id: 'template',
    label: '标准模板 Excel',
    files: templateFiles.value,
    accept: '.xlsx,.xlsm',
    acceptLabel: '建议 .xlsx / .xlsm',
    expectedCount: 1,
    required: selectedTemplateId.value === 0,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: selectedFileCount.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'mapped-fields',
    label: '已匹配字段',
    value: fieldMappings.value.filter((mapping) => mapping.sourceColumn > 0).length,
    icon: 'link',
    tone: 'green',
  },
  {
    id: 'history-records',
    label: '处理记录',
    value: historyRecords.value.length,
    icon: 'clock',
    tone: 'slate',
  },
])

const toolbarStatus = computed(() => {
  if (processing.value) return '正在生成结果'
  if (inspecting.value) return '正在识别字段'
  if (fieldMappings.value.length > 0) {
    return `已匹配 ${fieldMappings.value.filter((mapping) => mapping.sourceColumn > 0).length}/${fieldMappings.value.length} 个字段`
  }
  return '请先上传源文件和模板'
})

const toolbarActions = computed<ExcelToolbarAction[]>(() => [
  {
    id: 'reset',
    label: '重置',
    icon: 'refresh-cw',
    disabled: processing.value || inspecting.value,
    onClick: resetForm,
  },
  {
    id: 'download',
    label: '下载结果',
    icon: 'download',
    visible: success.value && Boolean(resultFile.value),
    onClick: downloadResult,
  },
  {
    id: 'process',
    label: processing.value ? '生成中...' : '生成结果',
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canProcess.value || processing.value || inspecting.value,
    onClick: startProcess,
  },
])

watch([sourceHeaderRow, templateHeaderRow], () => {
  clearInspectionState()
})

watch(fieldMappings, saveMappingsToLocalStorage, { deep: true })

onMounted(() => {
  loadMappingsFromLocalStorage()
  void loadTemplates()
})

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'source') {
    sourceFiles.value = files
    clearResultState()
    clearInspectionState()
    return
  }

  if (fieldId === 'template') {
    templateFiles.value = files
    clearResultState()
    templateInspection.value = null
    templateSheetName.value = ''
    fieldMappings.value = []
  }
}

async function loadTemplates(): Promise<void> {
  templateLoading.value = true
  try {
    templates.value = await fetchAutomationTemplates(excelTemplateMapperModuleId)
  } catch {
    templates.value = []
  } finally {
    templateLoading.value = false
  }
}

async function saveTemplateFile(): Promise<void> {
  if (!templateFile.value) return

  templateSaving.value = true
  try {
    const template = await uploadAutomationTemplate({
      moduleId: excelTemplateMapperModuleId,
      templateKey: 'default',
      displayName: templateFile.value.name,
      file: templateFile.value,
    })
    templates.value = [template, ...templates.value.filter((item) => item.id !== template.id)]
    selectedTemplateId.value = template.id
    messageTone.value = 'success'
    message.value = '模板已上传到模板中心。'
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '模板上传失败')
  } finally {
    templateSaving.value = false
  }
}

async function inspectWorkbooks(): Promise<void> {
  if (!sourceFile.value) {
    showWarning('请先上传用户源 Excel。')
    return
  }
  if (!templateFile.value && selectedTemplateId.value <= 0) {
    showWarning('请上传标准模板或选择模板中心记录。')
    return
  }

  inspecting.value = true
  clearResultState()
  try {
    sourceInspection.value = await inspectExcelTemplateMapperWorkbook({
      file: sourceFile.value,
      sheetName: sourceSheetName.value || undefined,
      headerRow: sourceHeaderRow.value,
    })
    sourceSheetName.value = sourceInspection.value.selected_sheet.name
    sourceDataStartRow.value = sourceInspection.value.selected_sheet.header_row + 1

    templateInspection.value = await inspectExcelTemplateMapperWorkbook({
      file: templateFile.value || undefined,
      templateId: selectedTemplateId.value || undefined,
      sheetName: templateSheetName.value || undefined,
      headerRow: templateHeaderRow.value,
    })
    templateSheetName.value = templateInspection.value.selected_sheet.name
    templateDataStartRow.value = templateInspection.value.selected_sheet.header_row + 1
    autoMapFields()
    messageTone.value = 'success'
    message.value = '字段识别完成，请确认字段匹配。'
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '字段识别失败，请检查 Excel 文件和表头行')
  } finally {
    inspecting.value = false
  }
}

function autoMapFields(): void {
  if (!canBuildMappings.value) return
  fieldMappings.value = buildAutoFieldMappings(sourceHeaders.value, templateHeaders.value)
}

function updateMappingSource(targetColumn: number, sourceColumn: number): void {
  const sourceHeader = sourceHeaders.value.find((header) => header.index === sourceColumn)
  fieldMappings.value = fieldMappings.value.map((mapping) =>
    mapping.targetColumn === targetColumn
      ? {
          ...mapping,
          sourceColumn,
          sourceHeader: sourceHeader?.label ?? '',
        }
      : mapping,
  )
}

function toggleMappingRequired(targetColumn: number, required: boolean): void {
  fieldMappings.value = fieldMappings.value.map((mapping) =>
    mapping.targetColumn === targetColumn ? { ...mapping, required } : mapping,
  )
}

async function startProcess(): Promise<void> {
  if (!sourceFile.value) {
    showWarning('请先上传用户源 Excel。')
    return
  }
  if (!templateFile.value && selectedTemplateId.value <= 0) {
    showWarning('请上传标准模板或选择模板中心记录。')
    return
  }
  if (fieldMappings.value.length === 0) {
    showWarning('请先识别字段并确认匹配。')
    return
  }

  const unmappedRequired = fieldMappings.value.filter((mapping) => mapping.required && mapping.sourceColumn <= 0)
  if (unmappedRequired.length > 0) {
    showWarning(`还有 ${unmappedRequired.length} 个必填模板字段未匹配。`)
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)
  processing.value = true
  progress.value = 0
  clearResultState()

  try {
    const response = await processExcelTemplateMapperFiles(
      {
        sourceFile: sourceFile.value,
        templateFile: templateFile.value,
        templateId: selectedTemplateId.value || undefined,
        config: {
          source_sheet_name: sourceSheetName.value,
          template_sheet_name: templateSheetName.value,
          source_header_row: sourceHeaderRow.value,
          source_data_start_row: sourceDataStartRow.value,
          template_header_row: templateHeaderRow.value,
          template_data_start_row: templateDataStartRow.value,
          mappings: toBackendFieldMappings(fieldMappings.value),
        },
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )
    success.value = response.success
    resultFile.value = response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.message
    summaryItems.value = buildExcelTemplateMapperSummary(response)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
  } catch (error) {
    success.value = false
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '处理失败，请检查字段匹配和模板设置')
    summaryItems.value = [
      {
        label: '处理状态',
        value: '失败',
        note: '请检查 sheet、表头行、写入行和必填字段匹配。',
      },
    ]
    recordHistory('error', startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

async function downloadResult(): Promise<void> {
  if (resultFile.value) {
    await downloadExcelTemplateMapperResult(resultFile.value)
  }
}

function resetForm(): void {
  sourceFiles.value = []
  templateFiles.value = []
  selectedTemplateId.value = 0
  sourceHeaderRow.value = 1
  sourceDataStartRow.value = 2
  templateHeaderRow.value = 1
  templateDataStartRow.value = 2
  sourceSheetName.value = ''
  templateSheetName.value = ''
  fieldMappings.value = []
  sourceInspection.value = null
  templateInspection.value = null
  processing.value = false
  inspecting.value = false
  clearResultState()
}

function clearInspectionState(): void {
  sourceInspection.value = null
  templateInspection.value = null
  sourceSheetName.value = ''
  templateSheetName.value = ''
  fieldMappings.value = []
}

function clearResultState(): void {
  progress.value = 0
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []
}

function showWarning(nextMessage: string): void {
  messageTone.value = 'warning'
  message.value = nextMessage
  success.value = false
}

function sourceSampleValue(sourceColumn: number): string {
  if (sourceColumn <= 0) return ''
  return sourceHeaders.value.find((header) => header.index === sourceColumn)?.sample_value ?? ''
}

function recordHistory(
  status: ProcessHistoryStatus,
  startedAt: number,
  inputFiles: string[],
): void {
  historyRecords.value = appendModuleHistory({
    moduleId: excelTemplateMapperModuleId,
    moduleName: excelTemplateMapperModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value,
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(excelTemplateMapperModuleId)
  historyRecords.value = []
}

function saveMappingsToLocalStorage(): void {
  try {
    window.localStorage?.setItem(excelTemplateMapperStorageKey, JSON.stringify(fieldMappings.value))
  } catch {
    // Local mapping persistence is only a convenience and must not block processing.
  }
}

function loadMappingsFromLocalStorage(): void {
  try {
    const raw = window.localStorage?.getItem(excelTemplateMapperStorageKey)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    fieldMappings.value = parsed.filter((item): item is ExcelTemplateMapperFieldMapping =>
      Boolean(item && typeof item === 'object' && 'targetColumn' in item && 'sourceColumn' in item),
    )
  } catch {
    fieldMappings.value = []
  }
}
</script>

<style scoped>
.mapper-panel {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  margin-top: 16px;
  padding: 16px;
  background: #fff;
}

.mapper-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.mapper-panel__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.mapper-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.mapper-controls--two {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}

.mapper-controls label {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 13px;
}

.mapper-controls input,
.mapper-controls select,
.mapper-table select {
  width: 100%;
  min-height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  color: #111827;
  font-size: 14px;
}

.mapper-btn {
  min-height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0 12px;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
  font-size: 14px;
}

.mapper-btn:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.mapper-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 18px;
  color: #64748b;
  text-align: center;
}

.mapper-table-wrap {
  overflow-x: auto;
}

.mapper-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
}

.mapper-table th,
.mapper-table td {
  border-bottom: 1px solid #e5e7eb;
  padding: 10px 8px;
  text-align: left;
  vertical-align: middle;
}

.mapper-table th {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

@media (max-width: 920px) {
  .mapper-controls,
  .mapper-controls--two {
    grid-template-columns: 1fr;
  }
}
</style>
