const fs = require('fs')
const path = require('path')
const asar = require('@electron/asar')

const appDir = path.resolve(__dirname, '..')
const defaultDistDir = path.join(appDir, 'dist')
const requiredRendererFiles = ['dist-frontend/index.html']

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

  if (missingFiles.length > 0 || !hasRendererScript || !hasRendererStyle) {
    const details = [
      missingFiles.length > 0 ? `missing files: ${missingFiles.join(', ')}` : '',
      hasRendererScript ? '' : 'missing dist-frontend JS asset',
      hasRendererStyle ? '' : 'missing dist-frontend CSS asset',
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
  verifyRendererPackage,
}
