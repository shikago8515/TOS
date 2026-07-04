import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const mode = process.argv[2] ?? 'all'
const npmCommand = createNpmCommand()
const pythonBin = process.env.PYTHON ?? 'python'

const commandGroups = {
  version: [
    command('version:sync-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/sync-version.test.mjs',
    ]),
    command('semantic-release-config-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/semantic-release-config.test.mjs',
    ]),
    command('gitea-workflow-config-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/gitea-workflow-config.test.mjs',
    ]),
    command('semantic-release-tos-plugin-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/semantic-release-tos-plugin.test.mjs',
    ]),
    command('server:package-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/package-server-update.test.mjs',
    ]),
    command('backend-version-sentinel-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/check-backend-version.test.mjs',
    ]),
    command('frontend-dev-entrypoints-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/frontend-dev-entrypoints.test.mjs',
    ]),
    command('frontend-lint-gate-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/frontend-lint-gate.test.mjs',
    ]),
    command('run-changed-checks-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/run-changed-checks.test.mjs',
    ]),
    command('restart-local-backend-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/restart-local-backend.test.mjs',
    ]),
    command('frontend-direct-fetch-boundary-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/frontend-direct-fetch-boundary.test.mjs',
    ]),
    command('cleanup-local-artifacts-test', '.', process.execPath, [
      '--test',
      'scripts/engineering/cleanup-local-artifacts.test.mjs',
    ]),
    command('release-update-sync-test', '.', pythonBin, [
      'scripts/release_update_sync_test.py',
    ]),
    command('release-update-cache-check', '.', pythonBin, [
      'scripts/release_update_sync.py',
      '--check-local',
      '--quiet',
    ]),
  ],
  frontendFull: [
    command('frontend:lint', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'lint'], npmCommand.shell),
    command('frontend:typecheck', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'typecheck'], npmCommand.shell),
    command('frontend:test', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'test'], npmCommand.shell),
    command('frontend:build', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'build'], npmCommand.shell),
  ],
  frontendQuick: [
    command('frontend:lint', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'lint'], npmCommand.shell),
    command('frontend:typecheck', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'typecheck'], npmCommand.shell),
    command('frontend:test', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'test'], npmCommand.shell),
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

function createNpmCommand() {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      executable: process.execPath,
      args: [npmExecPath],
      shell: false,
    }
  }

  const bundledNpmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (existsSync(bundledNpmCli)) {
    return {
      executable: process.execPath,
      args: [bundledNpmCli],
      shell: false,
    }
  }

  return {
    executable: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: [],
    shell: process.platform === 'win32',
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
