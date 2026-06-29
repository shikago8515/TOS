import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const npmCli = resolveNpmCli()
const child = spawn(process.execPath, [npmCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
})

child.on('error', (error) => {
  console.error(`Failed to start npm: ${error.message}`)
  process.exitCode = 1
})

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`npm stopped by signal ${signal}`)
    process.exitCode = 1
    return
  }

  process.exitCode = code ?? 1
})

function resolveNpmCli() {
  const npmExecPath = process.env.npm_execpath
  if (isNpmCli(npmExecPath)) {
    return npmExecPath
  }

  const bundledNpmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (isNpmCli(bundledNpmCli)) {
    return bundledNpmCli
  }

  console.error([
    'Unable to locate a real npm CLI.',
    'Expected process.env.npm_execpath or the current Node installation to provide npm/bin/npm-cli.js.',
    'Refusing to fall back to node_modules/.bin/npm because local npm shims can shadow the system npm.',
  ].join(' '))
  process.exit(1)
}

function isNpmCli(candidate) {
  return Boolean(candidate && basename(candidate).toLowerCase() === 'npm-cli.js' && existsSync(candidate))
}
