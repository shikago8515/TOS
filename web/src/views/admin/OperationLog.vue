<template>
  <div class="operation-log">
    <el-card shadow="never" class="table-card border-card">
      <template #header>
        <div class="card-header">
          <div class="left-panel">
            <div class="title-box">
              <span class="title">操作日志</span>
              <span class="subtitle">查看管理员端、教师端、学生端及公共接口的操作记录</span>
            </div>
            <el-tag type="primary" effect="light" round class="count-tag">
              <el-icon><Document /></el-icon>
              共 {{ total }} 条
            </el-tag>
          </div>
          <div class="right-panel">
            <el-select
              v-model="filterTerminalType"
              placeholder="筛选端别"
              clearable
              style="width: 160px"
              :teleported="false"
              @change="handleSearch"
            >
              <template #prefix>
                <el-icon><Monitor /></el-icon>
              </template>
              <el-option
                v-for="option in TERMINAL_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select
              v-model="filterModule"
              placeholder="筛选模块"
              clearable
              style="width: 220px"
              :teleported="false"
              @change="handleSearch"
            >
              <template #prefix>
                <el-icon><Menu /></el-icon>
              </template>
              <el-option
                v-for="option in MODULE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button :loading="exporting" @click="handleExport">
              <el-icon class="el-icon--left"><Download /></el-icon>
              导出
            </el-button>
            <el-button icon="Refresh" circle @click="loadLogs" class="refresh-btn" />
          </div>
        </div>
      </template>

      <el-table
        :data="logs"
        style="width: 100%"
        v-loading="loading"
        :header-cell-style="{ background: '#f8f9fb', color: '#606266', height: '50px' }"
        :row-class-name="tableRowClassName"
      >
        <el-table-column label="序号" width="80" align="center">
          <template #default="{ $index }">
            <span class="index-badge">{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="username" label="操作用户" width="160">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="24" class="user-avatar">
                {{ row.username?.charAt(0)?.toUpperCase() || 'U' }}
              </el-avatar>
              <span class="username">{{ row.username || '匿名用户' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="terminalType" label="端别" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="getTerminalLabel(resolveTerminalType(row)) !== '-'"
              :type="getTerminalTagType(resolveTerminalType(row))"
              effect="light"
              round
            >
              {{ getTerminalLabel(resolveTerminalType(row)) }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="module" label="模块" width="160">
          <template #default="{ row }">
            <el-tag :type="getModuleTagType(row.module)" effect="light" round>
              {{ getModuleLabel(row.module) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="action" label="操作" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="action-text">{{ row.action || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="desc-text">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="ipAddress" label="IP 地址" width="150">
          <template #default="{ row }">
            <div class="ip-cell">
              <el-icon><Position /></el-icon>
              <span>{{ row.ipAddress || '-' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="responseCode" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="isSuccessResponse(row.responseCode) ? 'success' : 'danger'"
              effect="dark"
              size="small"
              class="status-tag"
            >
              {{ isSuccessResponse(row.responseCode) ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="executionTime" label="耗时" width="100" align="center">
          <template #default="{ row }">
            <span :class="['time-text', getTimeClass(row.executionTime)]">
              {{ row.executionTime ? `${row.executionTime}ms` : '-' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="操作时间" width="180">
          <template #default="{ row }">
            <div class="date-cell">
              <el-icon><Timer /></el-icon>
              <span>{{ formatDate(row.createdAt) }}</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Download, Menu, Monitor, Position, Timer } from '@element-plus/icons-vue'
import { exportOperationLogs, getOperationLogs } from '@/api/admin/log'

const loading = ref(false)
const exporting = ref(false)
const logs = ref([])
const filterModule = ref('')
const filterTerminalType = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const TERMINAL_LABEL_MAP = {
  ADMIN: '管理员端',
  TEACHER: '教师端',
  STUDENT: '学生端',
  PUBLIC: '公共接口',
  UNKNOWN: '未知端'
}

const MODULE_LABEL_MAP = {
  AUTH: '账号认证',
  PROFILE: '个人资料',
  USER: '用户管理',
  COURSE: '课程管理',
  CLASS: '班级管理',
  TASK: '任务管理',
  CASE: '案例管理',
  SUBMISSION: '提交记录',
  GRADING: '批改评分',
  VALIDATION: '结果验证',
  VALIDATION_RULE: '验证规则',
  LEARNING_PROCESS: '学习过程',
  STATISTICS: '统计报表',
  SYSTEM: '系统配置',
  SYSTEM_PUBLIC: '公共系统',
  LOG: '操作日志',
  NOTICE: '系统通知',
  MONITOR: '系统监控',
  AI_RUNTIME: 'AI 运行配置',
  AI_CHAT: 'AI 对话',
  RAG: '知识库',
  WORKFLOW: '工作流',
  PARAM_TEMPLATE: '参数模板',
  CASE_TEMPLATE: '案例模板',
  TEXTBOOK: '教材管理',
  UNKNOWN: '未知模块'
}

const DISPLAY_TERMINAL_TYPES = ['ADMIN', 'TEACHER', 'STUDENT']

const TERMINAL_OPTIONS = Object.entries(TERMINAL_LABEL_MAP)
  .filter(([value]) => DISPLAY_TERMINAL_TYPES.includes(value))
  .map(([value, label]) => ({
    value,
    label
  }))

const MODULE_OPTIONS = Object.entries(MODULE_LABEL_MAP)
  .filter(([value]) => value !== 'UNKNOWN')
  .map(([value, label]) => ({
    value,
    label
  }))

const normalizeCode = (value) => {
  if (!value) return ''
  return String(value).trim().toUpperCase()
}

const getTerminalLabel = (terminalType) => {
  const normalized = normalizeCode(terminalType)
  return DISPLAY_TERMINAL_TYPES.includes(normalized)
    ? (TERMINAL_LABEL_MAP[normalized] || '-')
    : '-'
}

const inferTerminalTypeFromRequestUrl = (requestUrl) => {
  const path = String(requestUrl || '').trim().toLowerCase()
  if (!path) return ''
  if (path.startsWith('/api/admin') || path.startsWith('/api/auth/admin') || path.startsWith('/api/statistics/admin')) {
    return 'ADMIN'
  }
  if (path.startsWith('/api/teacher') || path.startsWith('/api/statistics/teacher')) {
    return 'TEACHER'
  }
  if (path.startsWith('/api/student') || path.startsWith('/api/statistics/student')) {
    return 'STUDENT'
  }
  if (path.startsWith('/api/public/system')) {
    return 'ADMIN'
  }
  if (path.startsWith('/api/public/')) {
    return 'ADMIN'
  }
  return ''
}

const resolveTerminalType = (row) => {
  const normalized = normalizeCode(row?.terminalType)
  if (DISPLAY_TERMINAL_TYPES.includes(normalized)) return normalized

  if (normalizeCode(row?.module) === 'SYSTEM_PUBLIC') {
    return 'ADMIN'
  }

  const inferred = inferTerminalTypeFromRequestUrl(row?.requestUrl)
  return DISPLAY_TERMINAL_TYPES.includes(inferred) ? inferred : ''
}

const getModuleLabel = (module) => {
  const normalized = normalizeCode(module)
  return MODULE_LABEL_MAP[normalized] || module || '-'
}

const getTerminalTagType = (terminalType) => {
  const normalized = normalizeCode(terminalType)
  const tagMap = {
    ADMIN: 'danger',
    TEACHER: 'success',
    STUDENT: 'primary'
  }
  return tagMap[normalized] || 'info'
}

const getModuleTagType = (module) => {
  const normalized = normalizeCode(module)
  const tagMap = {
    AUTH: 'danger',
    PROFILE: 'success',
    USER: 'primary',
    COURSE: 'success',
    CLASS: 'warning',
    TASK: 'danger',
    CASE: 'info',
    SUBMISSION: 'primary',
    GRADING: 'warning',
    VALIDATION: 'danger',
    VALIDATION_RULE: 'warning',
    LEARNING_PROCESS: 'success',
    STATISTICS: 'primary',
    SYSTEM: '',
    SYSTEM_PUBLIC: 'info',
    LOG: 'warning',
    NOTICE: 'success',
    MONITOR: 'danger',
    AI_RUNTIME: 'danger',
    AI_CHAT: 'primary',
    RAG: 'success',
    WORKFLOW: 'warning',
    PARAM_TEMPLATE: 'info',
    CASE_TEMPLATE: 'info',
    TEXTBOOK: 'primary'
  }
  return tagMap[normalized] || 'info'
}

const isSuccessResponse = (code) => Number(code) === 200 || Number(code) === 0

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getTimeClass = (time) => {
  if (!time) return ''
  if (time < 200) return 'time-fast'
  if (time < 1000) return 'time-medium'
  return 'time-slow'
}

const loadLogs = async () => {
  loading.value = true
  try {
    const res = await getOperationLogs({
      page: currentPage.value,
      size: pageSize.value,
      module: filterModule.value || undefined,
      terminalType: filterTerminalType.value || undefined
    })

    if (res.data?.records) {
      logs.value = res.data.records
      total.value = res.data.total || 0
      return
    }

    if (Array.isArray(res.data)) {
      const allData = res.data
      total.value = allData.length
      const start = (currentPage.value - 1) * pageSize.value
      logs.value = allData.slice(start, start + pageSize.value)
      return
    }

    logs.value = []
    total.value = 0
  } catch (error) {
    console.error('Failed to load operation logs', error)
    ElMessage.error('加载操作日志失败')
  } finally {
    loading.value = false
  }
}

const resolveExportFilename = (headers) => {
  const disposition = headers?.['content-disposition'] || headers?.['Content-Disposition']
  if (!disposition) return 'operation_logs.csv'

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const filenameMatch = disposition.match(/filename=\"?([^\"]+)\"?/i)
  return filenameMatch?.[1] || 'operation_logs.csv'
}

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const handleExport = async () => {
  exporting.value = true
  try {
    const response = await exportOperationLogs({
      module: filterModule.value || undefined,
      terminalType: filterTerminalType.value || undefined
    })
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, resolveExportFilename(response.headers))
    ElMessage.success('操作日志导出成功')
  } catch (error) {
    console.error('Failed to export operation logs', error)
    ElMessage.error('操作日志导出失败')
  } finally {
    exporting.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadLogs()
}

const handleSizeChange = (value) => {
  pageSize.value = value
  currentPage.value = 1
  loadLogs()
}

const handlePageChange = (value) => {
  currentPage.value = value
  loadLogs()
}

const tableRowClassName = () => 'custom-row'

onMounted(() => {
  loadLogs()
})
</script>

<style scoped lang="scss">
.operation-log {
  padding: 0;

  .border-card {
    border: 1px solid #f0f2f5;
    border-radius: 16px;

    :deep(.el-card__header) {
      padding: 20px 24px;
      border-bottom: 1px solid #f5f7fa;
    }

    :deep(.el-card__body) {
      padding: 0;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .left-panel {
    display: flex;
    align-items: center;
    gap: 16px;

    .title-box {
      display: flex;
      flex-direction: column;

      .title {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        line-height: 1.2;
      }

      .subtitle {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }

    .count-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      height: 28px;
    }
  }

  .right-panel {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;

    .refresh-btn {
      transition: transform 0.3s;

      &:hover {
        transform: rotate(180deg);
        color: #409eff;
        background: #ecf5ff;
        border-color: #c6e2ff;
      }
    }
  }
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .user-avatar {
    background: #409eff;
    font-size: 12px;
    font-weight: 600;
  }

  .username {
    font-weight: 500;
    color: #303133;
  }
}

.ip-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
}

.date-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 13px;
}

.action-text {
  font-weight: 500;
  color: #303133;
}

.desc-text {
  color: #606266;
  font-size: 13px;
}

.time-text {
  font-family: monospace;
  font-weight: 500;

  &.time-fast {
    color: #67c23a;
  }

  &.time-medium {
    color: #e6a23c;
  }

  &.time-slow {
    color: #f56c6c;
  }
}

.index-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: #f5f7fa;
  color: #909399;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #f5f7fa;
}

:deep(.el-table) {
  &::before {
    display: none;
  }

  .el-table__inner-wrapper::before {
    display: none;
  }

  .custom-row {
    transition: all 0.2s;

    &:hover {
      background-color: #f9fafc !important;

      td {
        background-color: #f9fafc !important;
      }
    }
  }
}

@media (max-width: 900px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;

    .right-panel {
      width: 100%;
    }
  }
}
</style>
