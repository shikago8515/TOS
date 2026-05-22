const fs = require('fs')
const path = require('path')

const electronDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(electronDir, '..', 'tms-frontend', 'dist')
const targetDir = path.join(electronDir, 'dist-frontend')

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Frontend dist not found: ${frontendDist}`)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(targetDir, { recursive: true })
fs.cpSync(frontendDist, targetDir, { recursive: true })

console.log(`Copied frontend assets to ${targetDir}`)
