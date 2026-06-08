const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist')
const artifactNamePatterns = [
  /^latest\.yml$/i,
  /^alpha\.yml$/i,
  /^beta\.yml$/i,
  /^manual-downloads\.json$/i,
  /^TOS\.Setup\..+\.exe$/i,
  /^TOS\.Setup\..+\.exe\.blockmap$/i,
  /^TOS Setup .+\.exe$/i,
  /^TOS Setup .+\.exe\.blockmap$/i,
  /^TOS_v.+_Portable\.exe$/i,
  /^TOS_v.+_Windows_x64_unpacked\.zip$/i,
]

function isUpdateArtifact(fileName) {
  return artifactNamePatterns.some((pattern) => pattern.test(fileName))
}

function cleanUpdateArtifacts() {
  if (!fs.existsSync(distDir)) {
    return
  }

  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile() || !isUpdateArtifact(entry.name)) {
      continue
    }

    // 只清理 dist 顶层的 Electron 发布产物，避免误删打包目录内资源。
    fs.rmSync(path.join(distDir, entry.name), { force: true })
    console.log(`Removed stale update artifact: ${entry.name}`)
  }

  const manualDownloadsDir = path.join(distDir, 'downloads')
  if (fs.existsSync(manualDownloadsDir)) {
    // downloads 只存放生成的人工下载备用包，发布前统一清空，避免新旧版本混用。
    fs.rmSync(manualDownloadsDir, { recursive: true, force: true })
    console.log('Removed stale manual download artifacts: downloads')
  }
}

cleanUpdateArtifacts()
