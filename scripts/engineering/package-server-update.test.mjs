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
  remote: 'http://172.16.48.208:3001/luenthai-ai/TOS.git',
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

test('server apply script posts release update records after deploy verification', async () => {
  const deployScript = await readFile(new URL('../server/apply-server-update.sh', import.meta.url), 'utf8')
  const backendWait = 'wait_for_command "backend API" curl -fsS http://127.0.0.1:18000/'
  const frontendWait = 'wait_for_command "frontend static site" curl -fsSI http://127.0.0.1:18080/'

  assert.match(deployScript, /api\/release-updates/)
  assert.match(deployScript, /api\/release-announcements/)
  assert.match(deployScript, /releaseUpdateRecord/)
  assert.match(deployScript, /releaseAnnouncement/)
  assert.match(deployScript, /wait_for_command\(\) \{/)
  assert.match(deployScript, /TOS_VERIFY_RETRIES:-30/)
  assert.match(deployScript, /TOS_VERIFY_DELAY:-2/)
  assert.match(deployScript, /wait_for_command "backend API" curl -fsS http:\/\/127\.0\.0\.1:18000\//)
  assert.match(deployScript, /wait_for_command "frontend static site" curl -fsSI http:\/\/127\.0\.0\.1:18080\//)
  assert.doesNotMatch(deployScript, /^curl -fsS http:\/\/127\.0\.0\.1:18000\/$/m)
  assert.doesNotMatch(deployScript, /^curl -fsSI http:\/\/127\.0\.0\.1:18080\/$/m)

  const backendWaitIndex = deployScript.indexOf(backendWait)
  const frontendWaitIndex = deployScript.indexOf(frontendWait)
  const syncCallIndex = deployScript.search(/\r?\nsync_release_update_record\r?\n/)
  const announcementSyncCallIndex = deployScript.search(/\r?\nsync_release_announcement\r?\n/)

  assert(backendWaitIndex > -1)
  assert(frontendWaitIndex > -1)
  assert(syncCallIndex > -1)
  assert(announcementSyncCallIndex > -1)
  assert(backendWaitIndex < syncCallIndex)
  assert(frontendWaitIndex < syncCallIndex)
  assert(backendWaitIndex < announcementSyncCallIndex)
  assert(frontendWaitIndex < announcementSyncCallIndex)
})

test('server apply script replaces backend data files from the package', async () => {
  const deployScript = await readFile(new URL('../server/apply-server-update.sh', import.meta.url), 'utf8')

  assert.match(deployScript, /rm -rf .*tms-backend\/data/)
  assert.match(deployScript, /cp -a "\$SRC\/tms-backend\/data" tms-backend\//)
})

test('Gitea main deployment script keeps source and deployment directories separate', async () => {
  const deployScript = await readFile(new URL('../server/deploy-gitea-main.sh', import.meta.url), 'utf8')

  assert.match(deployScript, /SOURCE_DIR="\$\{TOS_SOURCE_DIR:-\$HOME\/TOS-source\}"/)
  assert.match(deployScript, /DEPLOY_ROOT="\$\{TOS_DEPLOY_ROOT:-\$HOME\/TOS\}"/)
  assert.match(deployScript, /git clone --branch "\$BRANCH" "\$REMOTE_URL" "\$SOURCE_DIR"/)
  assert.match(deployScript, /git status --short/)
  assert.match(deployScript, /git pull --ff-only "\$REMOTE_NAME" "\$BRANCH"/)
  assert.doesNotMatch(deployScript, /git reset --hard/)
  assert.doesNotMatch(deployScript, /git clean -fd/)
  assert.doesNotMatch(deployScript, /cd "\$DEPLOY_ROOT"[\s\S]*git pull/)
})

test('Gitea main deployment script packages and applies the standard server update archive', async () => {
  const deployScript = await readFile(new URL('../server/deploy-gitea-main.sh', import.meta.url), 'utf8')

  assert.match(deployScript, /npm run ci:install/)
  assert.doesNotMatch(deployScript, /npm run check:quick/)
  assert.match(deployScript, /npm run test:server-package/)
  assert.match(deployScript, /npm --prefix tms-frontend run typecheck/)
  assert.match(deployScript, /npm --prefix tms-frontend run test/)
  assert.match(deployScript, /\$\{PYTHON:-python3\} -m unittest discover tests\/ -v/)
  assert.match(deployScript, /npm run server:package:dry-run/)
  assert.match(deployScript, /npm run server:package/)
  assert.match(deployScript, /deploy\/apply-server-update\.sh/)
  assert.match(deployScript, /wait_for_command\(\) \{/)
  assert.match(deployScript, /TOS_VERIFY_RETRIES:-30/)
  assert.match(deployScript, /wait_for_command "backend API" curl -fsS http:\/\/127\.0\.0\.1:18000\//)
  assert.match(deployScript, /wait_for_command "frontend static site" curl -fsSI http:\/\/127\.0\.0\.1:18080\//)
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

test('accepts module-scoped release notes for batched popup summaries', async () => {
  const root = await createFixture()
  await writeJson(join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseNotes.json'), {
    version: '0.9.8-beta.3.3',
    date: '2026-06-12',
    noticeId: '2026-06-12-batch',
    showPopup: true,
    added: [],
    improved: [],
    fixed: [],
    modules: [
      {
        name: 'iPlex 双表核对',
        fixed: ['总计行不再写公式。'],
      },
      {
        name: 'Work Sales',
        improved: ['合并导出流程。'],
      },
    ],
  })

  const metadata = await validateReleaseMetadata(root)
  assert.equal(metadata.releaseNotes.modules.length, 2)

  const plan = await createServerPackage({
    repoRoot: root,
    dryRun: true,
    gitInfo: { ...gitInfo, subject: 'feat: 批量发布更新' },
    now: new Date('2026-06-12T03:04:05.000Z'),
  })
  assert.match(plan.releaseUpdateRecord.description, /iPlex 双表核对：修复：总计行不再写公式/)
  assert.match(plan.releaseUpdateRecord.description, /Work Sales：优化：合并导出流程/)
})

test('uses the semantic-release manifest as the server release update source when present', async () => {
  const root = await createFixture()
  await writeJson(join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseManifest.json'), {
    version: '0.9.8-beta.3.3',
    tag: 'v0.9.8-beta.3.3',
    gitSha: 'abc123semanticrelease',
    releaseDate: '2026-06-13',
    channel: 'beta.3',
    releaseNotes: {
      version: '0.9.8-beta.3.3',
      date: '2026-06-13',
      added: ['Add version manifest'],
      improved: [],
      fixed: ['Fix release record source'],
      modules: [],
    },
    announcement: {
      noticeId: 'v0.9.8-beta.3.3',
      version: '0.9.8-beta.3.3',
      releaseDate: '2026-06-13',
      showPopup: true,
      level: 'feature',
      title: 'Release v0.9.8-beta.3.3',
      groups: [
        { title: 'Added', icon: 'sparkles', items: ['Add version manifest'] },
      ],
    },
    artifacts: {
      serverPackage: null,
      desktopInstaller: null,
      desktopFullInstaller: null,
      automationHelper: null,
    },
  })

  const plan = await createServerPackage({
    repoRoot: root,
    dryRun: true,
    gitInfo: { ...gitInfo, subject: 'fix: local deploy follow-up', author: 'Deploy Bot' },
    now: new Date('2026-06-12T03:04:05.000Z'),
  })

  assert.equal(plan.releaseManifest.version, '0.9.8-beta.3.3')
  assert.equal(plan.releaseUpdateRecord.recordKey, 'release-v0.9.8-beta.3.3')
  assert.equal(plan.releaseUpdateRecord.version, '0.9.8-beta.3.3')
  assert.equal(plan.releaseUpdateRecord.releaseDate, '2026-06-13')
  assert.equal(plan.releaseUpdateRecord.pageName, 'Version Release')
  assert.equal(plan.releaseUpdateRecord.title, 'Release v0.9.8-beta.3.3')
  assert.equal(plan.releaseUpdateRecord.createdBy, 'release:semantic-release')
  assert.match(plan.releaseUpdateRecord.description, /Add version manifest/)
  assert.match(plan.releaseUpdateRecord.description, /abc123semanticrelease/)
  assert.deepEqual(plan.releaseAnnouncement, {
    noticeId: 'v0.9.8-beta.3.3',
    version: '0.9.8-beta.3.3',
    releaseDate: '2026-06-13',
    showPopup: true,
    level: 'feature',
    title: 'Release v0.9.8-beta.3.3',
    groups: [
      { title: 'Added', icon: 'sparkles', items: ['Add version manifest'] },
    ],
  })
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

test('dry-run records Gitea origin remote in server source checkouts', async () => {
  const root = await createFixture()
  const giteaUrl = 'http://172.16.48.208:3001/luenthai-ai/TOS.git'

  await execFileAsync('git', ['init'], { cwd: root })
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: root })
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: root })
  await execFileAsync('git', ['config', 'core.autocrlf', 'false'], { cwd: root })
  await execFileAsync('git', ['add', '.'], { cwd: root })
  await execFileAsync('git', ['commit', '-m', 'feat: server deploy'], { cwd: root })
  await execFileAsync('git', ['branch', '-M', 'main'], { cwd: root })
  await execFileAsync('git', ['remote', 'add', 'origin', giteaUrl], { cwd: root })

  const plan = await createServerPackage({
    repoRoot: root,
    dryRun: true,
    now: new Date('2026-06-12T03:04:05.000Z'),
  })

  assert.equal(plan.gitRemote, giteaUrl)
  assert.equal(plan.gitBranch, 'main')
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
  assert(entries.includes('tms-backend/data/release_updates_seed.json'))
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
  assert.deepEqual(manifest.releaseUpdateRecord, {
    recordKey: `git-${gitInfo.commit}`,
    version: '0.9.8-beta.3.3',
    releaseDate: '2026-06-12',
    category: 'improved',
    pageName: '服务器部署',
    pagePath: '/release-updates',
    title: 'Server deploy 0.9.8-beta.3.3',
    description: '由服务器部署自动记录：0.9.8-beta.3.3 (4e1c3e5)。',
    createdBy: 'git:deploy',
  })
  assert.equal(manifest.releaseAnnouncement, null)
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
  await writeJson(join(root, 'tms-backend', 'data', 'release_updates_seed.json'), [])

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
