const fs = require('fs')
const path = require('path')

const electronDir = path.resolve(__dirname, '..')
const frontendSource = process.env.TOS_FRONTEND_SOURCE || 'recovered'
const frontendDist = frontendSource === 'source'
  ? path.resolve(electronDir, '..', 'tms-frontend', 'dist')
  : path.resolve(electronDir, 'recovered-frontend')
const targetDir = path.join(electronDir, 'dist-frontend')

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Frontend assets not found for ${frontendSource}: ${frontendDist}`)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(targetDir, { recursive: true })
fs.cpSync(frontendDist, targetDir, { recursive: true })

console.log(`Copied ${frontendSource} frontend assets from ${frontendDist} to ${targetDir}`)
