import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const mode = process.argv[2] ?? 'all'
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmShell = process.platform === 'win32'
const pythonBin = process.env.PYTHON ?? 'python'

const commandGroups = {
  version: [
    command('version:sync-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/sync-version.test.mjs',
    ]),
    command('server:package-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/package-server-update.test.mjs',
    ]),
  ],
  frontendFull: [
    command('frontend:typecheck', 'tms-frontend', npmBin, ['run', 'typecheck'], npmShell),
    command('frontend:test', 'tms-frontend', npmBin, ['run', 'test'], npmShell),
    command('frontend:build', 'tms-frontend', npmBin, ['run', 'build'], npmShell),
  ],
  frontendQuick: [
    command('frontend:typecheck', 'tms-frontend', npmBin, ['run', 'typecheck'], npmShell),
    command('frontend:test', 'tms-frontend', npmBin, ['run', 'test'], npmShell),
  ],
  backendFull: [
    command('backend:unittest', 'tms-backend', pythonBin, ['-m', 'unittest', 'discover', 'tests/', '-v']),
    command('backend:compileall', 'tms-backend', pythonBin, ['-m', 'compileall', '.']),
  ],
  backendQuick: [
    command('backend:unittest', 'tms-backend', pythonBin, ['-m', 'unittest', 'discover', 'tests/', '-v']),
  ],
  electron: [
    command('electron:scripts-test', 'tms-electron-app', process.execPath, [
      '--test',
      ...discoverElectronScriptTests(),
    ]),
  ],
}

const sequences = {
  all: [
    ...commandGroups.version,
    ...commandGroups.frontendFull,
    ...commandGroups.backendFull,
    ...commandGroups.electron,
  ],
  quick: [
    ...commandGroups.version,
    ...commandGroups.frontendQuick,
    ...commandGroups.backendQuick,
    ...commandGroups.electron,
  ],
  frontend: commandGroups.frontendFull,
  backend: commandGroups.backendFull,
  electron: commandGroups.electron,
}

if (!Object.hasOwn(sequences, mode)) {
  console.error(`Unknown check mode: ${mode}`)
  console.error(`Expected one of: ${Object.keys(sequences).join(', ')}`)
  process.exit(1)
}

for (const task of sequences[mode]) {
  await runCommand(task)
}

function command(label, cwd, executable, args, shell = false) {
  return {
    label,
    cwd: resolve(repoRoot, cwd),
    executable,
    args,
    shell,
  }
}

function discoverElectronScriptTests() {
  const scriptsDir = resolve(repoRoot, 'tms-electron-app', 'scripts')
  const tests = readdirSync(scriptsDir)
    .filter((entry) => entry.endsWith('.test.js'))
    .sort()
    .map((entry) => join('scripts', entry))

  if (tests.length === 0) {
    console.error('No Electron script tests found under tms-electron-app/scripts/*.test.js')
    process.exit(1)
  }

  return tests
}

function runCommand({ label, cwd, executable, args, shell }) {
  console.log(`\n[${label}] ${executable} ${args.join(' ')}`)

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: 'inherit',
      shell,
    })

    child.on('error', rejectRun)
    child.on('close', (code, signal) => {
      if (signal) {
        rejectRun(new Error(`${label} stopped by signal ${signal}`))
        return
      }

      if (code !== 0) {
        rejectRun(new Error(`${label} exited with code ${code}`))
        return
      }

      resolveRun()
    })
  }).catch((error) => {
    console.error(`\n${error.message}`)
    process.exit(1)
  })
}
