import { describe, expect, it } from 'vitest'

import {
  appendAutomationFailureExamples,
  formatAutomationExecutorMessage,
  shouldShowAutomationErrorDialog,
} from './webAutomationErrors'

describe('webAutomationErrors', () => {
  it.each([
    [
      'Uploaded workbook does not contain any data rows.',
      '上传的 Excel 只有表头，没有可执行数据。请从第 2 行开始填写至少一条数据后再执行。',
    ],
    [
      'Uploaded workbook must contain at least one non-empty PO No value.',
      '上传 Excel 缺少可执行 PO。万代模板请填写 PO No1 / PO No；新龙泰模板请填写 PO NUMBER，且至少有一行不能为空。',
    ],
    [
      'Uploaded workbook must contain at least one Released Bulk PO number.',
      'Released Bulk 模板缺少 PO No 数据。请确认第 1 行包含 PO No，并从第 2 行开始填写至少一个 PO。',
    ],
    [
      'Unreleased Bulk workbook must contain at least one non-empty PO No value.',
      'Unreleased Bulk 模板缺少 PO No 数据。请确认第 1 行包含 PO No，并从第 2 行开始填写至少一个 PO。',
    ],
    [
      'Uploaded workbook must contain at least one 10-character ID in the second column.',
      'Infornexus 自动搜索并添加模板缺少 10 位 ID。请确认第二列为 ID，并从第 2 行开始填写至少一个 10 位 ID。',
    ],
    [
      'Uploaded workbook must contain at least one INVOICE NUMBER row.',
      'Invoice 自动下载模板缺少 INVOICE NUMBER 数据。请确认表头包含 INVOICE NUMBER 和 STATUS，并从第 2 行开始填写；STATUS 为 active 或 new 才会下载。',
    ],
    [
      'Uploaded file must be an .xlsx or .xls workbook.',
      '上传文件格式不正确。请上传 .xlsx 或 .xls 格式的 Excel 文件。',
    ],
    [
      'Failed to parse uploaded workbook: invalid zip file',
      '无法读取上传的 Excel。请确认文件没有损坏，并使用下载的模板重新保存后再上传。',
    ],
  ])('formats executor workbook validation error: %s', (rawMessage, expected) => {
    expect(formatAutomationExecutorMessage(rawMessage)).toBe(expected)
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats Infor Nexus login failures as dialog-worthy messages', () => {
    const accessCodeMessage = 'Infor Nexus 登录需要 Access Code：账号进入 e-Identity 验证流程。'
    const passwordMessage = 'Infor Nexus 登录失败：账号或密码错误，请检查 User ID 和 Password。'

    expect(formatAutomationExecutorMessage(accessCodeMessage)).toContain('Access Code')
    expect(shouldShowAutomationErrorDialog(accessCodeMessage)).toBe(true)
    expect(formatAutomationExecutorMessage(passwordMessage)).toBe(passwordMessage)
    expect(shouldShowAutomationErrorDialog(passwordMessage)).toBe(true)
  })

  it('formats request login HTML failures as dialog-worthy messages', () => {
    const rawMessage = 'Infor Nexus request login did not return a redirect. HTTP 200. <!DOCTYPE html><html><title>Infor Nexus Login</title></html>'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toBe('Infor Nexus 登录失败：登录请求返回登录页，未建立下载会话。请检查 User ID / Password，或确认账号是否需要 Access Code。')
    expect(formattedMessage).not.toContain('<!DOCTYPE')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats missing request-login cookies as dialog-worthy messages', () => {
    const rawMessage = 'Infor Nexus request login did not return required userToken/JSESSIONID cookies.'

    expect(formatAutomationExecutorMessage(rawMessage)).toBe('Infor Nexus 登录未建立下载会话：缺少 userToken/JSESSIONID cookies。请重新登录，或联系管理员确认账号状态。')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats Infor Nexus Desktop Utility connection failures', () => {
    const rawMessage = 'It is taking longer than normal for the desktop to connect. Please make sure the Desktop Utility process is running.'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('Infor Nexus 桌面工具连接超时')
    expect(formattedMessage).toContain('Desktop Utility')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('keeps executor-provided Desktop Utility stage details', () => {
    const rawMessage = 'Create Shipment 222: Infor Nexus 桌面工具连接超时：页面已进入 Create Shipment，但没有连上 Desktop Utility，Create Shipment 无法加载所需设备/包裹数据。'

    expect(formatAutomationExecutorMessage(rawMessage)).toBe(rawMessage)
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats non-JSON executor responses without exposing JSON.parse', () => {
    const rawMessage = 'JSON.parse: unexpected character at line 1 column 1 of the JSON data'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('自动化执行器返回了无法识别的响应')
    expect(formattedMessage).not.toContain('JSON.parse')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats automation proxy connection resets with actionable guidance', () => {
    const rawMessage = 'Automation app proxy failed: read ECONNRESET'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('执行器连接已中断')
    expect(formattedMessage).toContain('断点续跑')
    expect(formattedMessage).not.toContain('Automation app proxy failed')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats outdated automation helper requirements with version details', () => {
    const rawMessage = 'Automation module shipping-automation-demo requires TOS automation helper 0.9.8-beta.3.31 or later. Current helper: 0.9.8-beta.3.28. Please update TOS automation helper first.'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('本机自动化小助手版本过低')
    expect(formattedMessage).toContain('0.9.8-beta.3.31')
    expect(formattedMessage).toContain('0.9.8-beta.3.28')
    expect(formattedMessage).not.toContain('Please update')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats closed browser session errors', () => {
    const rawMessage = 'Target page, context or browser has been closed'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('自动化浏览器会话已中断')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats missing invoice search results as user-facing guidance', () => {
    const rawMessage = 'Invoice 17-06-26-1548: PageResolver URL was not found in InProgressInvoices response.'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('Infor Nexus 系统没有找到这个 Invoice')
    expect(formattedMessage).toContain('INVOICE NUMBER')
    expect(formattedMessage).not.toContain('PageResolver')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('formats missing invoice PDF links as user-facing guidance', () => {
    const rawMessage = 'Invoice 17-06-26-1548: PDF dyncon URL was not found in PageResolver response.'

    const formattedMessage = formatAutomationExecutorMessage(rawMessage)
    expect(formattedMessage).toContain('系统没有返回可下载的 Invoice PDF')
    expect(formattedMessage).toContain('手工打开该发票')
    expect(formattedMessage).not.toContain('dyncon')
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(true)
  })

  it('does not repeat per-row examples for login-stage failures', () => {
    const baseMessage = 'Infor Nexus 登录失败：登录请求返回登录页，未建立下载会话。请检查 User ID / Password，或确认账号是否需要 Access Code。'
    const payload = {
      loginSuccess: false,
      invoiceResults: [
        { ok: false, invoiceNumber: '10-06-26-0754', error: baseMessage },
        { ok: false, invoiceNumber: '10-06-26-0753', error: baseMessage },
        { ok: false, invoiceNumber: '10-06-26-0752', error: baseMessage },
      ],
    }

    expect(appendAutomationFailureExamples(baseMessage, payload)).toBe(baseMessage)
  })

  it('deduplicates repeated non-login failure examples', () => {
    const payload = {
      invoiceResults: [
        { ok: false, invoiceNumber: 'INV-1', error: 'PDF dyncon URL was not found.' },
        { ok: false, invoiceNumber: 'INV-2', error: 'PDF dyncon URL was not found.' },
        { ok: false, invoiceNumber: 'INV-3', error: 'PageResolver URL was not found.' },
      ],
    }

    expect(appendAutomationFailureExamples('未完成', payload)).toBe(
      '未完成 失败示例：INV-1: PDF dyncon URL was not found.；INV-3: PageResolver URL was not found.',
    )
  })

  it('shows friendly invoice download failure examples', () => {
    const payload = {
      invoiceResults: [
        { ok: false, invoiceNumber: '17-06-26-1548', error: 'Invoice 17-06-26-1548: PageResolver URL was not found in InProgressInvoices response.' },
        { ok: false, invoiceNumber: '17-06-26-1547', error: 'Invoice 17-06-26-1547: PageResolver URL was not found in InProgressInvoices response.' },
      ],
    }

    expect(appendAutomationFailureExamples('Invoice PDF 下载未完成。', payload)).toBe(
      'Invoice PDF 下载未完成。 失败示例：17-06-26-1548: Infor Nexus 系统没有找到这个 Invoice 的可打开结果。请确认 Excel 中的 INVOICE NUMBER 是否正确、该发票是否已在 Infor Nexus 创建，或当前账号是否有权限查看。',
    )
  })
})
