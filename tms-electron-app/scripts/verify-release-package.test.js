const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')

const {
  collectReleasePackageIssues,
} = require('./verify-release-package')

const requiredUnpackedResourcePaths = [
  'resources/app.asar',
  'resources/browser-plugins/registry.json',
  'resources/browser-plugins/infornexus-auto-add/manifest.json',
  'resources/browser-plugins/infornexus-auto-add/content.js',
  'resources/browser-plugins/infornexus-auto-add/xlsx.min.js',
  'resources/automation-launcher/adidas-materials-direct.js',
  'resources/automation-launcher/core.js',
  'resources/automation-launcher/server.js',
  'resources/automation-apps/registry.json',
  'resources/automation-apps/microsoft-login-n8n-demo/package.json',
  'resources/automation-apps/microsoft-login-n8n-demo/bin/start.js',
  'resources/automation-apps/microsoft-login-n8n-demo/server.mjs',
  'resources/automation-apps/microsoft-login-n8n-demo/demo-upload.html',
  'resources/automation-apps/microsoft-login-n8n-demo/executor.config.json',
  'resources/automation-apps/shipping-automation-demo/package.json',
  'resources/automation-apps/shipping-automation-demo/bin/start.js',
  'resources/automation-apps/shipping-automation-demo/server.mjs',
  'resources/automation-apps/shipping-automation-demo/executor.config.json',
  'resources/automation-apps/playwright-console/bin/start.js',
  'resources/automation-apps/playwright-console/config/default.config.json',
  'resources/automation-apps/playwright-console/public/index.html',
  'resources/automation-apps/playwright-console/node_modules/statuses/index.js',
  'resources/backend/main.py',
  'resources/backend/app_version.py',
  'resources/backend/api/.gitkeep',
  'resources/backend/config/settings.yaml',
  'resources/backend/config/credential.key',
  'resources/backend/data/release_updates_seed.json',
  'resources/backend/modules/.gitkeep',
  'resources/backend/templates/sophia_tina_pivot_template.xlsx',
  'resources/backend-runtime/tos-backend/tos-backend.exe',
  'resources/backend-runtime/tos-backend/_internal/base_library.zip',
  'resources/backend-runtime/tos-backend/_internal/config/settings.yaml',
  'resources/backend-runtime/tos-backend/_internal/config/credential.key',
  'resources/backend-runtime/tos-backend/_internal/data/release_updates_seed.json',
  'resources/backend-runtime/tos-backend/_internal/templates/sophia_tina_pivot_template.xlsx',
  'resources/external-apps/infornexus/electron-app.exe',
]

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tos-release-verify-'))
}

function touch(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function sha512Base64(content) {
  return crypto.createHash('sha512').update(content).digest('base64')
}

function touchManualDownloadArtifacts(distDir, version, content = 'manual download zip') {
  const zipName = `TOS_v${version}_Windows_x64_unpacked.zip`
  const zipUrl = zipName
  touch(path.join(distDir, zipUrl), content)
  touch(path.join(distDir, 'manual-downloads.json'), JSON.stringify({
    version,
    files: [
      {
        type: 'windows-x64-unpacked',
        label: 'Windows x64 免安装版',
        url: zipUrl,
        sha512: sha512Base64(content),
        size: Buffer.byteLength(content),
      },
    ],
  }))
}

function touchRequiredUnpackedResources(appOutDir, version) {
  for (const relativePath of requiredUnpackedResourcePaths) {
    const content = relativePath.endsWith('main.py')
      ? 'app = FastAPI(version=APP_VERSION)\n'
      : relativePath.endsWith('app_version.py')
        ? `APP_VERSION = "${version}"\n`
        : ''
    touch(path.join(appOutDir, relativePath), content)
  }
}

test('reports missing runtime resources in an unpacked app directory', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(appOutDir, 'resources', 'app.asar'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.2',
  })

  assert(issues.some((issue) => issue.includes('resources/browser-plugins/registry.json')))
  assert(issues.some((issue) => issue.includes('resources/backend/main.py')))
  assert(issues.some((issue) => issue.includes('resources/backend-runtime/tos-backend/tos-backend.exe')))
  assert(issues.some((issue) => issue.includes('resources/external-apps/infornexus/electron-app.exe')))
})

test('reports missing adidas Materials launcher bridge in release package', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.8-beta.3.19'

  touchRequiredUnpackedResources(appOutDir, version)
  fs.rmSync(
    path.join(appOutDir, 'resources/automation-launcher/adidas-materials-direct.js'),
    { force: true },
  )

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
    skipArtifacts: true,
  })

  assert(issues.some((issue) => issue.includes('resources/automation-launcher/adidas-materials-direct.js')))
})

test('reports latest.yml when the referenced installer is missing', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(appOutDir, 'resources', 'browser-plugins', 'registry.json'), '[]')
  touch(path.join(appOutDir, 'resources', 'browser-plugins', 'infornexus-auto-add', 'manifest.json'), '{}')
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'registry.json'), '[]')
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'microsoft-login-n8n-demo', 'package.json'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'microsoft-login-n8n-demo', 'bin', 'start.js'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'microsoft-login-n8n-demo', 'server.mjs'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'microsoft-login-n8n-demo', 'demo-upload.html'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'microsoft-login-n8n-demo', 'executor.config.json'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'shipping-automation-demo', 'package.json'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'shipping-automation-demo', 'bin', 'start.js'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'shipping-automation-demo', 'server.mjs'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'shipping-automation-demo', 'executor.config.json'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'playwright-console', 'bin', 'start.js'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'playwright-console', 'node_modules', 'statuses', 'index.js'))
  touch(path.join(appOutDir, 'resources', 'backend', 'main.py'))
  touch(path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', 'tos-backend.exe'))
  touch(path.join(appOutDir, 'resources', 'external-apps', 'infornexus', 'electron-app.exe'))
  touch(path.join(root, 'latest.yml'), [
    'version: 0.9.6-beta.2',
    'path: TOS.Setup.0.9.6-beta.2.exe',
  ].join('\n'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.2',
  })

  assert(issues.some((issue) => issue.includes('latest.yml path target is missing')))
})

test('reports latest.yml installer sha512 mismatches', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.6-beta.3'
  const installerName = `TOS.Setup.${version}.exe`

  touch(path.join(root, installerName), 'installer')
  touch(path.join(root, `${installerName}.blockmap`), 'blockmap')
  touch(path.join(root, 'latest.yml'), [
    `version: ${version}`,
    `path: ${installerName}`,
    'sha512: definitely-not-the-installer-hash',
    'files:',
    `  - url: ${installerName}`,
    '    sha512: definitely-not-the-installer-hash',
    '    size: 9',
  ].join('\n'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
  })

  assert(issues.some((issue) => issue.includes('latest.yml sha512 mismatch')))
  assert(issues.some((issue) => issue.includes(`latest.yml file sha512 mismatch for ${installerName}`)))
})

test('reports stale top-level release artifacts for another version', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(root, 'TOS.Setup.0.9.6-beta.2.exe'))
  touch(path.join(root, 'TOS Setup 0.9.6-beta.2.exe'))
  touch(path.join(root, 'TOS_v0.9.6-beta.2_Portable.exe'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.3',
  })

  assert(issues.some((issue) => issue.includes('TOS.Setup.0.9.6-beta.2.exe')))
  assert(issues.some((issue) => issue.includes('legacy release artifact name is not allowed: TOS Setup 0.9.6-beta.2.exe')))
  assert(issues.some((issue) => issue.includes('TOS_v0.9.6-beta.2_Portable.exe')))
})

test('reports any portable artifact even when it matches the current version', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.6-beta.3'
  touch(path.join(root, `TOS_v${version}_Portable.exe`))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
  })

  assert(issues.some((issue) => issue.includes(`TOS_v${version}_Portable.exe`)))
})

test('reports stale unpacked zip release artifacts for another version', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const staleVersion = '0.9.6-beta.2'
  touch(path.join(root, `TOS_v${staleVersion}_Windows_x64_unpacked.zip`))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.3',
  })

  assert(issues.some((issue) => issue.includes(`TOS_v${staleVersion}_Windows_x64_unpacked.zip`)))
})

test('reports missing manual download manifest for release artifacts', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.6-beta.3'
  const installerName = `TOS.Setup.${version}.exe`

  touchRequiredUnpackedResources(appOutDir, version)
  touch(path.join(root, installerName), 'installer')
  touch(path.join(root, `${installerName}.blockmap`), 'blockmap')
  touch(path.join(root, 'latest.yml'), [
    `version: ${version}`,
    `path: ${installerName}`,
    'files:',
    `  - url: ${installerName}`,
    '    size: 9',
  ].join('\n'))
  touch(path.join(root, 'changelog.json'), JSON.stringify({ version }))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
  })

  assert(issues.some((issue) => issue.includes('missing release artifact: manual-downloads.json')))
})

test('reports manual download zip metadata mismatches', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.6-beta.3'
  const zipName = `TOS_v${version}_Windows_x64_unpacked.zip`
  const zipUrl = zipName

  touch(path.join(root, zipUrl), 'manual zip')
  touch(path.join(root, 'manual-downloads.json'), JSON.stringify({
    version,
    files: [
      {
        type: 'windows-x64-unpacked',
        label: 'Windows x64 免安装版',
        url: zipUrl,
        sha512: 'wrong-hash',
        size: 1,
      },
    ],
  }))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
  })

  assert(issues.some((issue) => issue.includes(`manual-downloads.json sha512 mismatch for ${zipUrl}`)))
  assert(issues.some((issue) => issue.includes(`manual-downloads.json size mismatch for ${zipUrl}`)))
})

test('accepts installer release artifacts with a manual zip fallback', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.6-beta.3'
  const installerName = `TOS.Setup.${version}.exe`

  touchRequiredUnpackedResources(appOutDir, version)
  touch(path.join(root, installerName), 'installer')
  touch(path.join(root, `${installerName}.blockmap`), 'blockmap')
  touch(path.join(root, 'latest.yml'), [
    `version: ${version}`,
    `path: ${installerName}`,
    'files:',
    `  - url: ${installerName}`,
    '    size: 9',
  ].join('\n'))
  touch(path.join(root, 'changelog.json'), JSON.stringify({ version }))
  touchManualDownloadArtifacts(root, version)

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
  })

  assert.deepEqual(issues, [])
})

test('reports backend version mismatches in packaged source', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(appOutDir, 'resources', 'backend', 'main.py'), [
    'app = FastAPI(version="0.9.6-beta.2")',
    'return {"version": "0.9.6-beta.2"}',
  ].join('\n'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.3',
    skipArtifacts: true,
  })

  assert(issues.some((issue) => issue.includes('backend version mismatch')))
})

test('accepts backend version from shared app_version module', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touchRequiredUnpackedResources(appOutDir, '0.9.6-beta.3')

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.3',
    skipArtifacts: true,
  })

  assert.deepEqual(issues, [])
})

test('reports backend runtime older than packaged backend source', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const mainPath = path.join(appOutDir, 'resources', 'backend', 'main.py')
  const runtimePath = path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', 'tos-backend.exe')
  touch(mainPath, 'app = FastAPI(version="0.9.6-beta.3")')
  touch(runtimePath)

  fs.utimesSync(runtimePath, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
  fs.utimesSync(mainPath, new Date('2026-01-02T00:00:00Z'), new Date('2026-01-02T00:00:00Z'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.3',
    skipArtifacts: true,
  })

  assert(issues.some((issue) => issue.includes('backend runtime is older than packaged backend source')))
})

test('reports forbidden heavyweight runtime and external app cache resources', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.8-beta.3.28'

  touchRequiredUnpackedResources(appOutDir, version)
  touch(path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', '_internal', 'torch', 'lib', 'torch_cpu.dll'))
  touch(path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', '_internal', 'cv2', 'cv2.pyd'))
  touch(path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', '_internal', 'pyarrow', 'arrow.dll'))
  touch(path.join(appOutDir, 'resources', 'external-apps', 'infornexus', 'cache', 'Cache', 'data_0'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
    skipArtifacts: true,
  })

  assert(issues.some((issue) => issue.includes('forbidden backend runtime resource: resources/backend-runtime/tos-backend/_internal/torch')))
  assert(issues.some((issue) => issue.includes('forbidden backend runtime resource: resources/backend-runtime/tos-backend/_internal/cv2')))
  assert(issues.some((issue) => issue.includes('forbidden backend runtime resource: resources/backend-runtime/tos-backend/_internal/pyarrow')))
  assert(issues.some((issue) => issue.includes('forbidden external app cache resource: resources/external-apps/infornexus/cache')))
})

test('reports missing Sophia Tina pivot templates in backend resources', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  const version = '0.9.8-beta.0.6'

  touchRequiredUnpackedResources(appOutDir, version)
  fs.rmSync(path.join(appOutDir, 'resources/backend/templates/sophia_tina_pivot_template.xlsx'), { force: true })
  fs.rmSync(
    path.join(appOutDir, 'resources/backend-runtime/tos-backend/_internal/templates/sophia_tina_pivot_template.xlsx'),
    { force: true },
  )

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: version,
    skipArtifacts: true,
  })

  assert(issues.some((issue) => issue.includes('resources/backend/templates/sophia_tina_pivot_template.xlsx')))
  assert(issues.some((issue) => issue.includes('resources/backend-runtime/tos-backend/_internal/templates/sophia_tina_pivot_template.xlsx')))
})
