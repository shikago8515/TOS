const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(electronDir, '..')
const frontendDir = path.join(repoDir, 'tms-frontend')
const frontendNodeModules = path.join(frontendDir, 'node_modules')
const outputDirName = 'dist-source-frontend'
const outputDir = path.join(electronDir, outputDirName)
const markerPath = path.join(outputDir, '.pack-source-start.json')
const unpackedDir = path.join(outputDir, 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')
const startedAt = Date.now()

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

function runViteBuild() {
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

function runElectronBuilder() {
  const source = [
    "const fs = require('fs')",
    "const { build } = require('electron-builder')",
    'const options = {',
    '  projectDir: process.cwd(),',
    '  dir: true,',
    "  publish: 'never',",
    `  config: { directories: { output: ${JSON.stringify(outputDirName)} } },`,
    '}',
    `const appAsar = ${JSON.stringify(appAsar)}`,
    `const productExe = ${JSON.stringify(productExe)}`,
    `const electronExe = ${JSON.stringify(electronExe)}`,
    'function hasGeneratedUnpackedApp() {',
    '  return fs.existsSync(appAsar) && (fs.existsSync(productExe) || fs.existsSync(electronExe))',
    '}',
    'build(options).then(() => {',
    '  process.exitCode = 0',
    '}).catch((error) => {',
    '  console.error(error)',
    '  process.exit(hasGeneratedUnpackedApp() ? 0 : 1)',
    '})',
  ].join('\n')

  return spawnSync(process.execPath, ['-e', source], {
    cwd: electronDir,
    shell: false,
    stdio: 'inherit',
    env: nodeEnv(),
  })
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function hasGeneratedUnpackedApp() {
  if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
    return false
  }

  return fs.statSync(appAsar).mtimeMs >= startedAt - 5000
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function waitForGeneratedUnpackedApp(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (hasGeneratedUnpackedApp()) return true
    sleepSync(250)
  }

  return hasGeneratedUnpackedApp()
}

function finalizeUnpackedApp() {
  if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, productExe)
  }

  if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
    throw new Error(`Packed app is incomplete: ${unpackedDir}`)
  }
}

requireFile(path.join(frontendNodeModules, 'vue-tsc', 'index.js'), 'vue-tsc')
requireFile(path.join(frontendNodeModules, 'vite', 'dist', 'node', 'index.js'), 'vite')

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(markerPath, JSON.stringify({ startedAt }), 'utf8')

  console.log('[1/4] Type-check rebuilt frontend')
  runNodeEval(
    "require('vue-tsc').run()",
    ['--noEmit', '--pretty', 'false'],
    frontendDir,
  )

  console.log('[2/4] Build rebuilt frontend')
  runViteBuild()

  console.log('[3/4] Copy rebuilt frontend into Electron staging')
  process.env.TOS_FRONTEND_SOURCE = 'source'
  require('./copy-frontend')

  console.log('[4/4] Pack independent win-unpacked test app')
  const result = runElectronBuilder()
  if (result.status !== 0) {
    if (!waitForGeneratedUnpackedApp()) {
      process.exit(result.status || 1)
    }
    console.warn('electron-builder returned a non-zero code after producing win-unpacked; kept the generated app.')
  }

  finalizeUnpackedApp()
  console.log(`Packed source-frontend test app: ${productExe}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
