import { computed, onMounted, ref, type Component } from 'vue'
import {
  Calendar,
  CircleCheckFilled,
  Clock,
  Folder,
  UserFilled,
  WarningFilled,
} from '@element-plus/icons-vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import {
  fetchPersistedProcessHistoryRecords,
  loadModuleHistory,
  type ProcessHistoryRecord,
} from '../../../shared/process/processHistory'
import {
  fetchAutomationRuns,
  type AutomationRunRecord,
} from '../../web-automation/webAutomationApi'
import {
  findHomeModuleByActivityId,
  findHomePersonByModuleId,
  getHomeModuleLabel,
  getHomePersonLabel,
  homeDashboardHistoryModuleIds,
  homePeople,
  type HomePersonGroup,
} from '../homeModel'

export type ActivityStatus = 'success' | 'failed' | 'running' | 'pending'
export type ActivitySource = 'automation' | 'local'
export type HomeTone = 'primary' | 'success' | 'danger' | 'warning' | 'info'

export interface DashboardActivity {
  id: string
  source: ActivitySource
  sourceLabel: string
  personId: string
  personLabel: string
  moduleLabel: string
  path: string
  status: ActivityStatus
  statusLabel: string
  message: string
  createdAt: string
}

export interface PersonDashboardRow {
  id: string
  name: string
  initial: string
  path: string
  availableModules: number
  total: number
  success: number
  failed: number
  running: number
  latest?: DashboardActivity
  modulesTouched: string[]
}

export interface RecentArtifact {
  id: string
  fileName: string
  moduleLabel: string
  path: string
  createdAt: string
}

export interface HomeMetricTile {
  key: string
  label: string
  value: string
  detail: string
  tone: HomeTone
  icon: Component
}

export interface HomeServiceStatusRow {
  key: string
  title: string
  detail: string
  status: string
  tone: HomeTone
  tagType: 'primary' | 'success' | 'warning' | 'info'
  icon: Component
}

export function useHomeDashboard() {
  const { isEnglish, text } = useAppLanguage()
  const loading = ref(false)
  const loadError = ref('')
  const automationRuns = ref<AutomationRunRecord[]>([])
  const localProcessRecords = ref<ProcessHistoryRecord[]>([])
  const processHistoryPersisted = ref(false)
  const lastUpdated = ref<Date | null>(null)

  onMounted(() => {
    void loadDashboardData()
  })

  const todayLabel = computed(() =>
    new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).format(new Date()),
  )

  const lastUpdatedLabel = computed(() => {
    if (!lastUpdated.value) return text('未刷新')
    return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(lastUpdated.value)
  })

  const allActivities = computed<DashboardActivity[]>(() => {
    const automationActivities = automationRuns.value.map(toAutomationActivity)
    const localActivities = localProcessRecords.value.map(toLocalProcessActivity)

    return [...automationActivities, ...localActivities]
      .filter((activity): activity is DashboardActivity => Boolean(activity && activity.createdAt))
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
  })

  const todayActivities = computed(() => allActivities.value.filter((activity) => isToday(activity.createdAt)))
  const todaySuccessCount = computed(() => todayActivities.value.filter((activity) => activity.status === 'success').length)
  const todayFailedCount = computed(() => todayActivities.value.filter((activity) => activity.status === 'failed').length)
  const activePeopleCount = computed(() => personRows.value.filter((person) => person.total > 0).length)

  const metricTiles = computed<HomeMetricTile[]>(() => [
    {
      key: 'today',
      label: text('今日处理'),
      value: String(todayActivities.value.length),
      detail: text('来自自动化记录与本地处理历史'),
      tone: 'primary',
      icon: Calendar,
    },
    {
      key: 'success',
      label: text('今日成功'),
      value: String(todaySuccessCount.value),
      detail: text('已完成的处理记录'),
      tone: 'success',
      icon: CircleCheckFilled,
    },
    {
      key: 'failed',
      label: text('失败待处理'),
      value: String(todayFailedCount.value),
      detail: todayFailedCount.value > 0 ? text('需要查看错误详情') : text('今日暂无失败记录'),
      tone: 'danger',
      icon: WarningFilled,
    },
    {
      key: 'people',
      label: text('参与人员'),
      value: `${activePeopleCount.value}/${homePeople.length}`,
      detail: text('今日已有处理的人数'),
      tone: 'info',
      icon: UserFilled,
    },
  ])

  const personRows = computed<PersonDashboardRow[]>(() =>
    homePeople.map((person) => {
      const activities = todayActivities.value.filter((activity) => activity.personId === person.id)
      const latest = activities[0]
      const modulesTouched = Array.from(new Set(activities.map((activity) => activity.moduleLabel))).slice(0, 3)

      return {
        id: person.id,
        name: getHomePersonLabel(person, isEnglish.value),
        initial: getPersonInitial(person),
        path: latest?.path || person.primaryModule?.path || '/',
        availableModules: person.modules.length,
        total: activities.length,
        success: activities.filter((activity) => activity.status === 'success').length,
        failed: activities.filter((activity) => activity.status === 'failed').length,
        running: activities.filter((activity) => activity.status === 'running').length,
        latest,
        modulesTouched,
      }
    }),
  )

  const recentActivities = computed(() => allActivities.value.slice(0, 8))

  const recentArtifacts = computed<RecentArtifact[]>(() =>
    localProcessRecords.value
      .filter((record) => Boolean(record.outputFile))
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
      .slice(0, 5)
      .map((record) => {
        const module = findHomeModuleByActivityId(record.moduleId)

        return {
          id: record.id,
          fileName: readFileName(record.outputFile || ''),
          moduleLabel: module ? getHomeModuleLabel(module, isEnglish.value) : record.moduleName,
          path: module?.path || '/',
          createdAt: record.createdAt,
        }
      }),
  )

  const serviceStatusRows = computed<HomeServiceStatusRow[]>(() => [
    {
      key: 'automation-runs',
      title: text('自动化执行记录'),
      detail: loadError.value || `${automationRuns.value.length} ${text('条最近记录')}`,
      status: loadError.value ? text('读取失败') : text('可读取'),
      tone: loadError.value ? 'warning' : 'success',
      tagType: loadError.value ? 'warning' : 'success',
      icon: loadError.value ? WarningFilled : CircleCheckFilled,
    },
    {
      key: 'local-history',
      title: text('本地处理历史'),
      detail: processHistoryPersisted.value
        ? `${localProcessRecords.value.length} ${text('条数据库记录')}`
        : `${localProcessRecords.value.length} ${text('条本机记录')}`,
      status: processHistoryPersisted.value ? 'MySQL' : text('本机缓存'),
      tone: processHistoryPersisted.value ? 'success' : 'primary',
      tagType: processHistoryPersisted.value ? 'success' : 'primary',
      icon: processHistoryPersisted.value ? CircleCheckFilled : Clock,
    },
    {
      key: 'templates',
      title: text('Excel 模板中心'),
      detail: text('集中维护各自动化页面模板'),
      status: text('可维护'),
      tone: 'info',
      tagType: 'info',
      icon: Folder,
    },
  ])

  async function loadDashboardData(): Promise<void> {
    loading.value = true
    loadError.value = ''
    processHistoryPersisted.value = false
    const cachedProcessRecords = collectLocalProcessRecords()
    localProcessRecords.value = cachedProcessRecords

    try {
      const [automationResult, processHistoryResult] = await Promise.allSettled([
        fetchAutomationRuns({ page: 1, pageSize: 80, backendTarget: 'remote' }),
        fetchPersistedProcessHistoryRecords({
          moduleIds: homeDashboardHistoryModuleIds,
          page: 1,
          pageSize: 80,
          backendTarget: 'remote',
        }),
      ])

      if (automationResult.status === 'fulfilled') {
        automationRuns.value = automationResult.value.runs
      } else {
        automationRuns.value = []
        loadError.value = readErrorMessage(
          automationResult.reason,
          text('无法读取自动化执行记录，请确认本地后端和远程 MySQL 数据库连接正常。'),
        )
      }

      if (processHistoryResult.status === 'fulfilled') {
        processHistoryPersisted.value = true
        localProcessRecords.value = mergeProcessHistoryRecords(
          processHistoryResult.value,
          collectLocalProcessRecords(),
        )
      } else {
        processHistoryPersisted.value = false
        localProcessRecords.value = cachedProcessRecords
      }
    } finally {
      if (!processHistoryPersisted.value) {
        localProcessRecords.value = collectLocalProcessRecords()
      }
      lastUpdated.value = new Date()
      loading.value = false
    }
  }

  function toAutomationActivity(run: AutomationRunRecord): DashboardActivity {
    const module = findHomeModuleByActivityId(run.moduleId) || findHomeModuleByActivityId(run.automationId)
    const person = findHomePersonByModuleId(module?.id || run.moduleId || run.automationId)
    const status = normalizeAutomationStatus(run.status)

    return {
      id: `automation-${run.runId}`,
      source: 'automation',
      sourceLabel: text('自动化记录'),
      personId: person?.id || 'general-tools',
      personLabel: person ? getHomePersonLabel(person, isEnglish.value) : text('通用工具'),
      moduleLabel: module ? getHomeModuleLabel(module, isEnglish.value) : run.runName || run.automationId,
      path: module?.path || '/automation-runs',
      status,
      statusLabel: activityStatusLabel(status),
      message: run.message || run.runName || '',
      createdAt: readRunTime(run),
    }
  }

  function toLocalProcessActivity(record: ProcessHistoryRecord): DashboardActivity {
    const module = findHomeModuleByActivityId(record.moduleId)
    const person = findHomePersonByModuleId(record.moduleId)
    const status = record.status === 'error' ? 'failed' : 'success'

    return {
      id: `local-${record.id}`,
      source: 'local',
      sourceLabel: text('本地处理历史'),
      personId: person?.id || 'general-tools',
      personLabel: person ? getHomePersonLabel(person, isEnglish.value) : text('通用工具'),
      moduleLabel: module ? getHomeModuleLabel(module, isEnglish.value) : record.moduleName,
      path: module?.path || '/',
      status,
      statusLabel: activityStatusLabel(status),
      message: record.message || record.outputFile || '',
      createdAt: record.createdAt,
    }
  }

  function getPersonInitial(person: HomePersonGroup): string {
    const label = getHomePersonLabel(person, isEnglish.value)
    return label.slice(0, 1).toUpperCase()
  }

  function activityStatusLabel(status: ActivityStatus): string {
    const map: Record<ActivityStatus, string> = {
      success: '成功',
      failed: '失败',
      running: '执行中',
      pending: '待确认',
    }
    return text(map[status])
  }

  return {
    loading,
    loadError,
    todayLabel,
    lastUpdatedLabel,
    metricTiles,
    personRows,
    activePeopleCount,
    recentActivities,
    recentArtifacts,
    serviceStatusRows,
    loadDashboardData,
    formatActivityTime,
    statusTagType,
  }
}

function collectLocalProcessRecords(): ProcessHistoryRecord[] {
  try {
    return homeDashboardHistoryModuleIds
      .flatMap((moduleId) => loadModuleHistory(moduleId))
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
      .slice(0, 80)
  } catch (_error) {
    return []
  }
}

function mergeProcessHistoryRecords(...sources: ProcessHistoryRecord[][]): ProcessHistoryRecord[] {
  const recordsById = new Map<string, ProcessHistoryRecord>()
  for (const source of sources) {
    for (const record of source) {
      if (!record?.id || recordsById.has(record.id)) {
        continue
      }
      recordsById.set(record.id, record)
    }
  }
  return [...recordsById.values()]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, 80)
}

function readRunTime(run: AutomationRunRecord): string {
  return run.finishedAt || run.startedAt || run.updatedAt || run.createdAt || ''
}

function normalizeAutomationStatus(status: string): ActivityStatus {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'failed'
  if (status === 'running') return 'running'
  return 'pending'
}

export function statusTagType(status: ActivityStatus): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'info'
}

export function formatActivityTime(value?: string, isEnglish = false, emptyLabel = '未知时间'): string {
  const date = parseDate(value)
  if (!date) return emptyLabel

  const locale = isEnglish ? 'en-US' : 'zh-CN'
  if (isToday(date.toISOString())) {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function isToday(value?: string): boolean {
  const date = parseDate(value)
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function parseDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toTimestamp(value?: string): number {
  return parseDate(value)?.getTime() || 0
}

function readFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).pop() || path
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
