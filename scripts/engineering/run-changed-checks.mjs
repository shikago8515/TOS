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
const electronQuickCommand = npmCommand('root:check:electron', '.', ['run', 'check:electron'])
const backendFullCommand = npmCommand('backend:full', '.', ['run', 'check:backend'])
const workflowConfigCommand = nodeCommand('engineering:gitea-workflow-config-test', '.', [
  '--test',
  'scripts/engineering/gitea-workflow-config.test.mjs',
])
const changedChecksCommand = nodeCommand('engineering:run-changed-checks-test', '.', [
  '--test',
  'scripts/engineering/run-changed-checks.test.mjs',
])
const semanticReleaseCommands = [
  nodeCommand('engineering:semantic-release-config-test', '.', [
    '--test',
    'scripts/engineering/semantic-release-config.test.mjs',
  ]),
  nodeCommand('engineering:semantic-release-tos-plugin-test', '.', [
    '--test',
    'scripts/engineering/semantic-release-tos-plugin.test.mjs',
  ]),
]
const serverPackageCommands = [
  npmCommand('server:package-test', '.', ['run', 'test:server-package']),
  npmCommand('server:package:dry-run', '.', ['run', 'server:package:dry-run']),
]
const serverPackageTestCommand = npmCommand('server:package-test', '.', ['run', 'test:server-package'])

export function planChangedChecks(inputFiles, options = {}) {
  const files = normalizeFiles(inputFiles)

  if (files.length === 0) {
    return {
      files,
      commands: [],
      reasons: ['No changed files were detected.'],
    }
  }

  const commands = []
  const reasons = []

  if (files.some(isDocumentationFile)) {
    commands.push(...diffCheckCommands(options.base ?? defaultBase))
    reasons.push('Documentation or rule files changed; run committed, staged, and working-tree whitespace checks.')
  }

  const specializedPlan = planSpecializedChecks(files)
  commands.push(...specializedPlan.commands)
  reasons.push(...specializedPlan.reasons)

  const remainingFiles = files.filter((file) => !isDocumentationFile(file) && !isSpecializedRiskFile(file))

  if (remainingFiles.length === 0) {
    return {
      files,
      commands: dedupeCommands(commands),
      reasons,
    }
  }

  const highRiskFile = remainingFiles.find(isHighRiskFile)
  if (highRiskFile) {
    return {
      files,
      commands: dedupeCommands([...commands, rootQuickCommand]),
      reasons: [
        ...reasons,
        `High-risk project file changed and no narrower local gate is mapped: ${highRiskFile}.`,
      ],
    }
  }

  const hasFrontend = remainingFiles.some(isFrontendFile)
  const hasBackend = remainingFiles.some(isBackendFile)

  if (hasFrontend && hasBackend) {
    if (hasContractSensitiveChange(remainingFiles)) {
      return {
        files,
        commands: dedupeCommands([...commands, rootQuickCommand]),
        reasons: [
          ...reasons,
          'Frontend and backend API contract files changed together; use the project quick gate.',
        ],
      }
    }

    const backendPlan = planBackendChecks(remainingFiles, options)
    return {
      files,
      commands: dedupeCommands([...commands, ...frontendQuickCommands, ...backendPlan.commands]),
      reasons: [
        ...reasons,
        'Frontend and backend changed together, but no shared contract boundary changed; run targeted frontend and backend checks.',
        ...backendPlan.reasons,
      ],
    }
  }

  if (hasFrontend) {
    return {
      files,
      commands: dedupeCommands([...commands, ...frontendQuickCommands]),
      reasons: [...reasons, 'Frontend-only changes detected; run frontend lint, typecheck, and tests.'],
    }
  }

  if (hasBackend) {
    const backendPlan = planBackendChecks(remainingFiles, options)
    return {
      files,
      commands: dedupeCommands([...commands, ...backendPlan.commands]),
      reasons: [...reasons, ...backendPlan.reasons],
    }
  }

  return {
    files,
    commands: dedupeCommands([...commands, rootQuickCommand]),
    reasons: [...reasons, 'Changed files do not match a low-risk bucket; use the project quick gate.'],
  }
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

function diffCheckCommands(base) {
  return [
    gitCommand('git:diff-check:committed', ['diff', '--check', `${base}...HEAD`]),
    gitCommand('git:diff-check:staged', ['diff', '--cached', '--check']),
    gitCommand('git:diff-check:working-tree', ['diff', '--check']),
  ]
}

function planSpecializedChecks(files) {
  const commands = []
  const reasons = []

  for (const file of files) {
    const plan = specializedRiskPlanForFile(file)
    if (!plan) {
      continue
    }

    commands.push(...plan.commands)
    reasons.push(plan.reason)
  }

  return {
    commands: dedupeCommands(commands),
    reasons,
  }
}

function isSpecializedRiskFile(file) {
  return specializedRiskPlanForFile(file) !== null
}

function specializedRiskPlanForFile(file) {
  const normalized = normalizePath(file)

  if (normalized === '.gitea/workflows/tos-check.yml'
    || normalized === 'scripts/engineering/gitea-workflow-config.test.mjs') {
    return {
      commands: [workflowConfigCommand],
      reason: `Gitea workflow file changed: ${normalized}.`,
    }
  }

  if (normalized === 'scripts/engineering/run-changed-checks.mjs'
    || normalized === 'scripts/engineering/run-changed-checks.test.mjs') {
    return {
      commands: [changedChecksCommand],
      reason: `Changed-check planner file changed: ${normalized}.`,
    }
  }

  if (normalized === 'scripts/engineering/package-server-update.mjs'
    || normalized.startsWith('scripts/server/')) {
    return {
      commands: serverPackageCommands,
      reason: `Server package or deploy script changed: ${normalized}.`,
    }
  }

  if (normalized === 'scripts/engineering/package-server-update.test.mjs') {
    return {
      commands: [serverPackageTestCommand],
      reason: `Server package test changed: ${normalized}.`,
    }
  }

  if (normalized === 'release.config.cjs'
    || normalized === 'scripts/engineering/semantic-release-config.test.mjs'
    || normalized === 'scripts/engineering/semantic-release-tos-plugin.mjs'
    || normalized === 'scripts/engineering/semantic-release-tos-plugin.test.mjs') {
    return {
      commands: semanticReleaseCommands,
      reason: `Semantic release file changed: ${normalized}.`,
    }
  }

  if (normalized.startsWith('tms-electron-app/scripts/')) {
    return {
      commands: [electronQuickCommand],
      reason: `Electron script file changed: ${normalized}.`,
    }
  }

  const engineeringTestPlan = engineeringScriptTestPlanForFile(normalized)
  if (engineeringTestPlan) {
    return engineeringTestPlan
  }

  return null
}

function engineeringScriptTestPlanForFile(normalized) {
  if (!normalized.startsWith('scripts/engineering/') || !/\.(mjs|js)$/.test(normalized)) {
    return null
  }

  if (/\.test\.(mjs|js)$/.test(normalized)) {
    return {
      commands: [nodeCommand(`engineering:${basename(normalized)}`, '.', ['--test', normalized])],
      reason: `Engineering script test changed: ${normalized}.`,
    }
  }

  const testPath = normalized.replace(/\.(mjs|js)$/, '.test.$1')
  if (!existsSync(resolve(repoRoot, testPath))) {
    return null
  }

  return {
    commands: [nodeCommand(`engineering:${basename(testPath)}`, '.', ['--test', testPath])],
    reason: `Engineering script has a focused test: ${normalized}.`,
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

function hasContractSensitiveChange(files) {
  return files.some(isFrontendContractFile) || files.some(isBackendContractFile)
}

function isFrontendContractFile(file) {
  const normalized = normalizePath(file)
  return normalized.startsWith('tms-frontend/src/shared/api/')
    || normalized.startsWith('tms-frontend/src/shared/process/')
}

function isBackendContractFile(file) {
  const normalized = normalizePath(file)
  return normalized.startsWith('tms-backend/api/')
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

function nodeCommand(id, cwd, args) {
  return {
    id,
    label: id,
    cwd,
    runner: 'node',
    args,
  }
}

function gitCommand(id, args) {
  return {
    id,
    label: id,
    cwd: '.',
    runner: 'git',
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

  if (command.runner === 'node') {
    return `${prefix}node ${command.args.join(' ')}`
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

  if (command.runner === 'node') {
    return {
      ...command,
      executable: process.execPath,
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
  const plan = planChangedChecks(files, { repoRoot, base: options.base })
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
