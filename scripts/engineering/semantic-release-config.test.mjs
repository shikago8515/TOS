import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const config = require('../../release.config.cjs')
const semver = require('semver')

test('semantic-release recognizes beta.3 tags while publishing the beta.3 channel', () => {
  assert.equal(config.repositoryUrl, 'http://172.16.48.208:3001/luenthai-ai/TOS.git')
  assert.deepEqual(config.branches, [
    'stable',
    {
      name: 'main',
      prerelease: 'beta',
      channel: 'beta.3',
    },
  ])
  assert.equal(config.tagFormat, 'v${version}')
  assert.equal(semver.inc('1.0.0-beta.3.1', 'prerelease', config.branches[1].prerelease), '1.0.0-beta.3.2')
})

test('semantic-release updates TOS version files before committing release assets', () => {
  const pluginNames = config.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
  const tosPluginIndex = pluginNames.indexOf('./scripts/engineering/semantic-release-tos-plugin.mjs')
  const gitPluginIndex = pluginNames.indexOf('@semantic-release/git')

  assert(tosPluginIndex >= 0)
  assert(gitPluginIndex >= 0)
  assert(tosPluginIndex < gitPluginIndex)

  const gitPlugin = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/git')
  const expectedReleaseAssets = [
    'app-version.json',
    'tms-backend/app_version.py',
    'tms-frontend/src/shared/version/appVersion.ts',
    'tms-frontend/src/shared/version/releaseHistory.json',
    'tms-frontend/src/shared/version/releaseManifest.json',
    'tms-frontend/src/shared/version/releaseNotes.json',
    'tms-backend/data/release_updates_seed.json',
    'tms-electron-app/package.json',
    'tms-electron-app/package-lock.json',
    'tms-electron-app/automation-helper-version.json',
    'tms-electron-app/automation-apps/registry.json',
    'tms-electron-app/automation-apps/shipping-automation-demo/package.json',
  ]

  for (const expectedAsset of expectedReleaseAssets) {
    assert(gitPlugin[1].assets.includes(expectedAsset), `${expectedAsset} must be committed by semantic-release`)
  }
})
