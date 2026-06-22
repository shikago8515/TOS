import assert from 'node:assert/strict'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  cleanupLocalArtifacts,
  createCleanupTarget,
} from './cleanup-local-artifacts.mjs'

test('dry-run reports default artifacts without deleting them', async () => {
  const repoRoot = await createFixture([
    'tms-electron-app/dist',
    'tms-backend/build',
    'node_modules',
  ])

  const result = await cleanupLocalArtifacts({ repoRoot })

  assert.equal(result.apply, false)
  assert.equal(result.includeDeps, false)
  assert(result.targets.some((target) => target.relativePath === 'tms-electron-app/dist'))
  assert(result.targets.some((target) => target.relativePath === 'tms-backend/build'))
  assert(!result.targets.some((target) => target.relativePath === 'node_modules'))
  assert(result.targets.some((target) => target.action === 'would-delete'))
  assert.equal(await pathExists(join(repoRoot, 'tms-electron-app', 'dist')), true)
  assert.equal(await pathExists(join(repoRoot, 'tms-backend', 'build')), true)
})

test('apply deletes default generated artifacts and keeps dependency directories', async () => {
  const repoRoot = await createFixture([
    'tms-electron-app/dist',
    'tms-electron-app/dist-automation-helper',
    'tms-backend/build',
    'release',
    'tms-backend/uploads',
    'tms-frontend/dist',
    'node_modules',
    'tms-electron-app/node_modules',
    '.venv',
  ])

  const result = await cleanupLocalArtifacts({ repoRoot, apply: true })

  assert(result.targets.every((target) => target.action === 'deleted' || target.action === 'missing'))
  assert.equal(await pathExists(join(repoRoot, 'tms-electron-app', 'dist')), false)
  assert.equal(await pathExists(join(repoRoot, 'tms-electron-app', 'dist-automation-helper')), false)
  assert.equal(await pathExists(join(repoRoot, 'tms-backend', 'build')), false)
  assert.equal(await pathExists(join(repoRoot, 'release')), false)
  assert.equal(await pathExists(join(repoRoot, 'tms-backend', 'uploads')), true)
  assert.equal(await pathExists(join(repoRoot, 'tms-frontend', 'dist')), false)
  assert.equal(await pathExists(join(repoRoot, 'node_modules')), true)
  assert.equal(await pathExists(join(repoRoot, 'tms-electron-app', 'node_modules')), true)
  assert.equal(await pathExists(join(repoRoot, '.venv')), true)
})

test('includeRuntimeData explicitly includes runtime upload directories', async () => {
  const repoRoot = await createFixture([
    'tms-backend/uploads',
  ])

  const result = await cleanupLocalArtifacts({ repoRoot, apply: true, includeRuntimeData: true })

  assert(result.targets.some((target) => target.relativePath === 'tms-backend/uploads'))
  assert.equal(await pathExists(join(repoRoot, 'tms-backend', 'uploads')), false)
})

test('includeDeps explicitly includes dependency directories', async () => {
  const repoRoot = await createFixture([
    'node_modules',
    'tms-electron-app/node_modules',
    'tms-frontend/node_modules',
    '.venv',
  ])

  const result = await cleanupLocalArtifacts({ repoRoot, apply: true, includeDeps: true })

  assert(result.targets.some((target) => target.relativePath === 'node_modules'))
  assert(result.targets.some((target) => target.relativePath === '.venv'))
  assert.equal(await pathExists(join(repoRoot, 'node_modules')), false)
  assert.equal(await pathExists(join(repoRoot, 'tms-electron-app', 'node_modules')), false)
  assert.equal(await pathExists(join(repoRoot, 'tms-frontend', 'node_modules')), false)
  assert.equal(await pathExists(join(repoRoot, '.venv')), false)
})

test('rejects cleanup targets that resolve outside repo root', async () => {
  const repoRoot = await createFixture([])

  assert.throws(
    () => createCleanupTarget(repoRoot, '../outside'),
    /Refusing to clean outside repo root/,
  )
})

async function createFixture(relativeDirs) {
  const { mkdtemp, writeFile } = await import('node:fs/promises')
  const repoRoot = await mkdtemp(join(tmpdir(), 'tos-cleanup-'))

  for (const relativeDir of relativeDirs) {
    const absoluteDir = join(repoRoot, ...relativeDir.split('/'))
    await mkdir(absoluteDir, { recursive: true })
    await writeFile(join(absoluteDir, 'marker.txt'), relativeDir)
  }

  return repoRoot
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (_error) {
    return false
  }
}
