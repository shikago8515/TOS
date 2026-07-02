import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const repoRoot = resolve(scriptDir, '..', '..')
const defaultBase = 'gitea/main'

const frontendQuickCommands = [
  npmCommand('frontend:lint', 'tms-frontend', ['run', 'lint']),
  npmCommand('frontend:typecheck', 'tms-frontend', ['run', 'typecheck']),
  npmCommand('frontend:test', 'tms-frontend', ['run', 'test']),
]

const rootQuickCommand = npmCommand('root:check:quick', '.', ['run', 'check:quick'])
const backendFullCommand = npmCommand('backend:full', '.', ['run', 'check:backend'])
const diffCheckCommand = {
  id: 'git:diff-check',
  label: 'git:diff-check',
  cwd: '.',
  runner: 'git',
  args: ['diff', '--check'],
}

export function planChangedChecks(inputFiles, options = {}) {
  const files = normalizeFiles(inputFiles)

  if (files.length === 0) {
    return {
      files,
      commands: [],
      reasons: ['No changed files were detected.'],
    }
  }

  if (files.every(isDocumentationFile)) {
    return {
      files,
      commands: [diffCheckCommand],
      reasons: ['Only documentation changes were detected; whitespace checks are enough.'],
    }
  }

  const highRiskFile = files.find(isHighRiskFile)
  if (highRiskFile) {
    return quickPlan(files, `High-risk project file changed: ${highRiskFile}.`)
  }

  const hasFrontend = files.some(isFrontendFile)
  const hasBackend = files.some(isBackendFile)

  if (hasFrontend && hasBackend) {
    return quickPlan(files, 'Frontend and backend changed together; treat this as a contract-sensitive change.')
  }

  if (hasFrontend) {
    return {
      files,
      commands: frontendQuickCommands,
      reasons: ['Frontend-only changes detected; run frontend lint, typecheck, and tests.'],
    }
  }

  if (hasBackend) {
    return planBackendChecks(files, options)
  }

  return quickPlan(files, 'Changed files do not match a low-risk bucket; use the project quick gate.')
}

export function collectChangedFiles(base = defaultBase) {
  const committed = gitLines(['diff', '--name-only', `${base}...HEAD`])
  const workingTree = gitLines(['diff', '--name-only'])
  const staged = gitLines(['diff', '--cached', '--name-only'])
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard'])

  return normalizeFiles([
    ...committed,
    ...workingTree,
    ...staged,
    ...untracked,
  ])
}

function planBackendChecks(files, options) {
  const backendFiles = files.filter(isBackendFile)
  const backendTestCommands = []
  const reasons = []

  for (const file of backendFiles) {
    const testModule = backendTestModuleForFile(file)

    if (!testModule) {
      return {
        files,
        commands: [backendFullCommand],
        reasons: [`Backend file cannot be mapped to one focused unittest: ${file}.`],
      }
    }

    if (options.repoRoot && !backendTestExists(options.repoRoot, testModule)) {
      return {
        files,
        commands: [backendFullCommand],
        reasons: [`Mapped backend unittest does not exist for ${file}; use the backend full check.`],
      }
    }

    backendTestCommands.push(pythonCommand(
      `backend:test:${testModule}`,
      'tms-backend',
      ['-m', 'unittest', testModule, '-v'],
    ))
    reasons.push(`Backend file ${file} maps to ${testModule}.`)
  }

  return {
    files,
    commands: dedupeCommands(backendTestCommands),
    reasons,
  }
}

function backendTestModuleForFile(file) {
  const normalized = normalizePath(file)
  const backendPrefix = 'tms-backend/'

  if (!normalized.startsWith(backendPrefix)) {
    return null
  }

  const relative = normalized.slice(backendPrefix.length)

  if (/^tests\/test_[^/]+\.py$/.test(relative)) {
    return `tests.${basename(relative, '.py')}`
  }

  if (/^modules\/[^/]+\.py$/.test(relative)) {
    return `tests.test_${basename(relative, '.py')}`
  }

  const apiMatch = relative.match(/^api\/([^/]+)_api\.py$/)
  if (apiMatch) {
    return `tests.test_${apiMatch[1]}_module`
  }

  return null
}

function backendTestExists(root, testModule) {
  const relativePath = testModule.replaceAll('.', sep) + '.py'
  return existsSync(resolve(root, 'tms-backend', relativePath))
}

function quickPlan(files, reason) {
  return {
    files,
    commands: [rootQuickCommand],
    reasons: [reason],
  }
}

function isDocumentationFile(file) {
  const normalized = normalizePath(file)
  return normalized.endsWith('.md')
    || normalized.endsWith('.txt')
    || normalized.startsWith('docs/')
}

function isHighRiskFile(file) {
  const normalized = normalizePath(file)
  const fileName = basename(normalized)

  if (normalized === 'package.json'
    || normalized.endsWith('/package.json')
    || normalized.endsWith('/package-lock.json')
    || normalized.endsWith('/requirements.txt')) {
    return true
  }

  if (normalized.startsWith('.gitea/')
    || normalized.startsWith('.github/')
    || normalized.startsWith('scripts/engineering/')
    || normalized.startsWith('scripts/server/')
    || normalized.startsWith('tms-electron-app/')) {
    return true
  }

  if (normalized === 'app-version.json'
    || normalized === 'tms-backend/app_version.py'
    || fileName === 'releaseNotes.json'
    || fileName === 'releaseManifest.json'
    || fileName === 'releaseHistory.json') {
    return true
  }

  return false
}

function isFrontendFile(file) {
  const normalized = normalizePath(file)
  return normalized.startsWith('tms-frontend/')
}

function isBackendFile(file) {
  const normalized = normalizePath(file)
  return normalized.startsWith('tms-backend/')
}

function normalizeFiles(files) {
  return [...new Set(files
    .map(normalizePath)
    .filter(Boolean))]
    .sort()
}

function normalizePath(file) {
  return String(file ?? '').replaceAll('\\', '/').replace(/^\.\//, '').trim()
}

function dedupeCommands(commands) {
  const seen = new Set()
  const deduped = []

  for (const command of commands) {
    if (seen.has(command.id)) {
      continue
    }

    seen.add(command.id)
    deduped.push(command)
  }

  return deduped
}

function npmCommand(id, cwd, args) {
  return {
    id,
    label: id,
    cwd,
    runner: 'npm',
    args,
  }
}

function pythonCommand(id, cwd, args) {
  return {
    id,
    label: id,
    cwd,
    runner: 'python',
    args,
  }
}

function gitLines(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseArgs(args) {
  const options = {
    base: defaultBase,
    dryRun: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--base') {
      const base = args[index + 1]
      if (!base) {
        throw new Error('--base requires a ref value')
      }

      options.base = base
      index += 1
      continue
    }

    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length)
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log([
    'Usage: node scripts/engineering/run-changed-checks.mjs [--dry-run] [--base <ref>]',
    '',
    'Suggests or runs the smallest validation set for the current branch and working tree.',
    `Default base: ${defaultBase}`,
  ].join('\n'))
}

function printPlan(plan, base) {
  console.log(`Base ref: ${base}`)

  if (plan.files.length === 0) {
    console.log('Changed files: none')
  } else {
    console.log('Changed files:')
    for (const file of plan.files) {
      console.log(`- ${file}`)
    }
  }

  console.log('Reasons:')
  for (const reason of plan.reasons) {
    console.log(`- ${reason}`)
  }

  if (plan.commands.length === 0) {
    console.log('Recommended checks: none')
    return
  }

  console.log('Recommended checks:')
  for (const command of plan.commands) {
    console.log(`- ${formatCommand(command)}`)
  }
}

function formatCommand(command) {
  const prefix = command.cwd === '.' ? '' : `cd ${command.cwd} && `

  if (command.runner === 'npm') {
    return `${prefix}npm ${command.args.join(' ')}`
  }

  if (command.runner === 'python') {
    return `${prefix}${process.env.PYTHON ?? 'python'} ${command.args.join(' ')}`
  }

  if (command.runner === 'git') {
    return `${prefix}git ${command.args.join(' ')}`
  }

  return `${prefix}${command.args.join(' ')}`
}

function materializeCommand(command) {
  if (command.runner === 'npm') {
    const npm = createNpmCommand()
    return {
      ...command,
      executable: npm.executable,
      args: [...npm.args, ...command.args],
      shell: npm.shell,
    }
  }

  if (command.runner === 'python') {
    return {
      ...command,
      executable: process.env.PYTHON ?? 'python',
      shell: false,
    }
  }

  if (command.runner === 'git') {
    return {
      ...command,
      executable: 'git',
      shell: false,
    }
  }

  throw new Error(`Unknown command runner: ${command.runner}`)
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

function runCommand(command) {
  const materialized = materializeCommand(command)
  console.log(`\n[${command.label}] ${formatCommand(command)}`)

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(materialized.executable, materialized.args, {
      cwd: resolve(repoRoot, command.cwd),
      stdio: 'inherit',
      shell: materialized.shell,
    })

    child.on('error', rejectRun)
    child.on('close', (code, signal) => {
      if (signal) {
        rejectRun(new Error(`${command.label} stopped by signal ${signal}`))
        return
      }

      if (code !== 0) {
        rejectRun(new Error(`${command.label} exited with code ${code}`))
        return
      }

      resolveRun()
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const files = collectChangedFiles(options.base)
  const plan = planChangedChecks(files, { repoRoot })
  printPlan(plan, options.base)

  if (options.dryRun || plan.commands.length === 0) {
    return
  }

  for (const command of plan.commands) {
    await runCommand(command)
  }
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
