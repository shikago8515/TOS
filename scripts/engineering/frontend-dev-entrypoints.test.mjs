import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const npmForwarder = 'node scripts/engineering/run-npm.mjs'

test('default frontend dev entrypoint uses hybrid backend mode', async () => {
  const rootPackage = await readJson(resolve(repoRoot, 'package.json'))
  const frontendPackage = await readJson(resolve(repoRoot, 'tms-frontend', 'package.json'))

  assert.equal(rootPackage.scripts['dev:frontend'], `${npmForwarder} --prefix tms-frontend run dev:hybrid`)
  assert.equal(frontendPackage.scripts.dev, frontendPackage.scripts['dev:hybrid'])
  assert.match(frontendPackage.scripts.dev, /^vite\b/)
  assert.match(frontendPackage.scripts.dev, /--mode\s+hybrid\b/)
  assert.doesNotMatch(frontendPackage.scripts.dev, /--mode\s+server\b/)
  assert.doesNotMatch(frontendPackage.scripts.dev, /VITE_BACKEND_URL/)
  assert.doesNotMatch(frontendPackage.scripts['dev:local'], /--mode\s+hybrid\b/)
})

test('server frontend entrypoint is the only script that loads .env.server', async () => {
  const rootPackage = await readJson(resolve(repoRoot, 'package.json'))
  const frontendPackage = await readJson(resolve(repoRoot, 'tms-frontend', 'package.json'))
  const envServer = await readFile(resolve(repoRoot, 'tms-frontend', '.env.server'), 'utf8')

  assert.equal(rootPackage.scripts['dev:frontend:server'], `${npmForwarder} --prefix tms-frontend run dev:server`)
  assert.equal(rootPackage.scripts['dev:frontend:local'], `${npmForwarder} --prefix tms-frontend run dev:local`)
  assert.match(envServer, /^VITE_BACKEND_URL=/m)
  assert.match(frontendPackage.scripts['dev:server'], /--mode\s+server\b/)

  for (const [name, script] of Object.entries(frontendPackage.scripts)) {
    if (name === 'dev:server') {
      continue
    }

    assert.doesNotMatch(script, /--mode\s+server\b/, `${name} must not load .env.server`)
  }
})

test('local dev entrypoints use the npm CLI wrapper instead of nested npm shims', async () => {
  const rootPackage = await readJson(resolve(repoRoot, 'package.json'))
  const runNpm = await readFile(resolve(repoRoot, 'scripts', 'engineering', 'run-npm.mjs'), 'utf8')

  const forwardedScripts = [
    'dev:frontend',
    'dev:frontend:server',
    'dev:frontend:local',
    'preview:frontend',
    'dev:electron',
  ]

  for (const name of forwardedScripts) {
    assert.match(rootPackage.scripts[name], new RegExp(`^${escapeRegExp(npmForwarder)}\\b`))
    assert.doesNotMatch(rootPackage.scripts[name], /\bnpm\s+--prefix\b/)
  }

  assert.match(runNpm, /process\.env\.npm_execpath/)
  assert.match(runNpm, /process\.execPath/)
  assert.match(runNpm, /npm-cli\.js/)
  assert.doesNotMatch(runNpm, /npm\.cmd/)
  assert.doesNotMatch(runNpm, /shell:\s*true/)
})

test('engineering docs keep hybrid frontend dev and release update sync rules current', async () => {
  const readme = await readFile(resolve(repoRoot, 'README.md'), 'utf8')
  const frontendReadme = await readFile(resolve(repoRoot, 'tms-frontend', 'README.md'), 'utf8')
  const electronReadme = await readFile(resolve(repoRoot, 'tms-electron-app', 'README.md'), 'utf8')
  const workflow = await readFile(resolve(repoRoot, 'docs', 'tos-ai-workflow.md'), 'utf8')

  assert.doesNotMatch(readme, /默认\s+`?dev:frontend`?.*server mode/)
  assert.match(readme, /默认 `dev:frontend` .*hybrid 模式/)
  assert.match(readme, /`dev:frontend:local` .*本地/)
  assert.doesNotMatch(frontendReadme, /`npm run dev` 和 `npm run dev:server` 使用 server mode/)
  assert.match(frontendReadme, /`npm run dev`.*Hybrid 模式/)
  assert.match(frontendReadme, /`npm run dev:local` .*纯本地后端模式/)
  assert.doesNotMatch(electronReadme, /默认由 `..\/tms-frontend` 的 server mode 提供/)
  assert.match(electronReadme, /默认由 `..\/tms-frontend` 的 Hybrid dev 模式提供/)
  assert.match(electronReadme, /前端开发态加载：`http:\/\/127\.0\.0\.1:5174`/)
  assert.match(workflow, /tos_release_records/)
  assert.match(workflow, /release:updates:pull/)
  assert.match(workflow, /release:updates:push:dry-run/)
  assert.match(workflow, /Gitea `main` push/)
  assert.doesNotMatch(workflow, /GitCode `main` push/)
})

test('engineering docs keep removed frontend routes out of current validation targets', async () => {
  const frontendReadme = await readFile(resolve(repoRoot, 'tms-frontend', 'README.md'), 'utf8')
  const packagingDoc = await readFile(resolve(repoRoot, 'docs', 'frontend-packaging-switch-test.md'), 'utf8')
  const rebuildRoadmap = await readFile(resolve(repoRoot, 'docs', 'frontend-rebuild-roadmap.md'), 'utf8')

  assert.match(frontendReadme, /\/eric-infornexus/)
  assert.match(frontendReadme, /\/web-automation\/scenarios\/shipping-automation/)
  assert.match(frontendReadme, /\/web-automation\/scenarios\/xinlongtai-shipping-automation/)
  assert.doesNotMatch(frontendReadme, /^- `\/browser-plugins`$/m)
  assert.doesNotMatch(frontendReadme, /^- `\/module-a`$/m)
  assert.doesNotMatch(frontendReadme, /^- `\/module-b`$/m)

  assert.match(packagingDoc, /\/eric-infornexus/)
  assert.match(packagingDoc, /\/jane-infornexus/)
  assert.doesNotMatch(packagingDoc, /^- `\/browser-plugins`$/m)
  assert.doesNotMatch(packagingDoc, /^- `\/module-a`$/m)
  assert.doesNotMatch(packagingDoc, /^- `\/module-b`$/m)

  assert.match(rebuildRoadmap, /当前源码路由/)
  assert.match(rebuildRoadmap, /\/eric-infornexus/)
  assert.match(rebuildRoadmap, /\/jane-infornexus/)
})

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
