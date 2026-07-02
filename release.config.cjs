module.exports = {
  repositoryUrl: 'http://172.16.48.208:3001/luenthai-ai/TOS.git',
  tagFormat: 'v${version}',
  branches: [
    'stable',
    {
      name: 'main',
      prerelease: 'beta3',
      channel: 'beta.3',
    },
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'build', release: 'patch' },
          { type: 'ci', release: 'patch' },
          { type: 'docs', release: false },
          { type: 'test', release: false },
          { type: 'chore', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      './scripts/engineering/semantic-release-tos-plugin.mjs',
      {
        repository: 'luenthai-ai/TOS',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'app-version.json',
          'tms-backend/app_version.py',
          'tms-frontend/src/shared/version/appVersion.ts',
          'tms-frontend/src/shared/version/releaseManifest.json',
          'tms-frontend/src/shared/version/releaseNotes.json',
          'tms-electron-app/package.json',
          'tms-electron-app/package-lock.json',
          'tms-electron-app/automation-helper-version.json',
          'tms-electron-app/automation-apps/registry.json',
          'tms-electron-app/automation-apps/shipping-automation-demo/package.json',
        ],
        message: 'chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
}
