import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { checkBackendVersion } from './check-backend-version.mjs'

test('passes when backend root and release updates report the current app version', async () => {
  const repoRoot = await createFixture('0.9.8-beta.3.18')
  const fetchImpl = createFetchStub([
    { version: '0.9.8-beta.3.18' },
    { version: '0.9.8-beta.3.18', records: [] },
  ])

  const result = await checkBackendVersion({
    repoRoot,
    backendUrl: 'http://127.0.0.1:8000',
    fetchImpl,
  })

  assert.deepEqual(result, {
    expectedVersion: '0.9.8-beta.3.18',
    backendVersion: '0.9.8-beta.3.18',
    releaseUpdatesVersion: '0.9.8-beta.3.18',
  })
  assert.deepEqual(fetchImpl.urls, [
    'http://127.0.0.1:8000/',
    'http://127.0.0.1:8000/api/release-updates?limit=1',
  ])
})

test('fails when the backend root reports a stale version', async () => {
  const repoRoot = await createFixture('0.9.8-beta.3.18')
  const fetchImpl = createFetchStub([
    { version: '0.9.8-beta.3.17' },
    { version: '0.9.8-beta.3.18', records: [] },
  ])

  await assert.rejects(
    () => checkBackendVersion({
      repoRoot,
      backendUrl: 'http://127.0.0.1:8000',
      fetchImpl,
    }),
    /Backend root version mismatch: expected 0\.9\.8-beta\.3\.18, got 0\.9\.8-beta\.3\.17/,
  )
})

test('fails when release updates reports a stale runtime version', async () => {
  const repoRoot = await createFixture('0.9.8-beta.3.18')
  const fetchImpl = createFetchStub([
    { version: '0.9.8-beta.3.18' },
    { version: '0.9.8-beta.3.17', records: [] },
  ])

  await assert.rejects(
    () => checkBackendVersion({
      repoRoot,
      backendUrl: 'http://127.0.0.1:8000',
      fetchImpl,
    }),
    /Release updates runtime version mismatch: expected 0\.9\.8-beta\.3\.18, got 0\.9\.8-beta\.3\.17/,
  )
})

async function createFixture(version) {
  const root = await mkdtempPath()
  await writeFile(join(root, 'app-version.json'), `${JSON.stringify({ version }, null, 2)}\n`)
  return root
}

function createFetchStub(payloads) {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    const payload = payloads.shift()
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    }
  }
  fetchImpl.urls = urls
  return fetchImpl
}

async function mkdtempPath() {
  const { mkdtemp } = await import('node:fs/promises')
  return mkdtemp(join(tmpdir(), 'tos-backend-version-'))
}
