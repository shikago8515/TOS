import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const forbiddenAnyRecord = ['Record<string, ', 'any>'].join('')
const forbiddenLocalJsonParser = ['function safe', 'ParseJson'].join('')

const guardedProductionFiles = [
  './WebAutomationScenarioPage.vue',
  './webAutomationApi.ts',
  './composables/useAutomationStartupProgress.ts',
  '../packing-list-auto-download/components/PackingListAutoDownloadWorkspace.vue',
  '../shipping-automation/components/ShippingAutomationWorkspace.vue',
  '../xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue',
  '../po-auto-download/components/PoAutoDownloadWorkspace.vue',
  '../tc-inv-automation/TcInvAutomationPage.vue',
  '../infornexus-auto-add/InfornexusAutoAddPage.vue',
]

describe('automation executor typing source guard', () => {
  it('keeps executor production files on shared parser and unknown-based payload types', () => {
    const violations = guardedProductionFiles.flatMap((relativePath) => {
      const source = readFileSync(resolve(currentDir, relativePath), 'utf8')
      return [
        source.includes(forbiddenAnyRecord) ? `${relativePath}: ${forbiddenAnyRecord}` : '',
        source.includes(forbiddenLocalJsonParser) ? `${relativePath}: ${forbiddenLocalJsonParser}` : '',
      ].filter(Boolean)
    })

    expect(violations).toEqual([])
  })
})
