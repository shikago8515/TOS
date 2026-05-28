const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const appDir = path.resolve(__dirname, '..')
const packagePath = path.join(appDir, 'package.json')
const distDir = path.join(appDir, 'dist')
const appOutDir = path.join(distDir, 'win-unpacked')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(filePath, 'r')

  try {
    let bytesRead = 0
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead))
      }
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(fd)
  }

  return hash.digest('base64')
}

function requireDirectory(dirPath, description) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Missing ${description}: ${dirPath}`)
  }
}

function buildManifest({ version, zipUrl, zipPath }) {
  const stats = fs.statSync(zipPath)
  return {
    version,
    files: [
      {
        type: 'windows-x64-unpacked',
        label: 'Windows x64 免安装版',
        url: zipUrl,
        sha512: sha512Base64(zipPath),
        size: stats.size,
      },
    ],
  }
}

function createManualDownloadZip(options = {}) {
  const version = options.version || readJson(packagePath).version
  const sourceDir = path.resolve(options.appOutDir || appOutDir)
  const outputDir = path.resolve(options.outputDir || distDir)
  const zipName = `TOS_v${version}_Windows_x64_unpacked.zip`
  const zipRelativePath = path.join('downloads', version, zipName)
  const zipUrl = zipRelativePath.replace(/\\/g, '/')
  const zipPath = path.join(outputDir, zipRelativePath)
  const outputManifestPath = path.join(outputDir, 'manual-downloads.json')

  requireDirectory(sourceDir, 'win-unpacked app directory')

  fs.mkdirSync(path.dirname(zipPath), { recursive: true })
  fs.rmSync(zipPath, { force: true })

  const { path7za } = require('7zip-bin')
  const result = childProcess.spawnSync(path7za, [
    'a',
    '-tzip',
    '-mx=5',
    zipPath,
    '.',
  ], {
    cwd: sourceDir,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Failed to create manual download zip: ${zipPath}`)
  }

  const manifest = buildManifest({ version, zipUrl, zipPath })
  fs.writeFileSync(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Wrote manual download manifest: ${outputManifestPath}`)
  console.log(`Wrote manual download zip: ${zipPath}`)
  return { manifest, manifestPath: outputManifestPath, zipPath }
}

if (require.main === module) {
  try {
    createManualDownloadZip()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  buildManifest,
  createManualDownloadZip,
}
