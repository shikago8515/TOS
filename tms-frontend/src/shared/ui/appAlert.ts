import { reactive } from 'vue'

export type AppAlertTone = 'info' | 'success' | 'warning' | 'error'

export type AppAlertOptions = {
  title?: string
  confirmText?: string
  cancelText?: string
  tone?: AppAlertTone
  autoCloseMs?: number
  compact?: boolean
}

export type AppAlertRequest = Required<AppAlertOptions> & {
  id: number
  message: string
  resolve: (confirmed: boolean) => void
}

type AppAlertState = {
  current: AppAlertRequest | null
  queue: AppAlertRequest[]
}

const DEFAULT_TITLES: Record<AppAlertTone, string> = {
  info: '提示',
  success: '操作成功',
  warning: '请注意',
  error: '操作失败',
}

const appAlertState = reactive<AppAlertState>({
  current: null,
  queue: [],
})

let nextAlertId = 1

export function useAppAlertState(): AppAlertState {
  return appAlertState
}

export function showAppAlert(message: string, options: AppAlertOptions = {}): Promise<void> {
  return showAppConfirm(message, options).then(() => undefined)
}

export function showAppConfirm(message: string, options: AppAlertOptions = {}): Promise<boolean> {
  const tone = options.tone || 'warning'
  const normalizedMessage = String(message || '').trim() || DEFAULT_TITLES[tone]

  return new Promise((resolve) => {
    const request: AppAlertRequest = {
      id: nextAlertId,
      message: normalizedMessage,
      tone,
      title: options.title || DEFAULT_TITLES[tone],
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '',
      autoCloseMs: Math.max(0, Number(options.autoCloseMs || 0)),
      compact: Boolean(options.compact),
      resolve,
    }
    nextAlertId += 1

    if (appAlertState.current) {
      appAlertState.queue.push(request)
      return
    }

    appAlertState.current = request
  })
}

export function confirmAppAlert(): void {
  const current = appAlertState.current
  if (!current) return
  appAlertState.current = null
  current.resolve(true)
  dequeueNext()
}

export function cancelAppAlert(): void {
  const current = appAlertState.current
  if (!current) return
  appAlertState.current = null
  current.resolve(false)
  dequeueNext()
}

export function closeAppAlert(): void {
  confirmAppAlert()
}

function dequeueNext(): void {
  if (appAlertState.queue.length > 0) {
    setTimeout(() => {
      if (!appAlertState.current) {
        appAlertState.current = appAlertState.queue.shift() || null
      }
    }, 220)
  }
}

export function installAppAlertBridge(): void {
  globalThis.alert = (message?: unknown) => {
    void showAppAlert(String(message ?? ''), { tone: 'warning' })
  }
}
