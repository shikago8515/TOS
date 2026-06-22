import { lstat, readdir, rm } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')

export const DEFAULT_ARTIFACT_TARGETS = [
  'tms-electron-app/dist',
  'tms-electron-app/dist-automation-helper',
  'tms-backend/build',
  'release',
  'tms-frontend/dist',
]

export const RUNTIME_DATA_TARGETS = [
  'tms-backend/uploads',
]

export const DEPENDENCY_TARGETS = [
  'node_modules',
  'tms-electron-app/node_modules',
  'tms-frontend/node_modules',
  '.venv',
]

export function createCleanupTarget(repoRoot, relativePath) {
  const root = resolve(repoRoot)
  const absolutePath = resolve(root, relativePath)
  const relativeToRoot = relative(root, absolutePath)

  if (
    relativePath === '' ||
    absolutePath === root ||
    relativeToRoot.startsWith('..') ||
    isAbsolute(relativeToRoot)
  ) {
    throw new Error(`Refusing to clean outside repo root: ${relativePath}`)
  }

  return {
    relativePath: normalizePath(relativeToRoot),
    absolutePath,
  }
}

export async function cleanupLocalArtifacts({
  repoRoot = defaultRepoRoot,
  apply = false,
  includeDeps = false,
  includeRuntimeData = false,
} = {}) {
  const targetPaths = [
    ...DEFAULT_ARTIFACT_TARGETS,
    ...(includeRuntimeData ? RUNTIME_DATA_TARGETS : []),
    ...(includeDeps ? DEPENDENCY_TARGETS : []),
  ]
  const targets = []

  for (const relativePath of targetPaths) {
    const target = createCleanupTarget(repoRoot, relativePath)
    const bytes = await measurePathBytes(target.absolutePath)
    const exists = bytes !== null
    let action = exists ? 'would-delete' : 'missing'

    if (exists && apply) {
      await rm(target.absolutePath, { recursive: true, force: true })
      action = 'deleted'
    }

    targets.push({
      relativePath: target.relativePath,
      bytes: bytes ?? 0,
      exists,
      action,
    })
  }

  return {
    repoRoot: resolve(repoRoot),
    apply,
    includeDeps,
    includeRuntimeData,
    totalBytes: targets.reduce((sum, target) => sum + target.bytes, 0),
    targets,
  }
}

async function measurePathBytes(absolutePath) {
  let info
  try {
    info = await lstat(absolutePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }

  if (!info.isDirectory()) {
    return info.size
  }

  let total = 0
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    total += await measurePathBytes(resolve(absolutePath, entry.name)) ?? 0
  }
  return total
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${bytes} B`
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function printResult(result) {
  const mode = result.apply ? 'apply' : 'dry-run'
  console.log(`Local artifact cleanup (${mode})`)
  console.log(`Repo: ${result.repoRoot}`)
  console.log(`Total selected: ${formatBytes(result.totalBytes)}`)

  for (const target of result.targets) {
    console.log(`${target.action.padEnd(12)} ${formatBytes(target.bytes).padStart(10)} ${target.relativePath}`)
  }

  if (!result.apply) {
    console.log('No files were deleted. Re-run with --apply to delete selected targets.')
  }
}

async function main(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply')
  const includeDeps = argv.includes('--include-deps')
  const includeRuntimeData = argv.includes('--include-runtime-data')
  const json = argv.includes('--json')

  if (argv.includes('--help')) {
    console.log([
      'Usage: node scripts/engineering/cleanup-local-artifacts.mjs [--apply] [--include-runtime-data] [--include-deps] [--json]',
      '',
      'Default mode is dry-run. Runtime data and dependency directories are excluded unless explicitly included.',
    ].join('\n'))
    return
  }

  const result = await cleanupLocalArtifacts({ apply, includeDeps, includeRuntimeData })
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  printResult(result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
