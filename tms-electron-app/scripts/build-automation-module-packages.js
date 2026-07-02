const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronRoot = path.resolve(__dirname, '..')
const automationAppsRoot = path.join(electronRoot, 'automation-apps')
const outputRoot = path.join(electronRoot, 'dist-automation-modules')
const registryPath = path.join(automationAppsRoot, 'registry.json')
const frontendAutomationModelPath = path.join(
  electronRoot,
  '..',
  'tms-frontend',
  'src',
  'pages',
  'web-automation',
  'webAutomationModel.ts',
)
const rootPackage = JSON.parse(fs.readFileSync(path.join(electronRoot, 'package.json'), 'utf8'))
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const options = parseOptions(process.argv.slice(2))
const selectedAppIds = options.selectedAppIds
const defaultRequiredHelperVersion = '0.9.8-beta.3.32'
const moduleVersion = String(
  options.version
  || process.env.TOS_AUTOMATION_MODULE_VERSION
  || rootPackage.version
  || '',
).trim()
const requiredHelperVersionOverride = String(
  options.requiredHelperVersion
  || process.env.TOS_AUTOMATION_MODULE_REQUIRED_HELPER_VERSION
  || '',
).trim()
const zipCompressionLevel = normalizeZipCompressionLevel(
  options.compressionLevel
  || process.env.TOS_AUTOMATION_MODULE_COMPRESSION_LEVEL
  || '',
)

if (!Array.isArray(registry)) {
  throw new Error(`Automation registry must be an array: ${registryPath}`)
}

validateAutomationModuleCoverage()

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(outputRoot, { recursive: true })

const modules = {}
const packagedApps = registry.filter((app) => (
  app && app.id && (selectedAppIds.size === 0 || selectedAppIds.has(app.id))
))

for (const app of packagedApps) {
  const moduleInfo = buildAutomationModulePackage(app)
  modules[moduleInfo.id] = moduleInfo
}

const manifest = {
  kind: 'tos-automation-module-manifest',
  version: moduleVersion,
  updatedAt: new Date().toISOString(),
  modules,
}

fs.writeFileSync(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  moduleCount: Object.keys(modules).length,
  manifestPath: path.join(outputRoot, 'manifest.json'),
}, null, 2))

function buildAutomationModulePackage(app) {
  const appId = String(app.id || '').trim()
  const appDir = String(app.appDir || appId).trim()
  const version = String(options.version || process.env.TOS_AUTOMATION_MODULE_VERSION || app.version || rootPackage.version || '').trim()
  const sourceDir = path.join(automationAppsRoot, appDir)
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Automation app directory not found: ${sourceDir}`)
  }

  const filename = `${sanitizeSegment(appId)}.${sanitizeSegment(version || 'latest')}.zip`
  const objectKey = `automation-modules/${appId}/${filename}`
  const zipPath = path.join(outputRoot, filename)
  const stagingRoot = path.join(outputRoot, `.staging-${appId}`)

  fs.rmSync(stagingRoot, { recursive: true, force: true })
  fs.mkdirSync(stagingRoot, { recursive: true })
  copyFiltered(sourceDir, stagingRoot, {
    includeNodeModules: Boolean(app.includeNodeModules),
  })
  createZipFromDirectory(stagingRoot, zipPath)
  fs.rmSync(stagingRoot, { recursive: true, force: true })

  const stat = fs.statSync(zipPath)
  return {
    id: appId,
    name: String(app.name || appId),
    provider: String(app.provider || ''),
    category: String(app.category || 'Web Automation'),
    version,
    requiredHelperVersion: String(requiredHelperVersionOverride || app.requiredHelperVersion || defaultRequiredHelperVersion),
    description: String(app.description || ''),
    appDir,
    entry: String(app.entry || 'bin/start.js'),
    defaultPort: Number(app.defaultPort || app.port || 3100),
    filename,
    downloadPath: `/api/system/config/automation-modules/${encodeURIComponent(appId)}/download`,
    bucket: 'tos-downloads',
    objectKey,
    contentType: 'application/zip',
    fileSize: stat.size,
    sha256: sha256File(zipPath),
  }
}

function copyFiltered(sourceDir, targetDir, copyOptions = {}) {
  for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (shouldSkipItem(item.name, item.isDirectory(), copyOptions)) {
      continue
    }

    const sourcePath = path.join(sourceDir, item.name)
    const targetPath = path.join(targetDir, item.name)
    if (item.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true })
      copyFiltered(sourcePath, targetPath, copyOptions)
      continue
    }

    fs.copyFileSync(sourcePath, targetPath)
  }
}

function shouldSkipItem(name, isDirectory, copyOptions = {}) {
  const lowerName = String(name || '').toLowerCase()
  if (isDirectory) {
    if (lowerName === 'node_modules' && copyOptions.includeNodeModules) {
      return false
    }
    return [
      'node_modules',
      'uploads',
      'runs',
      'run-artifacts',
      'playwright-user-data',
      '__pycache__',
      '.git',
    ].includes(lowerName)
  }

  return (
    lowerName.endsWith('.log')
    || lowerName.endsWith('.xlsx')
    || lowerName.endsWith('.xls')
    || lowerName.endsWith('.csv')
    || lowerName.endsWith('.local.json')
    || lowerName.endsWith('.secret.local.json')
    || lowerName.endsWith('.stdout.json')
    || lowerName.endsWith('.stderr.json')
    || lowerName.startsWith('executor.secret')
    || lowerName.startsWith('temp-')
  )
}

function validateAutomationModuleCoverage() {
  const registryById = new Map()
  const registeredAppDirs = new Set()
  for (const app of registry) {
    const id = String(app?.id || '').trim()
    if (!id) {
      throw new Error(`Automation registry contains an entry without id: ${registryPath}`)
    }
    if (registryById.has(id)) {
      throw new Error(`Duplicate automation app id in registry: ${id}`)
    }
    registryById.set(id, app)
    registeredAppDirs.add(String(app.appDir || id).trim())
  }

  const executableDirs = fs.readdirSync(automationAppsRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .filter((dirName) => fs.existsSync(path.join(automationAppsRoot, dirName, 'bin', 'start.js')))
  const unregisteredDirs = executableDirs.filter((dirName) => !registeredAppDirs.has(dirName))
  if (unregisteredDirs.length > 0) {
    throw new Error(
      `Automation app directories with bin/start.js are missing from registry.json: ${unregisteredDirs.join(', ')}`,
    )
  }

  if (selectedAppIds.size > 0 || !fs.existsSync(frontendAutomationModelPath)) {
    return
  }

  const frontendEntries = readFrontendAutomationEntries(frontendAutomationModelPath)
  const missingOnlineAppIds = Array.from(new Set(
    frontendEntries
      .filter((entry) => entry.status === 'online')
      .map((entry) => entry.appId)
      .filter((appId) => appId && !registryById.has(appId)),
  ))
  if (missingOnlineAppIds.length > 0) {
    const details = frontendEntries
      .filter((entry) => entry.status === 'online' && missingOnlineAppIds.includes(entry.appId))
      .map((entry) => `${entry.id}->${entry.appId}`)
      .join(', ')
    throw new Error(
      `Online web automation entries are missing hot-update executor packages: ${details}. `
        + 'Add the executor to tms-electron-app/automation-apps/registry.json before publishing.',
    )
  }
}

function readFrontendAutomationEntries(modelPath) {
  const source = fs.readFileSync(modelPath, 'utf8')
  const entries = []
  const blockPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?appId:\s*'([^']+)'[\s\S]*?status:\s*'([^']+)'[\s\S]*?\}/g
  for (const match of source.matchAll(blockPattern)) {
    entries.push({
      id: match[1],
      appId: match[2],
      status: match[3],
    })
  }
  return entries
}

function createZipFromDirectory(sourceDir, zipPath) {
  fs.rmSync(zipPath, { force: true })

  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '& { param($sourceDir, $zipPath, $compressionLevel) $args = @{}; if ($compressionLevel) { $args.CompressionLevel = $compressionLevel }; Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $zipPath -Force @args }',
        sourceDir,
        zipPath,
        zipCompressionLevel,
      ],
      { encoding: 'utf8' },
    )
    if (result.status !== 0) {
      throw new Error(`Compress-Archive failed: ${result.stderr || result.stdout}`)
    }
    return
  }

  const result = spawnSync('zip', ['-qr', zipPath, '.'], {
    cwd: sourceDir,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`)
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function sanitizeSegment(value) {
  return String(value || 'module')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'module'
}

function parseOptions(args) {
  const selected = new Set()
  let version = ''
  let requiredHelperVersion = ''
  let compressionLevel = ''
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--app' && args[index + 1]) {
      selected.add(args[index + 1])
      index += 1
      continue
    }
    if (arg.startsWith('--app=')) {
      selected.add(arg.slice('--app='.length))
      continue
    }
    if (arg === '--version' && args[index + 1]) {
      version = args[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--version=')) {
      version = arg.slice('--version='.length)
      continue
    }
    if (arg === '--required-helper-version' && args[index + 1]) {
      requiredHelperVersion = args[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--required-helper-version=')) {
      requiredHelperVersion = arg.slice('--required-helper-version='.length)
      continue
    }
    if (arg === '--compression-level' && args[index + 1]) {
      compressionLevel = args[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--compression-level=')) {
      compressionLevel = arg.slice('--compression-level='.length)
    }
  }
  return {
    selectedAppIds: selected,
    version: String(version || '').trim(),
    requiredHelperVersion: String(requiredHelperVersion || '').trim(),
    compressionLevel: String(compressionLevel || '').trim(),
  }
}

function normalizeZipCompressionLevel(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  const validLevels = new Map([
    ['optimal', 'Optimal'],
    ['fastest', 'Fastest'],
    ['nocompression', 'NoCompression'],
    ['no-compression', 'NoCompression'],
    ['none', 'NoCompression'],
  ])
  const resolved = validLevels.get(normalized.toLowerCase())
  if (!resolved) {
    throw new Error(`Unsupported automation module zip compression level: ${normalized}`)
  }
  return resolved
}
