import type {
  DiagnosticEvent,
  ElectronActionResult,
} from '../../types/electronApi'

const moduleName = 'adidas 材料'
const launcherBaseUrl = 'http://127.0.0.1:3210'
const launcherBootProtocolUrl = 'tos://automation/launcher/start'
const launcherStartPath = '/api/adidas-materials/start'

export async function launchAdidasMaterialsCollector(): Promise<ElectronActionResult> {
  await recordAdidasMaterialsEvent('launch-start')

  const result = window.electronAPI?.launchAdidasMaterialCollector
    ? await window.electronAPI.launchAdidasMaterialCollector()
    : await launchAdidasMaterialsCollectorFromWeb()

  await recordAdidasMaterialsEvent(result.success ? 'launch-success' : 'launch-failure', {
    result,
  })

  return result
}

async function launchAdidasMaterialsCollectorFromWeb(): Promise<ElectronActionResult> {
  await ensureLocalAutomationLauncher()

  try {
    return await requestLauncherJson<ElectronActionResult>('POST', launcherStartPath)
  } catch (error) {
    if (isLauncherRouteMissing(error)) {
      throw new Error('本机后台启动器版本过旧，缺少 adidas 网页端启动接口。请重启或更新后台启动器后再试。')
    }
    throw error
  }
}

export async function recordAdidasMaterialsEvent(
  action: string,
  payload?: DiagnosticEvent['payload'],
): Promise<void> {
  try {
    await window.electronAPI?.recordDiagnosticEvent?.({
      module: moduleName,
      action,
      payload,
    })
  } catch {
    // Diagnostics must never block the user action.
  }
}

async function isLauncherReachable(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${launcherBaseUrl}/health`, { method: 'GET' }, 1200)
    if (!response.ok) {
      return false
    }

    const payload = await response.json().catch(() => ({}))
    return Boolean(payload && payload.ok)
  } catch {
    return false
  }
}

async function ensureLocalAutomationLauncher(): Promise<void> {
  if (await isLauncherReachable()) {
    return
  }

  triggerProtocol(launcherBootProtocolUrl)
  const ready = await waitFor(async () => isLauncherReachable(), 12000, 500)
  if (!ready) {
    throw new Error('无法一键启动本机后台启动器。请确认已安装新版 TOS，且浏览器允许打开 tos://automation/launcher/start。')
  }
}

function isLauncherRouteMissing(error: unknown): boolean {
  return error instanceof Error && /HTTP 404|Not found/i.test(error.message)
}

function triggerProtocol(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }
  return false
}

async function requestLauncherJson<T = Record<string, unknown>>(
  method: string,
  pathname: string,
): Promise<T> {
  const response = await fetchWithTimeout(`${launcherBaseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }, 15000)

  const rawText = await response.text()
  const payload = safeParseJson(rawText)

  if (!response.ok) {
    const message = payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload.error === 'string'
        ? payload.error
        : `本机启动器请求失败，HTTP ${response.status}`
    throw new Error(message)
  }

  return (payload || {}) as T
}

function safeParseJson(rawText: string): Record<string, unknown> | null {
  try {
    return rawText ? JSON.parse(rawText) : {}
  } catch {
    return null
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}
