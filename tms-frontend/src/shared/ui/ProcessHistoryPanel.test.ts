import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const componentSourcePath = fileURLToPath(new URL('./ProcessHistoryPanel.vue', import.meta.url))

function readComponentSource(): string {
  return readFileSync(componentSourcePath, 'utf8')
}

function extractCssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`, 'u'))

  return match?.groups?.body ?? ''
}

describe('ProcessHistoryPanel styles', () => {
  it('keeps result downloads out of individual history rows', () => {
    const source = readComponentSource()

    expect(source).not.toContain('downloadHistoryResult(record)')
    expect(source).not.toContain('downloadUrlAsFile')
    expect(source).not.toContain('history-result-action')
  })

  it('keeps history records inside an internal scroll region', () => {
    const source = readComponentSource()
    const historyListRule = extractCssRule(source, '.history-list')

    expect(historyListRule).toContain('max-height: clamp(320px, calc(100vh - 360px), 520px);')
    expect(historyListRule).toContain('overflow-y: auto;')
    expect(historyListRule).toContain('overscroll-behavior: contain;')
    expect(historyListRule).toContain('scrollbar-gutter: stable;')
  })

  it('uses a shorter history scroll area on narrow screens', () => {
    const source = readComponentSource()

    expect(source).toContain('@media (max-width: 768px)')
    expect(source).toContain('max-height: 360px;')
  })
})
