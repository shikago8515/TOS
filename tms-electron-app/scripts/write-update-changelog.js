const fs = require('fs')
const path = require('path')

const appDir = path.resolve(__dirname, '..')
const packagePath = path.join(appDir, 'package.json')
const sourcePath = path.join(appDir, 'update-changelog.json')
const outputDir = path.resolve(appDir, process.argv[2] || 'dist')
const outputPath = path.join(outputDir, 'changelog.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeUpdateChangelog() {
  const packageJson = readJson(packagePath)
  const source = readJson(sourcePath)
  const payload = {
    version: packageJson.version,
    date: source.date || new Date().toISOString().slice(0, 10),
    added: Array.isArray(source.added) ? source.added : [],
    improved: Array.isArray(source.improved) ? source.improved : [],
    fixed: Array.isArray(source.fixed) ? source.fixed : [],
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote update changelog: ${outputPath}`)
}

writeUpdateChangelog()
