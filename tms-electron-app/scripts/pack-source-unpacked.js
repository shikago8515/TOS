const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(electronDir, '..')
const frontendDir = path.join(repoDir, 'tms-frontend')
const frontendNodeModules = path.join(frontendDir, 'node_modules')
const outputDirName = 'dist-source-frontend'
const unpackedDir = path.join(electronDir, outputDirName, 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

function nodeEnv() {
  return process.versions.electron
    ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    : { ...process.env }
}

function runNodeScript(scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    shell: false,
    stdio: 'inherit',
    env: nodeEnv(),
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
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

function runElectronBuilder(outputDir) {
  const source = [
    "const { build } = require('electron-builder')",
    'const options = {',
    '  projectDir: process.cwd(),',
    '  dir: true,',
    "  publish: 'never',",
    outputDir
      ? `  config: { directories: { output: ${JSON.stringify(outputDir)} } },`
      : '',
    '}',
    'build(options).catch((error) => {',
    '  console.error(error)',
    '  process.exit(1)',
    '})',
  ].filter(Boolean).join('\n')

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
  return fs.existsSync(appAsar) && (fs.existsSync(productExe) || fs.existsSync(electronExe))
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
requireFile(path.join(frontendNodeModules, 'vite', 'dist', 'node', 'cli.js'), 'vite')

async function main() {
  console.log('[1/4] Type-check rebuilt frontend')
  runNodeEval(
    "require('vue-tsc').run()",
    ['--noEmit', '--pretty', 'false'],
    frontendDir,
  )

  console.log('[2/4] Build rebuilt frontend')
  runNodeScript(
    path.join(frontendNodeModules, 'vite', 'dist', 'node', 'cli.js'),
    ['build', '--logLevel', 'error'],
    frontendDir,
  )

  console.log('[3/4] Copy rebuilt frontend into Electron staging')
  process.env.TOS_FRONTEND_SOURCE = 'source'
  require('./copy-frontend')

  console.log('[4/4] Pack independent win-unpacked test app')
  const result = runElectronBuilder(outputDirName)
  if (result.status !== 0) {
    if (!hasGeneratedUnpackedApp()) {
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
