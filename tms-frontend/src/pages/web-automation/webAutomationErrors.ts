import { showAppAlert } from '../../shared/ui/appAlert'

interface AutomationValidationErrorRule {
  pattern: RegExp
  message: string
}

interface AutomationFailureItem {
  ok?: unknown
  invoiceNumber?: unknown
  poNo?: unknown
  rowIndex?: unknown
  error?: unknown
  step?: unknown
}

interface AutomationFailurePayload {
  loginSuccess?: unknown
  invoiceResults?: unknown
  poResults?: unknown
}

const MAX_AUTOMATION_FAILURE_EXAMPLES = 3

const automationValidationErrorRules: AutomationValidationErrorRule[] = [
  {
    pattern: /Automation app proxy failed.*(ECONNRESET|socket hang up|ECONNABORTED)|read ECONNRESET|connection reset|socket hang up/i,
    message: '执行器连接已中断：页面请求已经发送到本机自动化执行器，但连接在等待结果时被断开。常见原因是你点击了停止、执行器正在重启或热更新、自动化浏览器被关闭，或执行器进程异常退出。请先等待右侧状态刷新；如果任务未完成，可重新启动执行器，并在断点续跑里点击“继续未完成”。',
  },
  {
    pattern: /requires TOS automation helper|Please update TOS automation helper/i,
    message: '本机自动化小助手版本过低：当前小助手不是该自动化模块要求的版本。请到系统设置下载并安装最新小助手，然后重新启动执行器。',
  },
  {
    pattern: /Infor Nexus 登录需要 Access Code|Access Code.*e-Identity|without providing an Access Code/i,
    message: 'Infor Nexus 登录需要 Access Code：账号进入 e-Identity 验证流程。请检查 User ID / Password 是否正确，或联系管理员确认账号权限。',
  },
  {
    pattern: /Infor Nexus request login did not return a redirect|Infor Nexus 登录失败：登录请求返回登录页|<!DOCTYPE html[\s\S]*Infor Nexus Login|<html[\s\S]*Infor Nexus Login/i,
    message: 'Infor Nexus 登录失败：登录请求返回登录页，未建立下载会话。请检查 User ID / Password，或确认账号是否需要 Access Code。',
  },
  {
    pattern: /Infor Nexus request login did not return required userToken\/JSESSIONID cookies|缺少 userToken\/JSESSIONID cookies/i,
    message: 'Infor Nexus 登录未建立下载会话：缺少 userToken/JSESSIONID cookies。请重新登录，或联系管理员确认账号状态。',
  },
  {
    pattern: /Infor Nexus 登录失败|账号或密码错误|invalid.*(user|password|credential)|incorrect.*(user|password|credential)|authentication failed|login failed/i,
    message: 'Infor Nexus 登录失败：账号或密码错误，请检查 User ID 和 Password。',
  },
  {
    pattern: /Desktop Utility|PackByScan|taking longer than normal for the desktop to connect|Awaiting desktop|桌面工具连接超时|re-loading the PackByScan application/i,
    message: 'Infor Nexus 桌面工具连接超时：页面已进入 Pack-Scan-Ship，但没有连上 Desktop Utility，当前自动化无法加载所需设备/包裹数据。请确认 Desktop Utility 正在运行且版本不低于 2.0.1.29；可点击左下角 Reconnect to Desktop，或重新加载 PackByScan 后再执行。',
  },
  {
    pattern: /JSON\.parse|unexpected character.*JSON data|Unexpected token.*JSON|Unexpected token '<'|Unexpected end of JSON input|无法解析响应/i,
    message: '自动化执行器返回了无法识别的响应：通常是本机执行器中途退出、接口返回了 HTML/空内容，或浏览器会话被关闭。请重启本机自动化执行器后重新执行；如仍失败，请查看原始响应或执行器日志。',
  },
  {
    pattern: /Failed to fetch|NetworkError|fetch failed|ECONNREFUSED|ERR_CONNECTION_REFUSED|HTTP (502|503|504)/i,
    message: '本机自动化执行器连接失败：前端没有连上执行器服务，可能是执行器未启动、刚刚退出，或端口被占用。请先在页面点击启动执行器，确认状态为已就绪后再执行。',
  },
  {
    pattern: /Target page.*closed|Target closed|browser.*closed|page.*closed|browser session became unavailable|browser page became unavailable|Execution context was destroyed|浏览器会话已中断/i,
    message: '自动化浏览器会话已中断：浏览器窗口被关闭、页面崩溃，或本机执行器退出。请保持自动化浏览器窗口打开，重启本机执行器后再执行。',
  },
  {
    pattern: /timed out waiting for shipment rows|no shipment rows were loaded|shipment grid stayed empty|did not switch to rows for this PO/i,
    message: 'Shipment Scan 没有返回可处理的数据：可能是 PO 不在当前账号权限范围内、筛选条件不匹配，或 Infor Nexus 桌面工具未连接。请先确认页面是否有 Desktop Utility 连接提示，再核对 Excel 中 PO No / Equipment ID 是否正确。',
  },
  {
    pattern: /PageResolver URL was not found in InProgressInvoices response/i,
    message: 'Infor Nexus 系统没有找到这个 Invoice 的可打开结果。请确认 Excel 中的 INVOICE NUMBER 是否正确、该发票是否已在 Infor Nexus 创建，或当前账号是否有权限查看。',
  },
  {
    pattern: /PDF dyncon URL was not found in PageResolver response/i,
    message: '已找到 Invoice 页面，但系统没有返回可下载的 Invoice PDF。可能是该发票还没有生成 PDF、未发布，或当前账号没有 PDF 下载权限；请在 Infor Nexus 手工打开该发票确认是否能下载。',
  },
  {
    pattern: /Uploaded workbook does not contain any data rows/i,
    message: '上传的 Excel 只有表头，没有可执行数据。请从第 2 行开始填写至少一条数据后再执行。',
  },
  {
    pattern: /Uploaded workbook does not contain any worksheet/i,
    message: '上传的 Excel 没有工作表。请下载模板并确认文件内至少保留一个工作表。',
  },
  {
    pattern: /Decoded workbook content is empty|fileBase64 must be a non-empty base64 string/i,
    message: '上传的 Excel 文件内容为空。请重新选择填写后的模板文件。',
  },
  {
    pattern: /Uploaded file must be an \.xlsx or \.xls workbook/i,
    message: '上传文件格式不正确。请上传 .xlsx 或 .xls 格式的 Excel 文件。',
  },
  {
    pattern: /Failed to parse uploaded workbook/i,
    message: '无法读取上传的 Excel。请确认文件没有损坏，并使用下载的模板重新保存后再上传。',
  },
  {
    pattern: /Uploaded workbook must contain at least one non-empty PO No value/i,
    message: '上传 Excel 缺少可执行 PO。万代模板请填写 PO No1 / PO No；新龙泰模板请填写 PO NUMBER，且至少有一行不能为空。',
  },
  {
    pattern: /Uploaded workbook must contain at least one Released Bulk PO number/i,
    message: 'Released Bulk 模板缺少 PO No 数据。请确认第 1 行包含 PO No，并从第 2 行开始填写至少一个 PO。',
  },
  {
    pattern: /Unreleased Bulk workbook must contain at least one non-empty PO No value/i,
    message: 'Unreleased Bulk 模板缺少 PO No 数据。请确认第 1 行包含 PO No，并从第 2 行开始填写至少一个 PO。',
  },
  {
    pattern: /Uploaded workbook must contain at least one 10-character ID/i,
    message: 'Infornexus 自动搜索并添加模板缺少 10 位 ID。请确认第二列为 ID，并从第 2 行开始填写至少一个 10 位 ID。',
  },
  {
    pattern: /Uploaded workbook must contain at least one INVOICE NUMBER row/i,
    message: 'Invoice 自动下载模板缺少 INVOICE NUMBER 数据。请确认表头包含 INVOICE NUMBER 和 STATUS，并从第 2 行开始填写；STATUS 为 active 或 new 才会下载。',
  },
]

export function formatAutomationExecutorMessage(message: string | undefined, fallback = '执行失败。'): string {
  const rawMessage = String(message || '').trim()

  if (/桌面工具连接超时/.test(rawMessage)) {
    return rawMessage
  }

  const helperVersionMatch = rawMessage.match(/Automation module\s+([^\s]+)\s+requires TOS automation helper\s+(.+?)\s+or later\.\s+Current helper:\s+(.+?)\.\s+Please update/i)
  if (helperVersionMatch) {
    return `本机自动化小助手版本过低：${helperVersionMatch[1]} 需要 ${helperVersionMatch[2]} 或更新版本，当前小助手是 ${helperVersionMatch[3]}。请到系统设置下载并安装最新小助手，然后重新启动执行器。`
  }

  const validationRule = findAutomationValidationErrorRule(rawMessage)
  if (validationRule) {
    return validationRule.message
  }

  return rawMessage || fallback
}

export function appendAutomationFailureExamples(baseMessage: string, payload: AutomationFailurePayload | null | undefined): string {
  const normalizedBaseMessage = String(baseMessage || '').trim()
  if (!normalizedBaseMessage || isLoginStageFailureMessage(normalizedBaseMessage)) {
    return normalizedBaseMessage
  }

  const results = Array.isArray(payload?.invoiceResults)
    ? payload.invoiceResults
    : Array.isArray(payload?.poResults)
      ? payload.poResults
      : []
  const failureItems = results
    .filter((item): item is AutomationFailureItem => Boolean(item && typeof item === 'object' && !((item as AutomationFailureItem).ok)))
  const seenErrors = new Set<string>()
  const failures = failureItems
    .map((item) => {
      const rawError = String(item.error || item.step || '未返回错误详情').trim()
      const error = formatAutomationExecutorMessage(rawError, rawError || '未返回错误详情')
      const normalizedError = error.toLowerCase()
      if (seenErrors.has(normalizedError)) return ''
      seenErrors.add(normalizedError)
      const invoiceNumber = String(item.invoiceNumber || item.poNo || `第 ${item.rowIndex || '?'} 行`).trim()
      return `${invoiceNumber}: ${error}`
    })
    .filter(Boolean)
  const examples = failures.slice(0, MAX_AUTOMATION_FAILURE_EXAMPLES)
  const omittedCount = Math.max(0, failureItems.length - examples.length)

  if (examples.length === 0) return normalizedBaseMessage
  const omittedMessage = omittedCount > 0 ? `；另有 ${omittedCount} 条失败，请在右侧失败明细或失败明细 Excel 中查看。` : ''
  return `${normalizedBaseMessage} 失败示例：${examples.join('；')}${omittedMessage}`
}

export function shouldShowAutomationErrorDialog(message: string | undefined): boolean {
  const rawMessage = String(message || '').trim()
  return Boolean(findAutomationValidationErrorRule(rawMessage))
}

export function showAutomationErrorDialog(message: string): void {
  if (isAutomationConnectionInterruptedMessage(message)) {
    void showAppAlert(message, { tone: 'warning', title: '执行器连接已中断' })
    return
  }
  void showAppAlert(message, { tone: 'error' })
}

function findAutomationValidationErrorRule(message: string): AutomationValidationErrorRule | undefined {
  if (!message) {
    return undefined
  }

  return automationValidationErrorRules.find((rule) => rule.pattern.test(message))
}

function isLoginStageFailureMessage(message: string): boolean {
  return /Infor Nexus (登录失败|登录未建立下载会话|登录需要 Access Code)|request login/i.test(message)
}

function isAutomationConnectionInterruptedMessage(message: string): boolean {
  return /执行器连接已中断|Automation app proxy failed.*(ECONNRESET|socket hang up|ECONNABORTED)|read ECONNRESET|connection reset|socket hang up/i.test(String(message || ''))
}
