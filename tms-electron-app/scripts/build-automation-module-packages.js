const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronRoot = path.resolve(__dirname, '..')
const automationAppsRoot = path.join(electronRoot, 'automation-apps')
const outputRoot = path.join(electronRoot, 'dist-automation-modules')
const registryPath = path.join(automationAppsRoot, 'registry.json')
const rootPackage = JSON.parse(fs.readFileSync(path.join(electronRoot, 'package.json'), 'utf8'))
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const options = parseOptions(process.argv.slice(2))
const selectedAppIds = options.selectedAppIds
const moduleVersion = String(
  options.version
  || process.env.TOS_AUTOMATION_MODULE_VERSION
  || rootPackage.version
  || '',
).trim()

if (!Array.isArray(registry)) {
  throw new Error(`Automation registry must be an array: ${registryPath}`)
}

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
  copyFiltered(sourceDir, stagingRoot)
  createZipFromDirectory(stagingRoot, zipPath)
  fs.rmSync(stagingRoot, { recursive: true, force: true })

  const stat = fs.statSync(zipPath)
  return {
    id: appId,
    name: String(app.name || appId),
    provider: String(app.provider || ''),
    category: String(app.category || 'Web Automation'),
    version,
    requiredHelperVersion: String(app.requiredHelperVersion || rootPackage.version || ''),
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

function copyFiltered(sourceDir, targetDir) {
  for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (shouldSkipItem(item.name, item.isDirectory())) {
      continue
    }

    const sourcePath = path.join(sourceDir, item.name)
    const targetPath = path.join(targetDir, item.name)
    if (item.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true })
      copyFiltered(sourcePath, targetPath)
      continue
    }

    fs.copyFileSync(sourcePath, targetPath)
  }
}

function shouldSkipItem(name, isDirectory) {
  const lowerName = String(name || '').toLowerCase()
  if (isDirectory) {
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
        '& { param($sourceDir, $zipPath) Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $zipPath -Force }',
        sourceDir,
        zipPath,
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
    }
  }
  return {
    selectedAppIds: selected,
    version: String(version || '').trim(),
  }
}
