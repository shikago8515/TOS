const fs = require('fs')
const path = require('path')

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

function collectMissingUnpackedResources(appOutDir) {
  return requiredUnpackedResources
    .filter((relativePath) => !fileExists(path.join(appOutDir, relativePath)))
    .map((relativePath) => `missing unpacked resource: ${normalizePackagePath(relativePath)}`)
}

function collectLatestYmlIssues(distDir, expectedVersion) {
  const issues = []
  const latestPath = path.join(distDir, 'latest.yml')

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
    const setupPath = path.join(distDir, latest.path)
    if (!fileExists(setupPath)) {
      issues.push(`latest.yml path target is missing: ${latest.path}`)
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
      }
    }
  }

  return issues
}

function collectTopLevelArtifactIssues(distDir, expectedVersion) {
  const issues = []
  const changelogPath = path.join(distDir, 'changelog.json')
  const portableName = `TOS_v${expectedVersion}_Portable.exe`

  if (!fileExists(path.join(distDir, portableName))) {
    issues.push(`missing release artifact: ${portableName}`)
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

function collectReleasePackageIssues(options = {}) {
  const distDir = path.resolve(options.distDir || defaultDistDir)
  const appOutDir = path.resolve(options.appOutDir || defaultAppOutDir)
  const expectedVersion = options.expectedVersion || readExpectedVersion()
  const issues = []

  if (!fileExists(appOutDir)) {
    issues.push(`missing unpacked app directory: ${appOutDir}`)
  } else {
    issues.push(...collectMissingUnpackedResources(appOutDir))
  }

  if (!options.skipArtifacts) {
    issues.push(...collectLatestYmlIssues(distDir, expectedVersion))
    issues.push(...collectTopLevelArtifactIssues(distDir, expectedVersion))
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
