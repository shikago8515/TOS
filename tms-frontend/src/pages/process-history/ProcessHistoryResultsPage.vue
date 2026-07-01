<template>
  <main class="history-page">
    <header class="history-head">
      <div class="history-head__title">
        <p>{{ text('Process History') }}</p>
        <h1>{{ personLabel }}{{ text(' 历史结果') }}</h1>
        <span>{{ rangeLabel }}</span>
      </div>
      <el-button class="history-btn history-btn--primary" :disabled="loading" :loading="loading" @click="reloadFirstPage">
        <AppIcon name="refresh-cw" :class="{ 'history-spin': loading }" />
        {{ text('刷新') }}
      </el-button>
    </header>

    <div class="history-stats">
      <article class="history-stat">
        <span>{{ text('可下载结果') }}</span>
        <strong>{{ pagination.total }}</strong>
      </article>
      <article class="history-stat">
        <span>{{ text('模块') }}</span>
        <strong>{{ modules.length }}</strong>
      </article>
      <article class="history-stat">
        <span>{{ text('当前页') }}</span>
        <strong>{{ records.length }}</strong>
      </article>
    </div>

    <div class="history-toolbar">
      <el-select
        v-model="selectedModuleId"
        class="history-module-select"
        filterable
        :placeholder="text('全部模块')"
        @change="selectModule"
      >
        <el-option :label="text('全部模块')" value="" />
        <el-option
          v-for="module in modules"
          :key="module.id"
          :label="moduleLabel(module)"
          :value="module.id"
        />
      </el-select>
      <span v-if="usingLocalFallback" class="history-note">
        <AppIcon name="alert-triangle" />
        {{ text('远端读取失败，当前显示本机缓存') }}
      </span>
    </div>

    <div v-if="errorMessage && !usingLocalFallback" class="history-alert">
      <AppIcon name="alert-triangle" />
      <span>{{ text(errorMessage) }}</span>
      <el-button class="history-btn" @click="reloadFirstPage">{{ text('重试') }}</el-button>
    </div>

    <section class="history-table-card">
      <div v-if="loading && records.length === 0" class="history-state">
        <AppIcon name="loader" class="history-spin history-state__icon" />
        <span>{{ text('正在读取历史结果') }}</span>
      </div>

      <div v-else-if="!records.length && (!errorMessage || usingLocalFallback)" class="history-state">
        <AppIcon name="inbox" class="history-state__icon" />
        <strong>{{ text('近30天暂无已归档结果') }}</strong>
      </div>

      <div v-else class="history-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ text('处理时间') }}</th>
              <th>{{ text('模块') }}</th>
              <th>{{ text('结果文件') }}</th>
              <th>{{ text('状态') }}</th>
              <th>{{ text('摘要') }}</th>
              <th>{{ text('输入文件') }}</th>
              <th>{{ text('大小') }}</th>
              <th>{{ text('操作') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td>
                <span class="history-date">{{ formatDate(record.createdAt) }}</span>
                <code>{{ record.id }}</code>
              </td>
              <td><span class="history-tag">{{ moduleName(record.moduleId) }}</span></td>
              <td class="history-file" :title="readHistoryFileName(record)">
                {{ readHistoryFileName(record) }}
              </td>
              <td>
                <span class="history-status" :class="`history-status--${record.status}`">
                  {{ statusLabel(record.status) }}
                </span>
              </td>
              <td class="history-message" :title="readHistoryMessage(record)">
                {{ readHistoryMessage(record) }}
              </td>
              <td class="history-inputs" :title="record.inputFiles.join(', ')">
                {{ record.inputFiles.join(', ') || '-' }}
              </td>
              <td>{{ formatHistoryFileSize(record.resultFile?.fileSize) }}</td>
              <td>
                <el-button
                  class="history-row-btn"
                  :disabled="!record.resultDownloadPath || downloadingRecordId === record.id"
                  @click="downloadRecord(record)"
                >
                  <AppIcon :name="downloadingRecordId === record.id ? 'loader' : 'download'" :class="{ 'history-spin': downloadingRecordId === record.id }" />
                  {{ text('下载') }}
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer v-if="records.length > 0" class="history-pager">
        <el-button class="history-page-btn" :disabled="loading || pagination.page <= 1" @click="goPage(pagination.page - 1)">
          <AppIcon name="chevron-left" />
        </el-button>
        <span>{{ text('第') }} <b>{{ pagination.page }}</b> {{ text('页') }}</span>
        <el-button
          class="history-page-btn"
          :disabled="loading || pagination.page * pagination.pageSize >= pagination.total"
          @click="goPage(pagination.page + 1)"
        >
          <AppIcon name="chevron-right" />
        </el-button>
      </footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { readErrorMessage } from '../../shared/api/backendClient'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import {
  downloadProcessHistoryResult,
  fetchPersistedProcessHistoryRecordPage,
  loadModuleHistory,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
} from '../../shared/process/processHistory'
import {
  findProcessHistoryPersonById,
  getProcessHistoryModulesForPerson,
} from '../../shared/process/processHistoryPeople'
import AppIcon from '../../shared/ui/AppIcon.vue'
import {
  buildDefaultHistoryRange,
  filterLocalDownloadableProcessRecords,
  formatHistoryFileSize,
  readHistoryFileName,
  readHistoryMessage,
} from './processHistoryResultsModel'

const route = useRoute()
const router = useRouter()
const { isEnglish, text } = useAppLanguage()

const loading = ref(false)
const usingLocalFallback = ref(false)
const errorMessage = ref('')
const selectedModuleId = ref('')
const records = ref<ProcessHistoryRecord[]>([])
const downloadingRecordId = ref('')
const range = ref(buildDefaultHistoryRange())
const pagination = reactive({ page: 1, pageSize: 30, total: 0 })

const personId = computed(() => readSingleRouteParam(route.params.personId))
const person = computed(() => findProcessHistoryPersonById(personId.value))
const modules = computed(() => getProcessHistoryModulesForPerson(personId.value))
const personLabel = computed(() => {
  if (!person.value) return text('未知人员')
  return isEnglish.value ? person.value.labelEn : person.value.label
})
const rangeLabel = computed(() =>
  `${formatDateOnly(range.value.createdFrom)} - ${formatDateOnly(range.value.createdTo)}`,
)

watch(
  () => [personId.value, route.query.moduleId],
  () => {
    selectedModuleId.value = normalizeSelectedModuleId(readModuleIdQuery(route.query.moduleId))
    pagination.page = 1
    void loadRecords()
  },
)

onMounted(() => {
  selectedModuleId.value = normalizeSelectedModuleId(readModuleIdQuery(route.query.moduleId))
  void loadRecords()
})

async function loadRecords(): Promise<void> {
  if (!person.value) {
    records.value = []
    pagination.total = 0
    errorMessage.value = '未知人员历史页'
    return
  }

  loading.value = true
  errorMessage.value = ''
  usingLocalFallback.value = false
  range.value = buildDefaultHistoryRange()

  try {
    const payload = await fetchPersistedProcessHistoryRecordPage({
      personId: personId.value,
      moduleIds: selectedModuleId.value ? [selectedModuleId.value] : undefined,
      createdFrom: range.value.createdFrom,
      createdTo: range.value.createdTo,
      downloadableOnly: true,
      page: pagination.page,
      pageSize: pagination.pageSize,
      backendTarget: 'remote',
    })
    records.value = payload.records
    Object.assign(pagination, payload.pagination)
  } catch (error) {
    const fallbackRecords = filterLocalDownloadableProcessRecords(
      collectLocalPersonRecords(),
      {
        personId: personId.value,
        moduleId: selectedModuleId.value || undefined,
        createdFrom: range.value.createdFrom,
        createdTo: range.value.createdTo,
      },
    )
    usingLocalFallback.value = true
    errorMessage.value = readErrorMessage(error, '历史结果读取失败')
    pagination.total = fallbackRecords.length
    records.value = fallbackRecords.slice(
      (pagination.page - 1) * pagination.pageSize,
      pagination.page * pagination.pageSize,
    )
  } finally {
    loading.value = false
  }
}

function collectLocalPersonRecords(): ProcessHistoryRecord[] {
  return modules.value.flatMap((module) => loadModuleHistory(module.id))
}

function selectModule(): void {
  const query = selectedModuleId.value ? { moduleId: selectedModuleId.value } : {}
  void router.replace({ path: route.path, query })
}

function reloadFirstPage(): void {
  pagination.page = 1
  void loadRecords()
}

function goPage(page: number): void {
  pagination.page = page
  void loadRecords()
}

async function downloadRecord(record: ProcessHistoryRecord): Promise<void> {
  if (!record.resultDownloadPath || downloadingRecordId.value) return
  downloadingRecordId.value = record.id
  try {
    await downloadProcessHistoryResult(record)
  } catch (error) {
    errorMessage.value = readErrorMessage(error, '历史结果文件下载失败')
  } finally {
    downloadingRecordId.value = ''
  }
}

function moduleLabel(module: { navLabel: string; navLabelEn: string }): string {
  return isEnglish.value ? module.navLabelEn : module.navLabel
}

function moduleName(moduleId: string): string {
  const module = modules.value.find((item) => item.id === moduleId)
  return module ? moduleLabel(module) : moduleId
}

function statusLabel(status: ProcessHistoryStatus): string {
  return status === 'success' ? text('成功') : text('失败')
}

function formatDate(value?: string): string {
  const date = parseDate(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatDateOnly(value?: string): string {
  const date = parseDate(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function readSingleRouteParam(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return ''
}

function readModuleIdQuery(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return ''
}

function normalizeSelectedModuleId(moduleId: string): string {
  if (!moduleId) return ''
  return modules.value.find(
    (module) => module.id === moduleId || module.catalogId === moduleId || module.routeName === moduleId,
  )?.id ?? ''
}
</script>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 4px;
  color: #0f172a;
  background: #f8fafc;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.history-head__title p,
.history-head__title h1,
.history-head__title span {
  margin: 0;
}

.history-head__title p {
  color: #0d9488;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
}

.history-head__title h1 {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 800;
}

.history-head__title span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.history-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 8px;
}

.history-stat {
  min-height: 58px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.history-stat span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.history-stat strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  font-weight: 800;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.history-module-select {
  width: min(320px, 100%);
}

.history-note,
.history-alert {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
}

.history-alert {
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.history-table-card {
  display: flex;
  flex-direction: column;
  min-height: min(560px, calc(100vh - 260px));
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.history-table-wrap {
  flex: 1;
  overflow: auto;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

td {
  font-size: 12px;
}

tbody tr:hover {
  background: #f0fdfa;
}

.history-date {
  display: block;
  font-weight: 700;
}

code {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}

.history-tag,
.history-status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  font-weight: 800;
}

.history-tag {
  color: #334155;
  background: #f1f5f9;
}

.history-status--success {
  color: #047857;
  background: #d1fae5;
}

.history-status--error {
  color: #b91c1c;
  background: #fee2e2;
}

.history-file,
.history-message,
.history-inputs {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-row-btn,
.history-btn,
.history-page-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-btn--primary {
  color: #ffffff;
  background: #0d9488;
  border-color: #0f766e;
}

.history-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  flex: 1;
  min-height: 320px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.history-state__icon {
  width: 36px;
  height: 36px;
  color: #94a3b8;
}

.history-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 8px 12px;
  background: #f8fafc;
}

.history-pager span {
  color: #64748b;
  font-size: 12px;
}

.history-spin {
  animation: history-spin 0.9s linear infinite;
}

@keyframes history-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .history-head,
  .history-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .history-stats {
    grid-template-columns: 1fr;
  }
}
</style>
