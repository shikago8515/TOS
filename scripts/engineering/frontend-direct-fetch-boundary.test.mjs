import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const frontendSrc = resolve(repoRoot, 'tms-frontend', 'src')

const allowedDirectRequestFiles = new Set([
  'tms-frontend/src/shared/api/backendClient.ts',
  'tms-frontend/src/pages/settings/settingsApi.ts',
  'tms-frontend/src/pages/adidas-materials/adidasMaterialsApi.ts',
  'tms-frontend/src/pages/release-updates/releaseUpdatesApi.ts',
  'tms-frontend/src/pages/web-automation/webAutomationApi.ts',
  'tms-frontend/src/pages/web-automation/WebAutomationScenarioPage.vue',
  'tms-frontend/src/pages/infornexus-auto-add/components/InfornexusAutoAddWorkspace.vue',
  'tms-frontend/src/pages/po-auto-download/components/PoAutoDownloadWorkspace.vue',
  'tms-frontend/src/pages/shipping-automation/components/ShippingAutomationWorkspace.vue',
  'tms-frontend/src/pages/shipping-automation-2/components/ShippingAutomation2Workspace.vue',
  'tms-frontend/src/pages/xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue',
])

test('frontend direct HTTP requests stay inside approved API boundaries', async () => {
  const sourceFiles = await collectSourceFiles(frontendSrc)
  const directRequestFiles = []

  for (const file of sourceFiles) {
    const content = await readFile(file, 'utf8')
    if (/\bfetch\s*\(|\bXMLHttpRequest\b/.test(content)) {
      directRequestFiles.push(toRepoPath(file))
    }
  }

  assert.deepEqual(
    directRequestFiles.sort(),
    [...allowedDirectRequestFiles].sort(),
    [
      'Direct fetch/XMLHttpRequest calls must stay in backendClient or documented local executor boundaries.',
      'Normal backend API calls must use the shared backend client so version checks and error normalization still apply.',
    ].join(' '),
  )
})

test('XMLHttpRequest is only used by the shared backend upload client', async () => {
  const sourceFiles = await collectSourceFiles(frontendSrc)
  const xmlHttpRequestFiles = []

  for (const file of sourceFiles) {
    const content = await readFile(file, 'utf8')
    if (/\bXMLHttpRequest\b/.test(content)) {
      xmlHttpRequestFiles.push(toRepoPath(file))
    }
  }

  assert.deepEqual(xmlHttpRequestFiles, ['tms-frontend/src/shared/api/backendClient.ts'])
})

async function collectSourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path))
      continue
    }

    if (entry.isFile() && isFrontendSourceFile(path) && !isTestFile(path)) {
      files.push(path)
    }
  }

  return files
}

function isFrontendSourceFile(path) {
  return ['.ts', '.tsx', '.vue'].includes(extname(path))
}

function isTestFile(path) {
  return /\.(test|spec)\.[^.]+$/.test(path)
}

function toRepoPath(path) {
  return relative(repoRoot, path).split(sep).join('/')
}
