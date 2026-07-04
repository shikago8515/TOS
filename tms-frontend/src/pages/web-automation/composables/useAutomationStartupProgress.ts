import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  extractExecutorRunProgress,
  type ExecutorProgress,
  type LocalExecutorRun,
} from '../automationExecutorResponse'

export type AutomationStartupProgressStep = {
  key: string
  label: string
}

type MaybeReadonlyRef<T> = Ref<T> | ComputedRef<T>
type ActiveRunRef = MaybeReadonlyRef<LocalExecutorRun | null>

type UseAutomationStartupProgressOptions = {
  launching: MaybeReadonlyRef<boolean>
  running: MaybeReadonlyRef<boolean>
  statusText: MaybeReadonlyRef<string>
  activeRun?: ActiveRunRef
  steps?: AutomationStartupProgressStep[]
  startingTitle?: string
  runningTitle?: string
  readyTitle?: string
  launcherDetail?: string
  launchDetail?: string
  healthDetail?: string
  runningDetail?: string
}

const defaultSteps: AutomationStartupProgressStep[] = [
  { key: 'launcher', label: '连接本机小助手' },
  { key: 'launch', label: '启动本机执行器' },
  { key: 'health', label: '等待执行器就绪' },
  { key: 'business', label: '打开 Infor Nexus' },
  { key: 'run', label: '处理 Excel 任务' },
]

export function useAutomationStartupProgress(options: UseAutomationStartupProgressOptions) {
  const startupStartedAt = ref(0)
  const startupElapsedSeconds = ref(0)
  let timer: number | null = null

  const startupProgressSteps = computed(() => options.steps || defaultSteps)
  const activeRun = computed(() => options.activeRun?.value || null)
  const activeRunProgress = computed(() => readProgress(activeRun.value))

  const showStartupProgress = computed(() => {
    return options.launching.value || options.running.value || Boolean(activeRun.value)
  })

  const startupActiveStepKey = computed(() => {
    const phase = String(activeRunProgress.value?.phase || activeRun.value?.phase || '').trim()
    const mapped = mapPhaseToStepKey(phase)
    if (mapped) return mapped
    if (options.running.value || activeRun.value) return 'run'
    if (options.launching.value) return 'launch'
    return ''
  })

  const startupProgressPercent = computed(() => {
    const rawPercent = Number(
      activeRunProgress.value?.percent
        ?? activeRunProgress.value?.percentage
        ?? activeRun.value?.percent
        ?? activeRun.value?.percentage
        ?? 0,
    )
    if (Number.isFinite(rawPercent) && rawPercent > 0) {
      return clampPercent(rawPercent)
    }
    if (startupActiveStepKey.value === 'launcher') return 12
    if (startupActiveStepKey.value === 'launch') return 32
    if (startupActiveStepKey.value === 'health') return 45
    if (startupActiveStepKey.value === 'business') return 58
    if (startupActiveStepKey.value === 'run') return 64
    return 0
  })

  const startupCompletedStepKeys = computed(() => {
    if (startupProgressPercent.value >= 100) return startupProgressSteps.value.map((step) => step.key)
    const activeIndex = startupProgressSteps.value.findIndex((step) => step.key === startupActiveStepKey.value)
    if (activeIndex <= 0) return []
    return startupProgressSteps.value.slice(0, activeIndex).map((step) => step.key)
  })

  const startupCurrentStepLabel = computed(() => {
    return startupProgressSteps.value.find((step) => step.key === startupActiveStepKey.value)?.label || '等待启动'
  })

  const startupProgressTitle = computed(() => {
    if (options.running.value || activeRun.value) return options.runningTitle || '自动化正在执行'
    if (options.launching.value) return options.startingTitle || '首次启动耗时较长'
    return options.readyTitle || '执行器已就绪'
  })

  const startupProgressDetail = computed(() => {
    const progressMessage = String(activeRunProgress.value?.message || activeRun.value?.statusMessage || '').trim()
    if (progressMessage) return progressMessage
    const status = String(options.statusText.value || '').trim()
    if (status && (options.running.value || activeRun.value)) return status
    if (startupActiveStepKey.value === 'launcher') {
      return options.launcherDetail || '正在连接本机自动化助手。'
    }
    if (startupActiveStepKey.value === 'launch') {
      return options.launchDetail || '正在启动 Node / Playwright 执行器，首次启动可能会受到系统安全扫描影响。'
    }
    if (startupActiveStepKey.value === 'health') {
      return options.healthDetail || '执行器进程已启动，正在等待健康检查返回。'
    }
    if (startupActiveStepKey.value === 'business') {
      return '执行器已就绪，正在打开业务页面。'
    }
    if (startupActiveStepKey.value === 'run') {
      return options.runningDetail || '执行器正在处理自动化任务。'
    }
    return status || '正在准备自动化任务。'
  })

  watch(showStartupProgress, (visible) => {
    if (visible) {
      startTimer()
      return
    }
    stopTimer()
    startupStartedAt.value = 0
    startupElapsedSeconds.value = 0
  }, { immediate: true })

  onBeforeUnmount(stopTimer)

  function startTimer(): void {
    if (!startupStartedAt.value) startupStartedAt.value = Date.now()
    updateElapsed()
    if (timer !== null) return
    timer = window.setInterval(updateElapsed, 1000)
  }

  function updateElapsed(): void {
    startupElapsedSeconds.value = startupStartedAt.value
      ? Math.max(0, Math.floor((Date.now() - startupStartedAt.value) / 1000))
      : 0
  }

  function stopTimer(): void {
    if (timer === null) return
    window.clearInterval(timer)
    timer = null
  }

  return {
    showStartupProgress,
    startupProgressTitle,
    startupProgressDetail,
    startupProgressPercent,
    startupElapsedSeconds,
    startupCurrentStepLabel,
    startupActiveStepKey,
    startupCompletedStepKeys,
    startupProgressSteps,
  }
}

function readProgress(activeRun: LocalExecutorRun | null): ExecutorProgress | null {
  return extractExecutorRunProgress(activeRun)
}

function mapPhaseToStepKey(phase: string): string {
  if (!phase) return ''
  if (phase === 'launcher') return 'launcher'
  if (phase === 'launch') return 'launch'
  if (phase === 'health') return 'health'
  if (/open-login|login|logged-in|open-shipment-scan|shipment-scan-ready|open-event-management|event-management-ready|open-shipping2|task-center/i.test(phase)) {
    return 'business'
  }
  if (/shipment-scan-po|create-shipment|shipping2|run|business-empty|failed|error|ticket|download|packing|po-auto|tc-inv/i.test(phase)) {
    return 'run'
  }
  return ''
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
