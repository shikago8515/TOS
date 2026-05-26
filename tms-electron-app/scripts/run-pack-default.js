const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const electronDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(electronDir, '..')
const frontendDir = path.join(repoDir, 'tms-frontend')
const frontendNodeModules = path.join(frontendDir, 'node_modules')
const automationSourceRoot = path.join(electronDir, 'automation-apps')
const backendRuntimeSourceRoot = path.join(electronDir, 'backend-runtime')
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
  'playwright-console/node_modules/express/lib/express.js',
  'playwright-console/node_modules/get-intrinsic/index.js',
  'playwright-console/node_modules/hasown/index.js',
  'playwright-console/node_modules/merge-descriptors/index.js',
  'playwright-console/node_modules/send/index.js',
  'playwright-console/node_modules/statuses/index.js',
  'playwright-console/node_modules/playwright/package.json',
]

const requiredBackendRuntimeResources = [
  'tos-backend/tos-backend.exe',
  'tos-backend/_internal/base_library.zip',
  'tos-backend/_internal/python313.dll',
  'tos-backend/_internal/_socket.pyd',
  'tos-backend/_internal/_ssl.pyd',
  'tos-backend/_internal/_asyncio.pyd',
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

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function removeDirectoryWithRetry(targetDir, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === attempts) {
        throw error
      }
      // Windows 偶尔会延迟释放刚打包出来的资源目录，短暂重试能避免半同步状态。
      sleepSync(500)
    }
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

function copyDirectoryFilteredWithRobocopy(sourceDir, targetDir) {
  if (process.platform !== 'win32') {
    return false
  }

  fs.mkdirSync(targetDir, { recursive: true })

  const result = spawnSync('robocopy.exe', [
    sourceDir,
    targetDir,
    '/E',
    '/R:2',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP',
    '/XD',
    'uploads',
    'runs',
    'playwright-user-data',
    '/XF',
    '*.log',
    '*.xlsx',
  ], {
    shell: false,
    encoding: 'utf8',
  })

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      return false
    }
    throw result.error
  }

  if (result.status > 7) {
    throw new Error([
      `robocopy failed with exit code ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'))
  }

  return true
}

function copyDirectoryFiltered(sourceDir, targetDir, rootDir = sourceDir) {
  if (rootDir === sourceDir && copyDirectoryFilteredWithRobocopy(sourceDir, targetDir)) {
    return
  }

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

function findIncompleteFilteredFiles(sourceDir, targetDir, rootDir = sourceDir, incomplete = []) {
  if (!fs.existsSync(sourceDir)) {
    return incomplete
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    const relativePath = path.relative(rootDir, sourcePath)

    if (shouldSkipRuntimeResource(relativePath, entry.isDirectory())) {
      continue
    }

    if (entry.isDirectory()) {
      findIncompleteFilteredFiles(sourcePath, targetPath, rootDir, incomplete)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (!fs.existsSync(targetPath)) {
      incomplete.push(relativePath)
      continue
    }

    if (fs.statSync(sourcePath).size !== fs.statSync(targetPath).size) {
      incomplete.push(relativePath)
    }
  }

  return incomplete
}

function assertFilteredDirectoryComplete(sourceRoot, targetRoot, label) {
  const incomplete = findIncompleteFilteredFiles(sourceRoot, targetRoot)

  if (incomplete.length === 0) {
    return
  }

  const preview = incomplete.slice(0, 20).map((relativePath) => `  - ${relativePath}`).join('\n')
  const suffix = incomplete.length > 20 ? `\n  ... and ${incomplete.length - 20} more` : ''
  throw new Error(`${label} copy is incomplete; missing or mismatched ${incomplete.length} file(s):\n${preview}${suffix}`)
}

function syncDirectoryFiltered(sourceRoot, targetRoot, label, attempts = 4) {
  removeDirectoryWithRetry(targetRoot)

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    copyDirectoryFiltered(sourceRoot, targetRoot)

    const incomplete = findIncompleteFilteredFiles(sourceRoot, targetRoot)
    if (incomplete.length === 0) {
      return
    }

    if (attempt < attempts) {
      // 刚生成的大目录在 Windows 上偶尔前几轮复制会漏少量文件，等待后补跑再严格校验。
      sleepSync(750)
    }
  }

  assertFilteredDirectoryComplete(sourceRoot, targetRoot, label)
}

function getAutomationTargetRoot(targetUnpackedDir) {
  return path.join(targetUnpackedDir, 'resources', 'automation-apps')
}

function syncAutomationApps(targetUnpackedDir = unpackedDir) {
  requireFile(path.join(automationSourceRoot, 'registry.json'), 'automation app registry')

  const targetRoot = getAutomationTargetRoot(targetUnpackedDir)
  syncDirectoryFiltered(automationSourceRoot, targetRoot, 'automation apps')
}

function verifyAutomationApps(targetUnpackedDir = unpackedDir) {
  const targetRoot = getAutomationTargetRoot(targetUnpackedDir)

  for (const relativePath of requiredAutomationResources) {
    requireFile(path.join(targetRoot, relativePath), `automation resource ${relativePath}`)
  }

  assertFilteredDirectoryComplete(automationSourceRoot, targetRoot, 'automation apps')
}

function getBackendRuntimeTargetRoot(targetUnpackedDir) {
  return path.join(targetUnpackedDir, 'resources', 'backend-runtime')
}

function syncBackendRuntime(targetUnpackedDir = unpackedDir) {
  requireFile(
    path.join(backendRuntimeSourceRoot, 'tos-backend', 'tos-backend.exe'),
    'backend runtime executable',
  )

  const targetRoot = getBackendRuntimeTargetRoot(targetUnpackedDir)
  syncDirectoryFiltered(backendRuntimeSourceRoot, targetRoot, 'backend runtime')
}

function verifyBackendRuntime(targetUnpackedDir = unpackedDir) {
  const targetRoot = getBackendRuntimeTargetRoot(targetUnpackedDir)

  for (const relativePath of requiredBackendRuntimeResources) {
    requireFile(path.join(targetRoot, relativePath), `backend runtime resource ${relativePath}`)
  }

  assertFilteredDirectoryComplete(backendRuntimeSourceRoot, targetRoot, 'backend runtime')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.unref()
    server.once('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function httpGet(url, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body)
          return
        }

        reject(new Error(`HTTP ${response.statusCode}: ${body}`))
      })
    })

    request.on('timeout', () => {
      request.destroy(new Error('request timeout'))
    })
    request.on('error', reject)
  })
}

function appendProcessOutput(current, chunk) {
  const next = current + chunk.toString()
  return next.length > 8000 ? next.slice(-8000) : next
}

function spawnHealthProcess(filePath, args, options) {
  const child = spawn(filePath, args, {
    ...options,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const state = {
    child,
    error: null,
    stdout: '',
    stderr: '',
  }

  child.once('error', (error) => {
    state.error = error
  })
  child.stdout.on('data', (chunk) => {
    state.stdout = appendProcessOutput(state.stdout, chunk)
  })
  child.stderr.on('data', (chunk) => {
    state.stderr = appendProcessOutput(state.stderr, chunk)
  })

  return state
}

function formatHealthProcessFailure(label, state, lastError) {
  const parts = [`${label} did not become healthy`]

  if (state.error) {
    parts.push(`spawn error: ${state.error.message}`)
  }
  if (state.child.exitCode !== null) {
    parts.push(`exit code: ${state.child.exitCode}`)
  }
  if (lastError) {
    parts.push(`last health error: ${lastError.message}`)
  }
  if (state.stdout.trim()) {
    parts.push(`stdout:\n${state.stdout.trim()}`)
  }
  if (state.stderr.trim()) {
    parts.push(`stderr:\n${state.stderr.trim()}`)
  }

  return parts.join('\n')
}

async function waitForHealth(url, state, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    if (state.error || state.child.exitCode !== null) {
      throw new Error(formatHealthProcessFailure(label, state, lastError))
    }

    try {
      return await httpGet(url)
    } catch (error) {
      lastError = error
      await sleep(500)
    }
  }

  throw new Error(formatHealthProcessFailure(label, state, lastError))
}

function stopHealthProcess(state) {
  if (state?.child && state.child.exitCode === null && !state.child.killed) {
    state.child.kill()
  }
}

async function verifyBackendRuntimeHealth(targetUnpackedDir = unpackedDir) {
  const runtimeRoot = getBackendRuntimeTargetRoot(targetUnpackedDir)
  const runtimeExe = path.join(runtimeRoot, 'tos-backend', 'tos-backend.exe')
  requireFile(runtimeExe, 'backend runtime executable')

  const port = await findFreePort()
  const state = spawnHealthProcess(runtimeExe, [], {
    cwd: path.dirname(runtimeExe),
    env: {
      ...process.env,
      TOS_BACKEND_HOST: '127.0.0.1',
      TOS_BACKEND_PORT: String(port),
    },
  })

  try {
    await waitForHealth(`http://127.0.0.1:${port}/health`, state, 'backend runtime health')
  } finally {
    stopHealthProcess(state)
  }
}

async function verifyAutomationConsoleHealth(targetUnpackedDir = unpackedDir) {
  const appExe = path.join(targetUnpackedDir, 'TOS.exe')
  const consoleRoot = path.join(getAutomationTargetRoot(targetUnpackedDir), 'playwright-console')
  const startScript = path.join(consoleRoot, 'bin', 'start.js')
  const dataDir = path.join(consoleRoot, `.verify-data-${process.pid}-${Date.now()}`)

  requireFile(appExe, 'packed TOS executable')
  requireFile(startScript, 'playwright console start script')

  const port = await findFreePort()
  const state = spawnHealthProcess(appExe, [startScript], {
    cwd: consoleRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      TMS_PLAYWRIGHT_HOST: '127.0.0.1',
      TMS_PLAYWRIGHT_PORT: String(port),
      TMS_PLAYWRIGHT_DATA_DIR: dataDir,
    },
  })

  try {
    await waitForHealth(`http://127.0.0.1:${port}/api/health`, state, 'playwright console health')
  } finally {
    stopHealthProcess(state)
    removeDirectoryWithRetry(dataDir)
  }
}

async function verifyPackedRuntimeHealth(targetUnpackedDir = unpackedDir) {
  await verifyBackendRuntimeHealth(targetUnpackedDir)
  console.log('Verified packed backend runtime health.')
  await verifyAutomationConsoleHealth(targetUnpackedDir)
  console.log('Verified packed automation console health.')
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
  syncBackendRuntime(unpackedDir)
  verifyBackendRuntime(unpackedDir)
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
  await verifyPackedRuntimeHealth(unpackedDir)
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
  syncBackendRuntime,
  verifyBackendRuntime,
  verifyPackedRuntimeHealth,
}
