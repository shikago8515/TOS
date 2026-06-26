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

const automationValidationErrorRules: AutomationValidationErrorRule[] = [
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
    message: 'Infor Nexus 桌面工具连接超时：页面已进入 Pack-Scan-Ship，但没有连上 Desktop Utility，Shipment Scan 无法加载设备或包裹数据。请确认 Desktop Utility 正在运行且版本不低于 2.0.1.29；可点击左下角 Reconnect to Desktop，或重新加载 PackByScan 后再执行。',
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
    message: 'Invoice 自动下载模板缺少 INVOICE NUMBER 数据。请确认表头包含 INVOICE NUMBER 和 STATUS，并从第 2 行开始填写；STATUS 为 active 才会下载。',
  },
]

export function formatAutomationExecutorMessage(message: string | undefined, fallback = '执行失败。'): string {
  const rawMessage = String(message || '').trim()

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
  const seenErrors = new Set<string>()
  const failures = results
    .filter((item): item is AutomationFailureItem => Boolean(item && typeof item === 'object' && !((item as AutomationFailureItem).ok)))
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
    .slice(0, 3)

  if (failures.length === 0) return normalizedBaseMessage
  return `${normalizedBaseMessage} 失败示例：${failures.join('；')}`
}

export function shouldShowAutomationErrorDialog(message: string | undefined): boolean {
  const rawMessage = String(message || '').trim()
  return Boolean(findAutomationValidationErrorRule(rawMessage))
}

export function showAutomationErrorDialog(message: string): void {
  window.alert(message)
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
