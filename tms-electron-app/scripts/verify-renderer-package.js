const fs = require('fs')
const path = require('path')
const asar = require('@electron/asar')

const appDir = path.resolve(__dirname, '..')
const defaultDistDir = path.join(appDir, 'dist')
const requiredRendererFiles = ['dist-frontend/index.html']
const maxAppAsarSizeBytes = 250 * 1024 * 1024
const maxIssueSamples = 5

const extraResourcePrefixes = [
  'automation-apps/',
  'automation-launcher/',
  'backend-runtime/',
  'browser-plugins/',
  'external-apps/',
]

function normalizePackagePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

function listDirectoryFiles(rootDir) {
  const results = []
  const stack = [rootDir]

  while (stack.length > 0) {
    const currentDir = stack.pop()
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
        continue
      }
      if (entry.isFile()) {
        results.push(normalizePackagePath(path.relative(rootDir, entryPath)))
      }
    }
  }

  return results
}

function listPackagedAppFiles(appOutDir) {
  const appAsarPath = path.join(appOutDir, 'resources', 'app.asar')
  if (fs.existsSync(appAsarPath)) {
    return asar.listPackage(appAsarPath).map(normalizePackagePath)
  }

  const unpackedAppDir = path.join(appOutDir, 'resources', 'app')
  if (fs.existsSync(unpackedAppDir)) {
    return listDirectoryFiles(unpackedAppDir)
  }

  throw new Error(`Packaged app resources not found under ${appOutDir}`)
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function appendSampledIssue(issues, files, predicate, message) {
  const matches = files.filter(predicate)
  if (matches.length === 0) {
    return
  }

  const sample = matches.slice(0, maxIssueSamples).join(', ')
  const suffix = matches.length > maxIssueSamples
    ? ` (+${matches.length - maxIssueSamples} more)`
    : ''

  issues.push(`${message}: ${sample}${suffix}`)
}

function isForbiddenDistArtifact(filePath) {
  const topLevelName = filePath.split('/')[0]
  return topLevelName === 'dist' || (
    topLevelName.startsWith('dist-') &&
    topLevelName !== 'dist-frontend'
  )
}

function collectPackagedAppHygieneIssues(appOutDir, packagedFiles) {
  const files = Array.from(packagedFiles || []).map(normalizePackagePath)
  const issues = []
  const appAsarPath = path.join(appOutDir, 'resources', 'app.asar')

  if (fs.existsSync(appAsarPath)) {
    const appAsarSize = fs.statSync(appAsarPath).size
    if (appAsarSize > maxAppAsarSizeBytes) {
      issues.push(
        `app.asar is ${formatMegabytes(appAsarSize)}; expected at most ${formatMegabytes(maxAppAsarSizeBytes)}`,
      )
    }
  }

  appendSampledIssue(
    issues,
    files,
    isForbiddenDistArtifact,
    'generated dist output leaked into app.asar',
  )
  appendSampledIssue(
    issues,
    files,
    (filePath) => /(^|\/)win-unpacked\//.test(filePath),
    'nested win-unpacked output leaked into app.asar',
  )
  appendSampledIssue(
    issues,
    files,
    (filePath) => /(^|\/)app\.asar$/.test(filePath),
    'nested app.asar leaked into app.asar',
  )
  appendSampledIssue(
    issues,
    files,
    (filePath) => extraResourcePrefixes.some((prefix) => filePath.startsWith(prefix)),
    'extraResources content was also packed into app.asar',
  )

  return issues
}

function findCandidateAppOutDirs() {
  if (process.argv[2]) {
    return [path.resolve(appDir, process.argv[2])]
  }

  const winUnpackedDir = path.join(defaultDistDir, 'win-unpacked')
  if (fs.existsSync(winUnpackedDir)) {
    return [winUnpackedDir]
  }

  if (!fs.existsSync(defaultDistDir)) {
    return []
  }

  return fs.readdirSync(defaultDistDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-unpacked'))
    .map((entry) => path.join(defaultDistDir, entry.name))
}

function verifyRendererPackage(appOutDir) {
  const packagedFiles = new Set(listPackagedAppFiles(appOutDir))

  const missingFiles = requiredRendererFiles.filter((filePath) => !packagedFiles.has(filePath))
  const hasRendererScript = Array.from(packagedFiles).some((filePath) => (
    filePath.startsWith('dist-frontend/assets/') && filePath.endsWith('.js')
  ))
  const hasRendererStyle = Array.from(packagedFiles).some((filePath) => (
    filePath.startsWith('dist-frontend/assets/') && filePath.endsWith('.css')
  ))
  const hygieneIssues = collectPackagedAppHygieneIssues(appOutDir, packagedFiles)

  if (missingFiles.length > 0 || !hasRendererScript || !hasRendererStyle || hygieneIssues.length > 0) {
    const details = [
      missingFiles.length > 0 ? `missing files: ${missingFiles.join(', ')}` : '',
      hasRendererScript ? '' : 'missing dist-frontend JS asset',
      hasRendererStyle ? '' : 'missing dist-frontend CSS asset',
      ...hygieneIssues,
    ].filter(Boolean).join('; ')

    throw new Error(
      `Renderer package verification failed for ${appOutDir}: ${details}. ` +
      'Check electron-builder build.files exclusions before publishing.'
    )
  }

  // 这里必须校验打进 app.asar 的产物，而不是源码目录，避免发布后才发现白屏。
  console.log(`Renderer package verified: ${path.relative(appDir, appOutDir) || appOutDir}`)
}

function main() {
  const candidateDirs = findCandidateAppOutDirs()
  if (candidateDirs.length === 0) {
    throw new Error(`No packaged app output found under ${defaultDistDir}`)
  }

  for (const appOutDir of candidateDirs) {
    verifyRendererPackage(appOutDir)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  collectPackagedAppHygieneIssues,
  listPackagedAppFiles,
  verifyRendererPackage,
}
