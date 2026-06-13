import type {
  ItInvoiceEntry,
  ItInvoiceExtractFile,
  ItInvoiceExtractSearchType,
  ItInvoiceSummary,
} from './itInvoicePdfReorderApi'

export interface ItInvoiceMatchRowsInput {
  poOrderText: string
  invoiceEntries: ItInvoiceEntry[]
  poPages: Map<string, number[]>
}

export interface ItInvoiceMatchRow {
  po: string
  pages: number[]
  articleNo?: string
  quantity?: string | null
  totalAmount?: string | null
  found: boolean
}

export function parsePoList(text: string): string[] {
  const seen = new Set<string>()
  const list: string[] = []

  for (const match of String(text || '').matchAll(/\b\d{10}\b/g)) {
    const po = match[0]
    if (!seen.has(po)) {
      seen.add(po)
      list.push(po)
    }
  }

  return list
}

export function invoicePoText(entries: ItInvoiceEntry[]): string {
  return entries.map((entry) => entry.po).filter(Boolean).join('\n')
}

export function buildExtractionRegex(
  pattern: string,
  type: ItInvoiceExtractSearchType,
): RegExp {
  const cleaned = pattern.trim()

  if (!cleaned) {
    throw new Error('提取规则不能为空')
  }

  if (type === 'startsWith') {
    const prefixes = splitRuleValues(cleaned)
    if (prefixes.length === 0) {
      throw new Error('开头匹配规则不能为空')
    }
    return new RegExp(`\\b(?:${prefixes.map(escapeRegex).join('|')})\\d*\\b`, 'g')
  }

  if (type === 'contains') {
    return new RegExp(`\\b\\d*${escapeRegex(cleaned)}\\d*\\b`, 'g')
  }

  if (type === 'exact') {
    const values = splitRuleValues(cleaned)
    if (values.length === 0) {
      throw new Error('精确匹配规则不能为空')
    }
    return new RegExp(`\\b(?:${values.map(escapeRegex).join('|')})\\b`, 'g')
  }

  if (type === 'regex') {
    return new RegExp(cleaned, 'g')
  }

  throw new Error(`不支持的提取类型：${type}`)
}

export function extractNumbersFromText(text: string, regex: RegExp): string[] {
  const values: string[] = []

  for (const match of String(text || '').matchAll(regex)) {
    const value = String(match[1] || match[0] || '').trim()
    if (value) {
      values.push(value)
    }
  }

  return values
}

export function buildLocalExtractionGroup(
  fileName: string,
  text: string,
  pattern: string,
  searchType: ItInvoiceExtractSearchType,
  existingNumbers: string[],
): { group: ItInvoiceExtractFile; numbers: string[] } {
  const regex = buildExtractionRegex(pattern, searchType)
  const seen = new Set(existingNumbers)
  const numbers: string[] = []

  for (const number of extractNumbersFromText(text, regex)) {
    if (!seen.has(number)) {
      seen.add(number)
      numbers.push(number)
    }
  }

  return {
    group: {
      fileName,
      pages: [{ pageNum: 1, numbers }],
    },
    numbers,
  }
}

export function buildMatchRows({
  poOrderText,
  invoiceEntries,
  poPages,
}: ItInvoiceMatchRowsInput): ItInvoiceMatchRow[] {
  const invoiceMap = new Map(invoiceEntries.map((entry) => [entry.po, entry]))

  return parsePoList(poOrderText).map((po) => {
    const entry = invoiceMap.get(po)
    const pages =
      entry?.poPages && entry.poPages.length > 0
        ? entry.poPages
        : poPages.get(po) ?? []

    return {
      po,
      pages,
      articleNo: entry?.articleNo,
      quantity: entry?.quantity,
      totalAmount: entry?.totalAmount,
      found: pages.length > 0,
    }
  })
}

export function formatValue(value: unknown): string {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

export function buildInvoiceCsv(entries: ItInvoiceEntry[]): string {
  const header = [
    '序号',
    'PO号',
    '发票页',
    'Working No',
    'Article',
    '描述',
    '数量',
    '单价',
    '货品金额',
    '净额',
  ]
  const rows = entries.map((entry) => [
    entry.index,
    entry.po,
    (entry.invoicePages || []).join('|'),
    entry.workingNo || '',
    entry.articleNo || '',
    entry.description || '',
    entry.quantity || '',
    entry.unitPrice || '',
    entry.totalAmount || '',
    entry.netAmount || '',
  ])

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function buildPrintSummaryHtml(
  entries: ItInvoiceEntry[],
  summary: ItInvoiceSummary,
  poPages: Map<string, number[]>,
  includeNotFound: boolean,
): string {
  const bodyRows = entries
    .filter((entry) => includeNotFound || entry.status !== 'missing')
    .map((entry) => {
      const pages =
        entry.poPages && entry.poPages.length > 0
          ? entry.poPages
          : poPages.get(entry.po) ?? []

      return [
        entry.index || '',
        entry.po || '',
        pages.join(', ') || '-',
        entry.articleNo || '-',
        formatValue(entry.quantity),
        formatValue(entry.totalAmount),
        formatValue(entry.netAmount),
        entry.status === 'missing' ? '未找到' : '已匹配',
      ]
    })

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head><meta charset="utf-8"><title>PO 搜索结果摘要</title>',
    '<style>body{font-family:"Microsoft YaHei",Arial,sans-serif;padding:24px;color:#222}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #888;padding:6px;text-align:left}th{background:#f0f2f5}.num{text-align:right}</style>',
    '</head><body>',
    '<h2>PO 搜索结果摘要</h2>',
    `<p>生成时间：${escapeHtml(new Date().toLocaleString())}</p>`,
    `<p>PO数量：${escapeHtml(formatValue(summary.invoicePoCount || entries.length))}；总数量：${escapeHtml(formatValue(summary.totalQuantity))}；PO净额：${escapeHtml(formatValue(summary.totalNetAmount))}</p>`,
    '<table><thead><tr><th>序号</th><th>PO号</th><th>PO页</th><th>Article</th><th>数量</th><th>货品金额</th><th>净额</th><th>状态</th></tr></thead><tbody>',
    bodyRows
      .map(
        (row) =>
          `<tr>${row
            .map((cell, index) => `<td${index >= 4 && index <= 6 ? ' class="num"' : ''}>${escapeHtml(String(cell))}</td>`)
            .join('')}</tr>`,
      )
      .join(''),
    '</tbody></table></body></html>',
  ].join('')
}

function splitRuleValues(value: string): string[] {
  return value.split('|').map((item) => item.trim()).filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char] || char
  })
}
