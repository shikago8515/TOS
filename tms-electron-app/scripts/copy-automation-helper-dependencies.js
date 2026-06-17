const fs = require('fs')
const path = require('path')

function copyDependencyClosure({ sourceRoot, targetRoot, packageNames }) {
  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    throw new Error('packageNames must contain at least one package name')
  }

  const resolvedSourceRoot = normalizeExistingDirectory(sourceRoot, 'sourceRoot')
  const resolvedTargetRoot = path.resolve(targetRoot)
  const queue = packageNames.map((packageName) => ({
    packageName,
    fromDir: resolvedSourceRoot,
    required: true,
  }))
  const copied = []
  const visited = new Set()

  fs.mkdirSync(resolvedTargetRoot, { recursive: true })

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]
    const resolvedPackage = resolvePackageDir(item.packageName, item.fromDir, resolvedSourceRoot)
    if (!resolvedPackage) {
      if (item.required) {
        throw new Error(`Package not found: ${item.packageName}`)
      }
      continue
    }

    const relativePackageDir = toRelativePackageDir(resolvedSourceRoot, resolvedPackage.packageDir)
    if (visited.has(relativePackageDir)) {
      continue
    }
    visited.add(relativePackageDir)

    const targetPackageDir = path.join(resolvedTargetRoot, ...relativePackageDir.split('/'))
    fs.cpSync(resolvedPackage.packageDir, targetPackageDir, { recursive: true, force: true })
    copied.push(relativePackageDir)

    const manifest = readPackageJson(resolvedPackage.packageJsonPath)
    enqueueDependencies(queue, manifest.dependencies, resolvedPackage.packageDir, true)
    enqueueDependencies(queue, manifest.optionalDependencies, resolvedPackage.packageDir, false)
  }

  return copied
}

function enqueueDependencies(queue, dependencies, fromDir, required) {
  for (const packageName of Object.keys(dependencies || {})) {
    queue.push({ packageName, fromDir, required })
  }
}

function normalizeExistingDirectory(directory, label) {
  const resolved = path.resolve(directory)
  const stat = fs.statSync(resolved)
  if (!stat.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`)
  }
  return resolved
}

function resolvePackageDir(packageName, fromDir, sourceRoot) {
  for (const candidateDir of packageLookupDirs(fromDir, sourceRoot)) {
    const packageDir = path.join(candidateDir, ...packageNameToPathParts(packageName))
    const packageJsonPath = path.join(packageDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      ensurePathInside(packageDir, sourceRoot)
      return { packageDir, packageJsonPath }
    }
  }
  return null
}

function packageLookupDirs(fromDir, sourceRoot) {
  const lookupDirs = []
  const resolvedFromDir = path.resolve(fromDir)
  const resolvedSourceRoot = path.resolve(sourceRoot)
  let currentDir = resolvedFromDir

  while (isPathInsideOrEqual(currentDir, resolvedSourceRoot)) {
    lookupDirs.push(path.join(currentDir, 'node_modules'))
    if (currentDir === resolvedSourceRoot) {
      lookupDirs.push(resolvedSourceRoot)
      break
    }
    currentDir = path.dirname(currentDir)
  }

  return lookupDirs
}

function packageNameToPathParts(packageName) {
  const parts = packageName.split('/')
  if (packageName.startsWith('@')) {
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid scoped package name: ${packageName}`)
    }
    return parts
  }
  if (parts.length !== 1 || !parts[0]) {
    throw new Error(`Invalid package name: ${packageName}`)
  }
  return parts
}

function toRelativePackageDir(sourceRoot, packageDir) {
  const relativePath = path.relative(sourceRoot, packageDir)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Package directory is outside sourceRoot: ${packageDir}`)
  }
  return relativePath.split(path.sep).join('/')
}

function ensurePathInside(candidatePath, rootPath) {
  if (!isPathInsideOrEqual(candidatePath, rootPath)) {
    throw new Error(`Refusing to copy dependency outside sourceRoot: ${candidatePath}`)
  }
}

function isPathInsideOrEqual(candidatePath, rootPath) {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath))
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function readPackageJson(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
}

if (require.main === module) {
  const [, , sourceRoot, targetRoot, ...packageNames] = process.argv
  try {
    const copied = copyDependencyClosure({ sourceRoot, targetRoot, packageNames })
    process.stdout.write(JSON.stringify({ ok: true, copied: copied.length, packages: copied }, null, 2))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

module.exports = {
  copyDependencyClosure,
}
