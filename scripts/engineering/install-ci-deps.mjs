import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmShell = process.platform === 'win32'
const pythonBin = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const optionalOcrRuntimePackageNames = new Set(['rapidocr', 'onnxruntime'])

await main()

async function main() {
  const temporaryPaths = []
  const backendRequirementsPath = await createBackendRequirementsPath({ temporaryPaths })
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
      backendRequirementsPath,
    ]),
  ]

  try {
    for (const step of installSteps) {
      await runCommand(step)
    }
  } finally {
    await Promise.all(temporaryPaths.map((targetPath) => rm(targetPath, { recursive: true, force: true })))
  }
}

async function createBackendRequirementsPath({ temporaryPaths }) {
  if (process.env.TOS_CI_SKIP_OPTIONAL_OCR_RUNTIME !== '1') {
    return 'requirements.txt'
  }

  const requirementsPath = resolve(repoRoot, 'tms-backend', 'requirements.txt')
  const requirementsText = await readFile(requirementsPath, 'utf8')
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'tos-ci-backend-requirements-'))
  const filteredRequirementsPath = resolve(temporaryRoot, 'requirements.txt')

  await writeFile(filteredRequirementsPath, filterOptionalOcrRuntimeRequirements(requirementsText))
  temporaryPaths.push(temporaryRoot)

  return filteredRequirementsPath
}

function filterOptionalOcrRuntimeRequirements(requirementsText) {
  const filteredLines = requirementsText
    .split(/\r?\n/)
    .filter((line) => !optionalOcrRuntimePackageNames.has(requirementName(line)))

  return `${filteredLines.join('\n').trimEnd()}\n`
}

function requirementName(line) {
  const requirement = line.split('#', 1)[0].trim()
  if (!requirement) {
    return ''
  }

  return requirement.split(/[<>=!~;\s]/, 1)[0].toLowerCase()
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
