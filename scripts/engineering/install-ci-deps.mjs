import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmShell = process.platform === 'win32'
const pythonBin = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

const installSteps = [
  command('root:npm-ci', '.', npmBin, ['ci'], npmShell),
  command('frontend:npm-ci', 'tms-frontend', npmBin, ['ci'], npmShell),
  command('electron:npm-ci', 'tms-electron-app', npmBin, ['ci'], npmShell),
  command(
    'playwright-console:npm-ci',
    'tms-electron-app/automation-apps/playwright-console',
    npmBin,
    ['ci'],
    npmShell,
  ),
  command('backend:pip-install', 'tms-backend', pythonBin, [
    '-m',
    'pip',
    'install',
    '-r',
    'requirements.txt',
  ]),
]

for (const step of installSteps) {
  await runCommand(step)
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

function runCommand({ label, cwd, executable, args, shell }) {
  console.log(`\n[${label}] ${executable} ${args.join(' ')}`)

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: 'inherit',
      shell,
      env: process.env,
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
