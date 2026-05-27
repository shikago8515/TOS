const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist')
const artifactNamePatterns = [
  /^latest\.yml$/i,
  /^alpha\.yml$/i,
  /^beta\.yml$/i,
  /^TOS Setup .+\.exe$/i,
  /^TOS Setup .+\.exe\.blockmap$/i,
  /^TOS_v.+_Portable\.exe$/i,
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
}

cleanUpdateArtifacts()
