const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const appDir = path.resolve(__dirname, '..')
const packagePath = path.join(appDir, 'package.json')
const defaultDistDir = path.join(appDir, 'dist')
const defaultAppOutDir = path.join(defaultDistDir, 'win-unpacked')

const requiredUnpackedResources = [
  'resources/app.asar',
  'resources/browser-plugins/registry.json',
  'resources/browser-plugins/infornexus-auto-add/manifest.json',
  'resources/browser-plugins/infornexus-auto-add/content.js',
  'resources/browser-plugins/infornexus-auto-add/xlsx.min.js',
  'resources/automation-apps/registry.json',
  'resources/automation-apps/playwright-console/bin/start.js',
  'resources/automation-apps/playwright-console/config/default.config.json',
  'resources/automation-apps/playwright-console/public/index.html',
  'resources/automation-apps/playwright-console/node_modules/statuses/index.js',
  'resources/backend/main.py',
  'resources/backend/api',
  'resources/backend/modules',
  'resources/backend-runtime/tos-backend/tos-backend.exe',
  'resources/backend-runtime/tos-backend/_internal/base_library.zip',
  'resources/external-apps/infornexus/electron-app.exe',
]

function normalizePackagePath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readExpectedVersion() {
  return readJson(packagePath).version
}

function parseLatestYml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  try {
    // 优先使用 electron-builder 已安装的 YAML 解析器，避免用字符串猜测复杂结构。
    return require('js-yaml').load(content) || {}
  } catch (_error) {
    const result = {}
    const pathMatch = content.match(/^path:\s*(.+)$/m)
    const versionMatch = content.match(/^version:\s*(.+)$/m)
    if (pathMatch) result.path = pathMatch[1].trim().replace(/^['"]|['"]$/g, '')
    if (versionMatch) result.version = versionMatch[1].trim().replace(/^['"]|['"]$/g, '')
    return result
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath)
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(filePath, 'r')

  try {
    let bytesRead = 0
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead))
      }
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(fd)
  }

  return hash.digest('base64')
}

function collectMissingUnpackedResources(appOutDir) {
  return requiredUnpackedResources
    .filter((relativePath) => !fileExists(path.join(appOutDir, relativePath)))
    .map((relativePath) => `missing unpacked resource: ${normalizePackagePath(relativePath)}`)
}

function collectLatestYmlIssues(distDir, expectedVersion) {
  const issues = []
  const latestPath = path.join(distDir, 'latest.yml')
  const expectedInstallerName = `TOS Setup ${expectedVersion}.exe`

  if (!fileExists(latestPath)) {
    return ['missing release artifact: latest.yml']
  }

  const latest = parseLatestYml(latestPath)
  if (latest.version && latest.version !== expectedVersion) {
    issues.push(`latest.yml version mismatch: expected ${expectedVersion}, got ${latest.version}`)
  }

  if (!latest.path) {
    issues.push('latest.yml is missing path')
  } else {
    if (latest.path !== expectedInstallerName) {
      issues.push(`latest.yml path mismatch: expected ${expectedInstallerName}, got ${latest.path}`)
    }

    const setupPath = path.join(distDir, latest.path)
    if (!fileExists(setupPath)) {
      issues.push(`latest.yml path target is missing: ${latest.path}`)
    } else if (typeof latest.sha512 === 'string') {
      const actualSha512 = sha512Base64(setupPath)
      if (actualSha512 !== latest.sha512) {
        issues.push(`latest.yml sha512 mismatch for ${latest.path}: expected ${latest.sha512}, got ${actualSha512}`)
      }
    }

    const blockmapPath = `${setupPath}.blockmap`
    if (!fileExists(blockmapPath)) {
      issues.push(`installer blockmap is missing: ${path.basename(blockmapPath)}`)
    }
  }

  if (Array.isArray(latest.files)) {
    for (const file of latest.files) {
      if (!file || typeof file.url !== 'string') {
        continue
      }
      if (!fileExists(path.join(distDir, file.url))) {
        issues.push(`latest.yml file target is missing: ${file.url}`)
        continue
      }
      if (file.url !== expectedInstallerName) {
        issues.push(`latest.yml file target mismatch: expected ${expectedInstallerName}, got ${file.url}`)
      }
      if (typeof file.sha512 === 'string') {
        const actualSha512 = sha512Base64(path.join(distDir, file.url))
        if (actualSha512 !== file.sha512) {
          issues.push(`latest.yml file sha512 mismatch for ${file.url}: expected ${file.sha512}, got ${actualSha512}`)
        }
      }
      if (typeof file.size === 'number') {
        const actualSize = fs.statSync(path.join(distDir, file.url)).size
        if (actualSize !== file.size) {
          issues.push(`latest.yml file size mismatch for ${file.url}: expected ${file.size}, got ${actualSize}`)
        }
      }
    }
  }

  return issues
}

function collectTopLevelArtifactIssues(distDir, expectedVersion) {
  const issues = []
  const changelogPath = path.join(distDir, 'changelog.json')
  const installerName = `TOS Setup ${expectedVersion}.exe`
  const blockmapName = `${installerName}.blockmap`

  if (!fileExists(path.join(distDir, installerName))) {
    issues.push(`missing release artifact: ${installerName}`)
  }

  if (!fileExists(path.join(distDir, blockmapName))) {
    issues.push(`missing release artifact: ${blockmapName}`)
  }

  if (!fileExists(changelogPath)) {
    issues.push('missing release artifact: changelog.json')
  } else {
    try {
      const changelog = readJson(changelogPath)
      if (changelog.version !== expectedVersion) {
        issues.push(`changelog.json version mismatch: expected ${expectedVersion}, got ${changelog.version}`)
      }
    } catch (error) {
      issues.push(`changelog.json is invalid: ${error.message}`)
    }
  }

  return issues
}

function collectManualDownloadIssues(distDir, expectedVersion) {
  const issues = []
  const manifestPath = path.join(distDir, 'manual-downloads.json')
  const expectedZipName = `TOS_v${expectedVersion}_Windows_x64_unpacked.zip`
  const expectedZipUrl = `downloads/${expectedVersion}/${expectedZipName}`

  if (!fileExists(manifestPath)) {
    return ['missing release artifact: manual-downloads.json']
  }

  let manifest
  try {
    manifest = readJson(manifestPath)
  } catch (error) {
    return [`manual-downloads.json is invalid: ${error.message}`]
  }

  if (manifest.version !== expectedVersion) {
    issues.push(`manual-downloads.json version mismatch: expected ${expectedVersion}, got ${manifest.version}`)
  }

  if (!Array.isArray(manifest.files)) {
    issues.push('manual-downloads.json files must be an array')
    return issues
  }

  const manualZip = manifest.files.find((file) => file && file.type === 'windows-x64-unpacked')
  if (!manualZip) {
    issues.push('manual-downloads.json is missing windows-x64-unpacked file')
    return issues
  }

  if (manualZip.url !== expectedZipUrl) {
    issues.push(`manual-downloads.json url mismatch: expected ${expectedZipUrl}, got ${manualZip.url}`)
  }

  const zipPath = path.join(distDir, manualZip.url || '')
  if (!fileExists(zipPath)) {
    issues.push(`manual download file target is missing: ${manualZip.url}`)
    return issues
  }

  if (typeof manualZip.sha512 === 'string') {
    const actualSha512 = sha512Base64(zipPath)
    if (actualSha512 !== manualZip.sha512) {
      issues.push(`manual-downloads.json sha512 mismatch for ${manualZip.url}: expected ${manualZip.sha512}, got ${actualSha512}`)
    }
  } else {
    issues.push(`manual-downloads.json is missing sha512 for ${manualZip.url}`)
  }

  if (typeof manualZip.size === 'number') {
    const actualSize = fs.statSync(zipPath).size
    if (actualSize !== manualZip.size) {
      issues.push(`manual-downloads.json size mismatch for ${manualZip.url}: expected ${manualZip.size}, got ${actualSize}`)
    }
  } else {
    issues.push(`manual-downloads.json is missing size for ${manualZip.url}`)
  }

  return issues
}

function collectUnexpectedManualDownloadArtifactIssues(distDir) {
  if (!fileExists(distDir)) {
    return []
  }

  const unexpectedArtifactPatterns = [
    {
      pattern: /^TOS_v.+_Portable\.exe$/i,
      message: 'unexpected portable release artifact',
    },
    {
      pattern: /^TOS_v.+_Windows_x64_unpacked\.zip$/i,
      message: 'unexpected unpacked zip release artifact',
    },
  ]
  const issues = []

  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }

    for (const artifactPattern of unexpectedArtifactPatterns) {
      if (artifactPattern.pattern.test(entry.name)) {
        issues.push(`${artifactPattern.message}: ${entry.name}`)
      }
    }
  }

  return issues
}

function collectStaleArtifactIssues(distDir, expectedVersion) {
  if (!fileExists(distDir)) {
    return []
  }

  const issues = []
  const artifactPatterns = [
    /^TOS Setup (.+)\.exe$/i,
    /^TOS Setup (.+)\.exe\.blockmap$/i,
  ]

  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue

    for (const pattern of artifactPatterns) {
      const match = entry.name.match(pattern)
      if (match && match[1] !== expectedVersion) {
        issues.push(`stale release artifact for another version: ${entry.name}`)
      }
    }
  }

  return issues
}

function collectPythonFiles(rootDir) {
  if (!fileExists(rootDir)) {
    return []
  }

  const results = []
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectPythonFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.py')) {
      results.push(fullPath)
    }
  }
  return results
}

function collectBackendPackageIssues(appOutDir, expectedVersion) {
  const issues = []
  const backendDir = path.join(appOutDir, 'resources', 'backend')
  const backendMainPath = path.join(backendDir, 'main.py')
  const runtimeExePath = path.join(
    appOutDir,
    'resources',
    'backend-runtime',
    'tos-backend',
    'tos-backend.exe',
  )

  if (fileExists(backendMainPath)) {
    const content = fs.readFileSync(backendMainPath, 'utf8')
    const versions = [...content.matchAll(/version\s*[:=]\s*["']([^"']+)["']/g)]
      .map((match) => match[1])

    if (versions.length === 0) {
      issues.push('resources/backend/main.py does not expose a backend version')
    }

    for (const version of versions) {
      if (version !== expectedVersion) {
        issues.push(`backend version mismatch: expected ${expectedVersion}, got ${version}`)
      }
    }
  }

  if (fileExists(runtimeExePath) && fileExists(backendDir)) {
    const backendFiles = collectPythonFiles(backendDir)
    const newestBackendFile = backendFiles
      .map((filePath) => fs.statSync(filePath).mtimeMs)
      .reduce((max, value) => Math.max(max, value), 0)
    const runtimeMtime = fs.statSync(runtimeExePath).mtimeMs

    // 发布包实际优先运行 backend-runtime；它必须不早于打进包的后端源码。
    if (newestBackendFile > 0 && runtimeMtime + 1000 < newestBackendFile) {
      issues.push('backend runtime is older than packaged backend source; rebuild backend-runtime before packaging')
    }
  }

  return issues
}

function collectReleasePackageIssues(options = {}) {
  const distDir = path.resolve(options.distDir || defaultDistDir)
  const appOutDir = path.resolve(options.appOutDir || defaultAppOutDir)
  const expectedVersion = options.expectedVersion || readExpectedVersion()
  const issues = []

  if (!fileExists(appOutDir)) {
    issues.push(`missing unpacked app directory: ${appOutDir}`)
  } else {
    issues.push(...collectMissingUnpackedResources(appOutDir))
    issues.push(...collectBackendPackageIssues(appOutDir, expectedVersion))
  }

  if (!options.skipArtifacts) {
    issues.push(...collectLatestYmlIssues(distDir, expectedVersion))
    issues.push(...collectTopLevelArtifactIssues(distDir, expectedVersion))
    issues.push(...collectManualDownloadIssues(distDir, expectedVersion))
    issues.push(...collectUnexpectedManualDownloadArtifactIssues(distDir))
    issues.push(...collectStaleArtifactIssues(distDir, expectedVersion))
  }

  return issues
}

function verifyReleasePackage(options = {}) {
  const issues = collectReleasePackageIssues(options)

  if (issues.length > 0) {
    throw new Error([
      'Release package verification failed:',
      ...issues.map((issue) => `  - ${issue}`),
    ].join('\n'))
  }
}

function parseCliArgs(argv) {
  const args = [...argv]
  const options = {}

  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--skip-artifacts') {
      options.skipArtifacts = true
      continue
    }
    if (arg === '--dist-dir') {
      options.distDir = args.shift()
      continue
    }
    if (arg === '--app-out-dir') {
      options.appOutDir = args.shift()
      continue
    }
    if (!options.appOutDir) {
      options.appOutDir = arg
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function main() {
  const options = parseCliArgs(process.argv.slice(2))
  verifyReleasePackage(options)
  console.log(`Release package verified: ${path.resolve(options.appOutDir || defaultAppOutDir)}`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  collectReleasePackageIssues,
  verifyReleasePackage,
  requiredUnpackedResources,
}
