import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  buildGiteaReleaseRequest,
  buildTosReleaseNotes,
  prepare,
  publish,
} from './semantic-release-tos-plugin.mjs'

const nextRelease = {
  version: '0.9.8-beta.3.29',
  gitTag: 'v0.9.8-beta.3.29',
  gitHead: 'abc123semanticrelease',
  notes: '## 0.9.8-beta.3.29\n\n* feat: 添加自动发布\n',
}

const commits = [
  { subject: 'feat: 添加自动发布链路', message: 'feat: 添加自动发布链路' },
  { subject: 'fix: 修复版本记录读取', message: 'fix: 修复版本记录读取' },
  { subject: 'perf: 优化发布包生成', message: 'perf: 优化发布包生成' },
  { subject: 'docs: 更新发布说明', message: 'docs: 更新发布说明' },
]

test('builds TOS release notes from semantic-release commits', () => {
  const notes = buildTosReleaseNotes({
    version: nextRelease.version,
    releaseDate: '2026-06-22',
    commits,
  })

  assert.equal(notes.version, nextRelease.version)
  assert.equal(notes.date, '2026-06-22')
  assert.equal(notes.noticeId, '2026-06-22-v0.9.8-beta.3.29')
  assert.equal(notes.showPopup, false)
  assert.deepEqual(notes.added, ['添加自动发布链路'])
  assert.deepEqual(notes.fixed, ['修复版本记录读取'])
  assert.deepEqual(notes.improved, ['优化发布包生成'])
})

test('prepare syncs TOS version files and current release notes', async () => {
  const root = await createFixture()

  await prepare(
    { repoRoot: root, releaseDate: '2026-06-22' },
    { nextRelease, commits, branch: { channel: 'beta.3' }, logger: silentLogger },
  )

  assert.equal(
    JSON.parse(await readFile(join(root, 'app-version.json'), 'utf8')).version,
    nextRelease.version,
  )
  assert.match(
    await readFile(join(root, 'tms-backend', 'app_version.py'), 'utf8'),
    /APP_VERSION = "0\.9\.8-beta\.3\.29"/,
  )
  assert.equal(
    JSON.parse(await readFile(join(root, 'tms-electron-app', 'automation-helper-version.json'), 'utf8')).version,
    nextRelease.version,
  )
  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'tms-electron-app', 'automation-apps', 'registry.json'), 'utf8'))
      .map((automationApp) => automationApp.version),
    [nextRelease.version],
  )
  assert.equal(
    JSON.parse(
      await readFile(
        join(root, 'tms-electron-app', 'automation-apps', 'shipping-automation-demo', 'package.json'),
        'utf8',
      ),
    ).version,
    nextRelease.version,
  )

  const releaseNotes = JSON.parse(
    await readFile(join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseNotes.json'), 'utf8'),
  )
  assert.deepEqual(releaseNotes.added, ['添加自动发布链路'])
  assert.deepEqual(releaseNotes.fixed, ['修复版本记录读取'])
  assert.deepEqual(releaseNotes.improved, ['优化发布包生成'])
  const releaseManifest = JSON.parse(
    await readFile(join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseManifest.json'), 'utf8'),
  )
  assert.equal(releaseManifest.version, nextRelease.version)
  assert.equal(releaseManifest.tag, nextRelease.gitTag)
  assert.equal(releaseManifest.gitSha, 'abc123semanticrelease')
  assert.equal(releaseManifest.releaseDate, '2026-06-22')
  assert.equal(releaseManifest.channel, 'beta.3')
  assert.equal(releaseManifest.releaseNotes.version, nextRelease.version)
  assert.deepEqual(releaseManifest.artifacts, {
    serverPackage: null,
    desktopInstaller: null,
    desktopFullInstaller: null,
    automationHelper: null,
  })
})

test('builds Gitea release request without leaking token into the body', () => {
  const request = buildGiteaReleaseRequest({
    apiBaseUrl: 'http://172.16.48.208:3001/api/v1',
    repository: 'luenthai-ai/TOS',
    token: 'secret-token',
    nextRelease,
  })

  assert.equal(request.url, 'http://172.16.48.208:3001/api/v1/repos/luenthai-ai/TOS/releases')
  assert.equal(request.headers.Authorization, 'token secret-token')
  assert.equal(request.body.tag_name, nextRelease.gitTag)
  assert.equal(request.body.name, nextRelease.gitTag)
  assert.equal(request.body.body, nextRelease.notes)
  assert.equal(JSON.stringify(request.body).includes('secret-token'), false)
})

test('publish posts a Gitea release when token and repository are configured', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options })
    return {
      ok: true,
      status: 201,
      text: async () => '{"id":1}',
    }
  }

  await publish(
    {
      giteaToken: 'secret-token',
      repository: 'luenthai-ai/TOS',
      fetchImpl,
    },
    { nextRelease, logger: silentLogger },
  )

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'http://172.16.48.208:3001/api/v1/repos/luenthai-ai/TOS/releases')
  assert.equal(JSON.parse(requests[0].options.body).tag_name, nextRelease.gitTag)
})

async function createFixture() {
  const root = await mkdtempPath()

  await mkdir(join(root, 'tms-backend'), { recursive: true })
  await mkdir(join(root, 'tms-frontend', 'src', 'shared', 'version'), { recursive: true })
  await mkdir(join(root, 'tms-electron-app', 'automation-apps', 'shipping-automation-demo'), { recursive: true })

  await writeFile(join(root, 'app-version.json'), '{\n  "version": "0.9.8-beta.3.28"\n}\n')
  await writeFile(join(root, 'tms-backend', 'app_version.py'), 'APP_VERSION = "0.9.8-beta.3.28"\n')
  await writeFile(
    join(root, 'tms-frontend', 'src', 'shared', 'version', 'appVersion.ts'),
    "export const fallbackAppVersion = '0.9.8-beta.3.28'\n",
  )
  await writeFile(
    join(root, 'tms-frontend', 'src', 'shared', 'version', 'releaseNotes.json'),
    `${JSON.stringify({
      version: '0.9.8-beta.3.28',
      date: '2026-06-21',
      added: ['old added'],
      improved: ['old improved'],
      fixed: ['old fixed'],
    }, null, 2)}\n`,
  )
  await writeFile(
    join(root, 'tms-electron-app', 'package.json'),
    JSON.stringify({ name: 'tms-integration-tool', version: '0.9.8-beta.3.28' }, null, 2),
  )
  await writeFile(
    join(root, 'tms-electron-app', 'package-lock.json'),
    JSON.stringify({
      name: 'tms-integration-tool',
      version: '0.9.8-beta.3.28',
      packages: {
        '': {
          name: 'tms-integration-tool',
          version: '0.9.8-beta.3.28',
        },
      },
    }, null, 2),
  )
  await writeFile(
    join(root, 'tms-electron-app', 'automation-helper-version.json'),
    JSON.stringify({ version: '0.9.8-beta.3.28' }, null, 2),
  )
  await writeFile(
    join(root, 'tms-electron-app', 'automation-apps', 'registry.json'),
    JSON.stringify([{ version: '0.9.8-beta.3.28' }], null, 2),
  )
  await writeFile(
    join(root, 'tms-electron-app', 'automation-apps', 'shipping-automation-demo', 'package.json'),
    JSON.stringify({ version: '0.9.8-beta.3.28' }, null, 2),
  )

  return root
}

async function mkdtempPath() {
  const { mkdtemp } = await import('node:fs/promises')
  return mkdtemp(join(tmpdir(), 'tos-semantic-release-'))
}

const silentLogger = {
  log() {},
  warn() {},
  error() {},
}
