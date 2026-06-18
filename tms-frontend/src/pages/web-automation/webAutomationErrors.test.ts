import { describe, expect, it } from 'vitest'

import {
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
      'Invoice 自动下载模板缺少 INVOICE NUMBER 数据。请确认表头包含 INVOICE NUMBER 和 STATUS，并从第 2 行开始填写；STATUS 为 active 才会下载。',
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

  it('keeps non-workbook errors as inline status only', () => {
    const rawMessage = 'Infor Nexus request login did not return a redirect.'

    expect(formatAutomationExecutorMessage(rawMessage)).toBe(rawMessage)
    expect(shouldShowAutomationErrorDialog(rawMessage)).toBe(false)
  })
})
