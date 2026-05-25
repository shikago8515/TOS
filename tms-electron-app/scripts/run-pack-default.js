const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(electronDir, '..')
const frontendDir = path.join(repoDir, 'tms-frontend')
const frontendNodeModules = path.join(frontendDir, 'node_modules')
const automationSourceRoot = path.join(electronDir, 'automation-apps')
const outputDir = path.join(electronDir, 'dist')
const markerPath = path.join(outputDir, '.pack-default-start.json')
const unpackedDir = path.join(outputDir, 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

const requiredAutomationResources = [
  'registry.json',
  'playwright-console/package.json',
  'playwright-console/bin/start.js',
  'playwright-console/config/default.config.json',
  'playwright-console/lib/server/index.js',
  'playwright-console/public/index.html',
  'playwright-console/public/app.js',
  'playwright-console/public/styles.css',
  'playwright-console/node_modules/express/package.json',
  'playwright-console/node_modules/playwright/package.json',
]

function nodeEnv() {
  const env = { ...process.env }

  for (const key of Object.keys(env)) {
    if (key.toLowerCase().startsWith('npm_')) {
      delete env[key]
    }
  }

  if (process.versions.electron) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }

  return env
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function shouldSkipRuntimeResource(relativePath, isDirectory) {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')

  if (parts.includes('uploads') || parts.includes('runs') || parts.includes('playwright-user-data')) {
    return true
  }

  if (isDirectory) {
    return false
  }

  return normalized.endsWith('.log') || normalized.endsWith('.xlsx')
}

function copyDirectoryFiltered(sourceDir, targetDir, rootDir = sourceDir) {
  fs.mkdirSync(targetDir, { recursive: true })

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    const relativePath = path.relative(rootDir, sourcePath)

    if (shouldSkipRuntimeResource(relativePath, entry.isDirectory())) {
      continue
    }

    if (entry.isDirectory()) {
      copyDirectoryFiltered(sourcePath, targetPath, rootDir)
      continue
    }

    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

function getAutomationTargetRoot(targetUnpackedDir) {
  return path.join(targetUnpackedDir, 'resources', 'automation-apps')
}

function syncAutomationApps(targetUnpackedDir = unpackedDir) {
  requireFile(path.join(automationSourceRoot, 'registry.json'), 'automation app registry')

  const targetRoot = getAutomationTargetRoot(targetUnpackedDir)
  fs.rmSync(targetRoot, { recursive: true, force: true })
  copyDirectoryFiltered(automationSourceRoot, targetRoot)
}

function verifyAutomationApps(targetUnpackedDir = unpackedDir) {
  const targetRoot = getAutomationTargetRoot(targetUnpackedDir)

  for (const relativePath of requiredAutomationResources) {
    requireFile(path.join(targetRoot, relativePath), `automation resource ${relativePath}`)
  }
}

function runNodeEval(source, args, cwd) {
  const result = spawnSync(process.execPath, ['-e', source, '--', ...args], {
    cwd,
    shell: false,
    stdio: 'inherit',
    env: nodeEnv(),
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function buildSourceFrontend() {
  requireFile(path.join(frontendNodeModules, 'vue-tsc', 'index.js'), 'vue-tsc')
  requireFile(path.join(frontendNodeModules, 'vite', 'dist', 'node', 'index.js'), 'vite')

  console.log('[1/2] Type-check rebuilt frontend')
  runNodeEval(
    "require('vue-tsc').run()",
    ['--noEmit', '--pretty', 'false'],
    frontendDir,
  )

  console.log('[2/2] Build rebuilt frontend')
  runNodeEval(
    [
      '(async () => {',
      "  const { build } = await import('vite')",
      "  await build({ logLevel: 'error' })",
      '})().catch((error) => {',
      '  console.error(error)',
      '  process.exit(1)',
      '})',
    ].join('\n'),
    [],
    frontendDir,
  )
}

function copySourceFrontend() {
  process.env.TOS_FRONTEND_SOURCE = 'source'
  delete require.cache[require.resolve('./copy-frontend')]
  require('./copy-frontend')
}

function runFrontendBuild() {
  buildSourceFrontend()
  copySourceFrontend()
}

function hasGeneratedUnpackedApp() {
  return fs.existsSync(appAsar) && (fs.existsSync(productExe) || fs.existsSync(electronExe))
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function waitForGeneratedUnpackedApp(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (hasGeneratedUnpackedApp()) return true
    sleepSync(250)
  }

  return hasGeneratedUnpackedApp()
}

function newestMtimeMs(targetPath) {
  if (!fs.existsSync(targetPath)) return 0

  const stat = fs.statSync(targetPath)
  let newest = stat.mtimeMs

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      newest = Math.max(newest, newestMtimeMs(path.join(targetPath, entry)))
    }
  }

  return newest
}

function waitForStableUnpackedApp(stableMs = 3000, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs
  let lastMtime = -1
  let lastChangedAt = Date.now()

  while (Date.now() < deadline) {
    const currentMtime = newestMtimeMs(unpackedDir)

    if (currentMtime > 0 && currentMtime === lastMtime && Date.now() - lastChangedAt >= stableMs) {
      return true
    }

    if (currentMtime !== lastMtime) {
      lastMtime = currentMtime
      lastChangedAt = Date.now()
    }

    sleepSync(500)
  }

  return false
}

function finalizeUnpackedApp() {
  if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, productExe)
  }

  if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
    throw new Error(`Packed app is incomplete: ${unpackedDir}`)
  }

  syncAutomationApps(unpackedDir)
  verifyAutomationApps(unpackedDir)
}

function runElectronBuilder() {
  const source = [
    "const { build } = require('electron-builder')",
    'build({',
    '  projectDir: process.cwd(),',
    '  dir: true,',
    "  publish: 'never',",
    '}).then(() => {',
    '  process.exit(0)',
    '}).catch((error) => {',
    '  console.error(error)',
    '  process.exit(1)',
    '})',
  ].join('\n')

  return spawnSync(process.execPath, ['-e', source], {
    cwd: electronDir,
    shell: false,
    stdio: 'inherit',
    env: nodeEnv(),
  })
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.rmSync(unpackedDir, { recursive: true, force: true })
  fs.writeFileSync(markerPath, JSON.stringify({ startedAt: Date.now() }), 'utf8')

  console.log('[1/3] Build rebuilt frontend')
  buildSourceFrontend()

  console.log('[2/3] Copy rebuilt frontend into Electron staging')
  copySourceFrontend()

  console.log('[3/3] Pack default win-unpacked app')

  const result = runElectronBuilder()
  const generated = waitForGeneratedUnpackedApp()

  if (result.status !== 0 && !generated) {
    process.exit(result.status || 1)
  }

  if (!generated) {
    throw new Error(`Packed app was not generated: ${unpackedDir}`)
  }

  if (!waitForStableUnpackedApp()) {
    throw new Error(`Packed app did not settle: ${unpackedDir}`)
  }

  if (result.status !== 0) {
    console.warn('electron-builder returned a non-zero code after producing win-unpacked; kept the generated app.')
  }

  finalizeUnpackedApp()
  console.log(`Packed default app: ${productExe}`)
}

if (require.main === module) {
  const frontendOnly = process.argv.includes('--frontend-only')
  const run = frontendOnly ? runFrontendBuild : main

  Promise.resolve(run()).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  buildSourceFrontend,
  copySourceFrontend,
  runFrontendBuild,
  syncAutomationApps,
  verifyAutomationApps,
}
