import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  bumpVersion,
  syncVersion,
  validateAppVersion,
} from './sync-version.mjs'

test('increments the last prerelease number', () => {
  assert.equal(bumpVersion('0.9.8-beta.3.0'), '0.9.8-beta.3.1')
})

test('rejects unsupported version formats', () => {
  assert.throws(
    () => validateAppVersion('0.9.8'),
    /expected format/,
  )
})

test('syncs product version to runtime version files and Electron manifests', async () => {
  const root = await createFixture()

  await syncVersion({
    repoRoot: root,
    nextVersion: '0.9.8-beta.3.0',
  })

  assert.equal(
    JSON.parse(await readFile(join(root, 'app-version.json'), 'utf8')).version,
    '0.9.8-beta.3.0',
  )
  assert.match(
    await readFile(join(root, 'tms-backend', 'app_version.py'), 'utf8'),
    /APP_VERSION = "0\.9\.8-beta\.3\.0"/,
  )
  assert.match(
    await readFile(join(root, 'tms-frontend', 'src', 'shared', 'version', 'appVersion.ts'), 'utf8'),
    /fallbackAppVersion = '0\.9\.8-beta\.3\.0'/,
  )

  const electronPackage = JSON.parse(
    await readFile(join(root, 'tms-electron-app', 'package.json'), 'utf8'),
  )
  const electronLock = JSON.parse(
    await readFile(join(root, 'tms-electron-app', 'package-lock.json'), 'utf8'),
  )
  assert.equal(electronPackage.version, '0.9.8-beta.3.0')
  assert.equal(electronLock.version, '0.9.8-beta.3.0')
  assert.equal(electronLock.packages[''].version, '0.9.8-beta.3.0')
})

async function createFixture() {
  const root = await mkdtempPath()

  await mkdir(join(root, 'tms-backend'), { recursive: true })
  await mkdir(join(root, 'tms-frontend', 'src', 'shared', 'version'), { recursive: true })
  await mkdir(join(root, 'tms-electron-app'), { recursive: true })

  await writeFile(join(root, 'app-version.json'), '{\n  "version": "0.9.8-beta.0.6"\n}\n')
  await writeFile(join(root, 'tms-backend', 'app_version.py'), 'APP_VERSION = "0.9.8-beta.0.6"\n')
  await writeFile(
    join(root, 'tms-frontend', 'src', 'shared', 'version', 'appVersion.ts'),
    "export const fallbackAppVersion = '0.9.8-beta.0.6'\n",
  )
  await writeFile(
    join(root, 'tms-electron-app', 'package.json'),
    JSON.stringify({ name: 'tms-integration-tool', version: '0.9.8-beta.0.6' }, null, 2),
  )
  await writeFile(
    join(root, 'tms-electron-app', 'package-lock.json'),
    JSON.stringify({
      name: 'tms-integration-tool',
      version: '0.9.8-beta.0.6',
      packages: {
        '': {
          name: 'tms-integration-tool',
          version: '0.9.8-beta.0.6',
        },
      },
    }, null, 2),
  )

  return root
}

async function mkdtempPath() {
  const { mkdtemp } = await import('node:fs/promises')
  return mkdtemp(join(tmpdir(), 'tos-version-sync-'))
}
