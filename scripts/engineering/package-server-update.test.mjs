import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'

import {
  buildArchiveName,
  createServerPackage,
  validateReleaseMetadata,
} from './package-server-update.mjs'

const execFileAsync = promisify(execFile)

const gitInfo = {
  remote: 'https://gitcode.com/shikago8515/TOS.git',
  branch: 'codex/tos-ai-workflow',
  commit: '4e1c3e5b8f0d6123456789012345678901234567',
  shortSha: '4e1c3e5',
  dirty: false,
}

test('builds deterministic server archive names', () => {
  assert.equal(
    buildArchiveName({
      version: '0.9.8-beta.3.3',
      stamp: '20260612110405',
      gitShortSha: '4e1c3e5',
    }),
    'tos-server-update-v0.9.8-beta.3.3-20260612110405-4e1c3e5.tar.gz',
  )
})

test('rejects release notes that are not synced to the app version', async () => {
  const root = await createFixture({
    appVersion: '0.9.8-beta.3.3',
    releaseVersion: '0.9.8-beta.3.2',
  })

  await assert.rejects(
    () => validateReleaseMetadata(root),
    /releaseNotes\.json version mismatch/,
  )
})

test('dry-run reports package plan without requiring a clean worktree', async () => {
  const root = await createFixture()
  const plan = await createServerPackage({
    repoRoot: root,
    dryRun: true,
    gitInfo: { ...gitInfo, dirty: true },
    now: new Date('2026-06-12T03:04:05.000Z'),
  })

  assert.equal(plan.version, '0.9.8-beta.3.3')
  assert.equal(plan.gitDirty, true)
  assert.equal(plan.archivePath, null)
  assert.equal(plan.archiveName, 'tos-server-update-v0.9.8-beta.3.3-20260612110405-4e1c3e5.tar.gz')
})

test('creates a server update archive with manifest and only deployable paths', async () => {
  const root = await createFixture()
  const outputRoot = join(root, 'release', 'server')

  const result = await createServerPackage({
    repoRoot: root,
    outputRoot,
    gitInfo,
    skipBuild: true,
    now: new Date('2026-06-12T03:04:05.000Z'),
  })

  assert.equal(result.archiveName, 'tos-server-update-v0.9.8-beta.3.3-20260612110405-4e1c3e5.tar.gz')

  const { stdout } = await execFileAsync('tar', ['-tzf', result.archivePath])
  const entries = stdout.split(/\r?\n/).filter(Boolean)

  assert(entries.includes('deploy/manifest.json'))
  assert(entries.includes('deploy/apply-server-update.sh'))
  assert(entries.includes('app-version.json'))
  assert(entries.includes('tms-backend/app_version.py'))
  assert(entries.includes('tms-frontend/dist/index.html'))
  assert(!entries.some((entry) => entry.includes('node_modules/')))
  assert(!entries.some((entry) => entry.includes('Dockerfile')))
  assert(!entries.some((entry) => entry.includes('nginx.conf')))
  assert(!entries.some((entry) => entry.includes('docker-compose.tos.yml')))
  assert(!entries.some((entry) => entry.includes('authelia/')))

  const manifest = JSON.parse(
    await readFile(join(result.stagingRoot, 'deploy', 'manifest.json'), 'utf8'),
  )
  assert.equal(manifest.kind, 'tos-server-update')
  assert.equal(manifest.version, '0.9.8-beta.3.3')
  assert.equal(manifest.gitCommit, gitInfo.commit)
  assert.equal(manifest.gitDirty, false)
  assert.equal(manifest.backendUrl, '/tos')
  assert(manifest.includedPaths.includes('tms-frontend/dist'))
  assert.equal(Object.hasOwn(manifest, 'archivePath'), false)
})

test('refuses to create a formal archive from a dirty worktree', async () => {
  const root = await createFixture()

  await assert.rejects(
    () => createServerPackage({
      repoRoot: root,
      gitInfo: { ...gitInfo, dirty: true },
      skipBuild: true,
      now: new Date('2026-06-12T03:04:05.000Z'),
    }),
    /clean worktree/,
  )
})

async function createFixture({
  appVersion = '0.9.8-beta.3.3',
  releaseVersion = appVersion,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'tos-server-package-'))

  await writeJson(join(root, 'app-version.json'), { version: appVersion })
  await writeJson(join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseNotes.json'), {
    version: releaseVersion,
    date: '2026-06-12',
    added: ['新增服务器发布包。'],
    improved: [],
    fixed: [],
  })

  await writeText(join(root, 'scripts', 'server', 'apply-server-update.sh'), '#!/usr/bin/env bash\n')
  await writeText(join(root, 'tms-backend', 'app_version.py'), `APP_VERSION = "${appVersion}"\n`)
  await writeText(join(root, 'tms-backend', 'main.py'), 'print("main")\n')
  await writeText(join(root, 'tms-backend', 'backend_launcher.py'), 'print("launcher")\n')
  await writeText(join(root, 'tms-backend', 'requirements.txt'), 'fastapi\n')
  await writeText(join(root, 'tms-backend', 'api', 'module.py'), '# api\n')
  await writeText(join(root, 'tms-backend', 'modules', 'module.py'), '# module\n')
  await writeText(join(root, 'tms-backend', 'templates', 'template.txt'), 'template\n')
  await writeText(join(root, 'tms-backend', 'utils', 'file_utils.py'), '# utils\n')

  await writeText(join(root, 'tms-frontend', 'index.html'), '<div id="app"></div>\n')
  await writeJson(join(root, 'tms-frontend', 'package.json'), { name: 'fixture' })
  await writeJson(join(root, 'tms-frontend', 'package-lock.json'), { name: 'fixture', lockfileVersion: 3 })
  await writeText(join(root, 'tms-frontend', 'tsconfig.json'), '{}\n')
  await writeText(join(root, 'tms-frontend', 'tsconfig.node.json'), '{}\n')
  await writeText(join(root, 'tms-frontend', 'vite.config.ts'), 'export default {}\n')
  await writeText(join(root, 'tms-frontend', 'src', 'main.ts'), 'console.info("source")\n')
  await writeText(join(root, 'tms-frontend', 'dist', 'index.html'), '<html></html>\n')

  await writeText(join(root, 'tms-backend', 'Dockerfile'), 'FROM python\n')
  await writeText(join(root, 'tms-frontend', 'nginx.conf'), 'server {}\n')
  await writeText(join(root, 'docker-compose.tos.yml'), 'services: {}\n')
  await writeText(join(root, 'authelia', 'config.yml'), 'theme: light\n')
  await writeText(join(root, 'node_modules', 'ignore-me', 'index.js'), 'module.exports = {}\n')

  return root
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeText(filePath, content) {
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, content)
}
