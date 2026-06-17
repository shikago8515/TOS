const poHeaderErrorPattern = /Uploaded workbook must contain at least one non-empty PO No value/i
const idHeaderErrorPattern = /Uploaded workbook must contain at least one 10-character ID/i
const invoiceHeaderErrorPattern = /Uploaded workbook must contain at least one INVOICE NUMBER row/i

export function formatAutomationExecutorMessage(message: string | undefined, fallback = '执行失败。'): string {
  const rawMessage = String(message || '').trim()

  if (poHeaderErrorPattern.test(rawMessage)) {
    return '上传 Excel 表头有误，请下载模板并确认 PO No / PO NUMBER 列。'
  }

  if (idHeaderErrorPattern.test(rawMessage)) {
    return '上传 Excel 表头有误，请下载模板并确认第二列为 10 位 ID。'
  }

  if (invoiceHeaderErrorPattern.test(rawMessage)) {
    return '上传 Excel 表头有误，请下载模板并确认 INVOICE NUMBER 和 STATUS 列。'
  }

  return rawMessage || fallback
}

export function shouldShowAutomationErrorDialog(message: string | undefined): boolean {
  const rawMessage = String(message || '').trim()
  return poHeaderErrorPattern.test(rawMessage)
    || idHeaderErrorPattern.test(rawMessage)
    || invoiceHeaderErrorPattern.test(rawMessage)
}

export function showAutomationErrorDialog(message: string): void {
  window.alert(message)
}
