import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

test('default frontend dev entrypoint uses local backend mode', async () => {
  const rootPackage = await readJson(resolve(repoRoot, 'package.json'))
  const frontendPackage = await readJson(resolve(repoRoot, 'tms-frontend', 'package.json'))

  assert.equal(rootPackage.scripts['dev:frontend'], 'npm --prefix tms-frontend run dev')
  assert.equal(frontendPackage.scripts.dev, frontendPackage.scripts['dev:local'])
  assert.match(frontendPackage.scripts.dev, /^vite\b/)
  assert.doesNotMatch(frontendPackage.scripts.dev, /--mode\s+server\b/)
  assert.doesNotMatch(frontendPackage.scripts.dev, /VITE_BACKEND_URL/)
})

test('server frontend entrypoint is the only script that loads .env.server', async () => {
  const rootPackage = await readJson(resolve(repoRoot, 'package.json'))
  const frontendPackage = await readJson(resolve(repoRoot, 'tms-frontend', 'package.json'))
  const envServer = await readFile(resolve(repoRoot, 'tms-frontend', '.env.server'), 'utf8')

  assert.equal(rootPackage.scripts['dev:frontend:server'], 'npm --prefix tms-frontend run dev:server')
  assert.equal(rootPackage.scripts['dev:frontend:local'], 'npm --prefix tms-frontend run dev:local')
  assert.match(envServer, /^VITE_BACKEND_URL=/m)
  assert.match(frontendPackage.scripts['dev:server'], /--mode\s+server\b/)

  for (const [name, script] of Object.entries(frontendPackage.scripts)) {
    if (name === 'dev:server') {
      continue
    }

    assert.doesNotMatch(script, /--mode\s+server\b/, `${name} must not load .env.server`)
  }
})

test('engineering docs keep local frontend dev and release update sync rules current', async () => {
  const readme = await readFile(resolve(repoRoot, 'README.md'), 'utf8')
  const workflow = await readFile(resolve(repoRoot, 'docs', 'tos-ai-workflow.md'), 'utf8')

  assert.doesNotMatch(readme, /默认\s+`?dev:frontend`?.*server mode/)
  assert.match(readme, /默认 `dev:frontend` .*本地后端/)
  assert.match(workflow, /release_update_records/)
  assert.match(workflow, /release:updates:pull/)
  assert.match(workflow, /release:updates:push:dry-run/)
})

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
