import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { validateAppVersion } from './sync-version.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultBackendUrl = '/tos'
const packageKind = 'tos-server-update'

const deployablePaths = [
  'app-version.json',
  'tms-backend/app_version.py',
  'tms-backend/main.py',
  'tms-backend/backend_launcher.py',
  'tms-backend/requirements.txt',
  'tms-backend/api',
  'tms-backend/data',
  'tms-backend/modules',
  'tms-backend/templates',
  'tms-backend/utils',
  'tms-frontend/index.html',
  'tms-frontend/package.json',
  'tms-frontend/package-lock.json',
  'tms-frontend/tsconfig.json',
  'tms-frontend/tsconfig.node.json',
  'tms-frontend/vite.config.ts',
  'tms-frontend/src',
  'tms-frontend/dist',
]

export function buildArchiveName({ version, stamp, gitShortSha }) {
  return `tos-server-update-v${validateAppVersion(version)}-${stamp}-${gitShortSha}.tar.gz`
}

export async function validateReleaseMetadata(repoRoot = defaultRepoRoot) {
  const appVersion = await readJson(resolve(repoRoot, 'app-version.json'))
  const releaseNotes = await readJson(
    resolve(repoRoot, 'tms-frontend', 'src', 'shared', 'version', 'releaseNotes.json'),
  )
  const version = validateAppVersion(appVersion.version)

  if (releaseNotes.version !== version) {
    throw new Error(
      `releaseNotes.json version mismatch: expected ${version}, got ${releaseNotes.version}`,
    )
  }

  if (!hasReleaseNotesContent(releaseNotes)) {
    throw new Error('releaseNotes.json must contain at least one added, improved, or fixed item')
  }

  return { version, releaseNotes }
}

export async function createServerPackage({
  repoRoot = defaultRepoRoot,
  outputRoot,
  dryRun = false,
  allowDirty = false,
  skipBuild = false,
  backendUrl = defaultBackendUrl,
  gitInfo,
  now = new Date(),
} = {}) {
  const root = resolve(repoRoot)
  const releaseMetadata = await validateReleaseMetadata(root)
  const resolvedGitInfo = gitInfo ?? await readGitInfo(root)
  const stamp = formatShanghaiTimestamp(now)
  const archiveName = buildArchiveName({
    version: releaseMetadata.version,
    stamp,
    gitShortSha: resolvedGitInfo.shortSha,
  })
  const resolvedOutputRoot = outputRoot
    ? resolve(outputRoot)
    : resolve(root, 'release', 'server')
  const archivePath = resolve(resolvedOutputRoot, archiveName)
  const packagePlan = {
    kind: packageKind,
    version: releaseMetadata.version,
    createdAt: now.toISOString(),
    gitRemote: resolvedGitInfo.remote,
    gitBranch: resolvedGitInfo.branch,
    gitCommit: resolvedGitInfo.commit,
    gitShortSha: resolvedGitInfo.shortSha,
    gitDirty: resolvedGitInfo.dirty,
    backendUrl,
    archiveName,
    releaseUpdateRecord: buildReleaseUpdateRecord({
      version: releaseMetadata.version,
      releaseNotes: releaseMetadata.releaseNotes,
      gitInfo: resolvedGitInfo,
      now,
    }),
    archivePath: dryRun ? null : archivePath,
    stagingRoot: null,
    includedPaths: [...deployablePaths],
  }

  if (dryRun) {
    return packagePlan
  }

  if (resolvedGitInfo.dirty && !allowDirty) {
    throw new Error('Cannot create a formal server package from a dirty worktree; use a clean worktree')
  }

  if (!skipBuild) {
    await runFrontendBuild(root, backendUrl)
  }

  await assertDeployablePathsExist(root)
  await mkdir(resolvedOutputRoot, { recursive: true })

  const stagingRoot = await mkdtemp(join(tmpdir(), 'tos-server-update-'))
  await stageDeployableFiles({
    repoRoot: root,
    stagingRoot,
    manifest: toPortableManifest(packagePlan),
  })
  await runCommand('tar', [
    '-czf',
    archivePath,
    '-C',
    stagingRoot,
    'deploy',
    'app-version.json',
    'tms-backend',
    'tms-frontend',
  ])

  return {
    ...packagePlan,
    archivePath,
    stagingRoot,
  }
}

function toPortableManifest(packagePlan) {
  const {
    archivePath: _archivePath,
    stagingRoot: _stagingRoot,
    ...manifest
  } = packagePlan
  return manifest
}

async function stageDeployableFiles({ repoRoot, stagingRoot, manifest }) {
  for (const relativePath of deployablePaths) {
    await copyPath(repoRoot, stagingRoot, relativePath)
  }

  await copyPath(
    repoRoot,
    stagingRoot,
    'scripts/server/apply-server-update.sh',
    'deploy/apply-server-update.sh',
  )
  await writeJson(resolve(stagingRoot, 'deploy', 'manifest.json'), manifest)
}

async function copyPath(repoRoot, stagingRoot, sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const source = resolve(repoRoot, sourceRelativePath)
  const target = resolve(stagingRoot, targetRelativePath)
  await mkdir(dirname(target), { recursive: true })
  await cp(source, target, { recursive: true })
}

async function assertDeployablePathsExist(repoRoot) {
  for (const relativePath of deployablePaths) {
    await assertPathExists(resolve(repoRoot, relativePath), relativePath)
  }
  await assertPathExists(
    resolve(repoRoot, 'scripts/server/apply-server-update.sh'),
    'scripts/server/apply-server-update.sh',
  )
}

async function assertPathExists(absolutePath, relativePath) {
  try {
    await stat(absolutePath)
  } catch (_error) {
    throw new Error(`Missing deployable path: ${relativePath}`)
  }
}

async function readGitInfo(repoRoot) {
  const [remote, branch, commit, shortSha, statusOutput, subject, author] = await Promise.all([
    readGitValue(repoRoot, ['remote', 'get-url', 'gitcode']).catch(() => ''),
    readGitValue(repoRoot, ['branch', '--show-current']),
    readGitValue(repoRoot, ['rev-parse', 'HEAD']),
    readGitValue(repoRoot, ['rev-parse', '--short', 'HEAD']),
    readGitValue(repoRoot, ['status', '--porcelain']),
    readGitValue(repoRoot, ['show', '-s', '--format=%s', 'HEAD']).catch(() => ''),
    readGitValue(repoRoot, ['show', '-s', '--format=%an', 'HEAD']).catch(() => ''),
  ])

  return {
    remote,
    branch,
    commit,
    shortSha,
    dirty: statusOutput.trim().length > 0,
    subject,
    author,
  }
}

async function readGitValue(repoRoot, args) {
  const result = await runCommand('git', args, { cwd: repoRoot, capture: true })
  return result.stdout.trim()
}

async function runFrontendBuild(repoRoot, backendUrl) {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  await runCommand(npmBin, ['--prefix', 'tms-frontend', 'run', 'build'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_BACKEND_URL: backendUrl,
    },
    shell: process.platform === 'win32',
  })
}

function runCommand(executable, args, options = {}) {
  const { cwd, env, shell = false, capture = false } = options

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      shell,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''

    if (capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }

    child.on('error', rejectRun)
    child.on('close', (code, signal) => {
      if (signal) {
        rejectRun(new Error(`${executable} ${args.join(' ')} stopped by signal ${signal}`))
        return
      }

      if (code !== 0) {
        const detail = stderr.trim() ? `: ${stderr.trim()}` : ''
        rejectRun(new Error(`${executable} ${args.join(' ')} exited with code ${code}${detail}`))
        return
      }

      resolveRun({ stdout, stderr })
    })
  })
}

function formatShanghaiTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`
}

function formatShanghaiDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function buildReleaseUpdateRecord({ version, releaseNotes, gitInfo, now }) {
  const subject = String(gitInfo.subject || '').trim()
  const title = subject || `Server deploy ${version}`
  const releaseDate = normalizeReleaseDate(releaseNotes.date) || formatShanghaiDate(now)

  return {
    recordKey: `git-${gitInfo.commit}`,
    version,
    releaseDate,
    category: 'improved',
    pageName: '服务器部署',
    pagePath: '/release-updates',
    title: title.slice(0, 255),
    description: subject
      ? buildReleaseUpdateDescription({ version, releaseNotes, gitInfo, subject })
      : `由服务器部署自动记录：${version} (${gitInfo.shortSha})。`,
    createdBy: `git:${String(gitInfo.author || 'deploy').trim() || 'deploy'}`,
  }
}

function normalizeReleaseDate(value) {
  const date = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}

function buildReleaseUpdateDescription({ version, releaseNotes, gitInfo, subject }) {
  const notes = summarizeReleaseNotes(releaseNotes)
  const noteText = notes ? `更新内容：${notes}` : `版本：${version}`
  return `由服务器部署自动记录：${subject}。${noteText}。Commit: ${gitInfo.shortSha}。`
}

function summarizeReleaseNotes(releaseNotes) {
  const moduleNotes = Array.isArray(releaseNotes.modules)
    ? releaseNotes.modules
      .flatMap((module) => summarizeReleaseNoteModule(module))
      .filter(Boolean)
    : []

  if (moduleNotes.length > 0) {
    return moduleNotes.slice(0, 3).join('；')
  }

  return ['added', 'improved', 'fixed']
    .flatMap((key) => {
      const items = releaseNotes[key]
      return Array.isArray(items) ? items : []
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('；')
}

function hasReleaseNotesContent(releaseNotes) {
  const legacyHasContent = ['added', 'improved', 'fixed'].some((key) => {
    const items = releaseNotes[key]
    return hasStringItems(items)
  })
  const modulesHasContent = Array.isArray(releaseNotes.modules)
    && releaseNotes.modules.some((module) => {
      return hasStringItems(module?.added)
        || hasStringItems(module?.improved)
        || hasStringItems(module?.fixed)
    })

  return legacyHasContent || modulesHasContent
}

function summarizeReleaseNoteModule(module) {
  const name = String(module?.name || '').trim()
  if (!name) {
    return []
  }

  return [
    ...summarizeReleaseNoteItems(module.added, name, '新增'),
    ...summarizeReleaseNoteItems(module.improved, name, '优化'),
    ...summarizeReleaseNoteItems(module.fixed, name, '修复'),
  ]
}

function summarizeReleaseNoteItems(items, moduleName, category) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => `${moduleName}：${category}：${item}`)
}

function hasStringItems(items) {
  return Array.isArray(items) && items.some((item) => typeof item === 'string' && item.trim())
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function writeJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function readCliOptions(argv) {
  const options = {
    dryRun: false,
    allowDirty: false,
    skipBuild: false,
  }

  for (const option of argv.slice(2)) {
    if (option === '--dry-run') {
      options.dryRun = true
    } else if (option === '--allow-dirty') {
      options.allowDirty = true
    } else if (option === '--skip-build') {
      options.skipBuild = true
    } else {
      throw new Error(`Unknown option "${option}"`)
    }
  }

  return options
}

async function main() {
  const options = readCliOptions(process.argv)
  const result = await createServerPackage(options)

  if (options.dryRun) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`Server update package: ${result.archivePath}`)
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
