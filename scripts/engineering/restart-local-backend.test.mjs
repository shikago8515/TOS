import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import * as restartLocalBackend from './restart-local-backend.mjs'
import {
  buildBackendStartOptions,
  buildPowerShellCommand,
  isTosLocalBackendProcess,
  normalizeBackendPayload,
} from './restart-local-backend.mjs'

const repoRoot = resolve(import.meta.dirname, '..', '..')

test('root package exposes a backend restart command', async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))

  assert.equal(
    packageJson.scripts['dev:backend:restart'],
    'node scripts/engineering/restart-local-backend.mjs',
  )
})

test('normalizes process executable basenames across Windows and POSIX paths', () => {
  assert.equal(typeof restartLocalBackend.getProcessExecutableName, 'function')
  assert.equal(restartLocalBackend.getProcessExecutableName('D:\\python313\\python.exe'), 'python.exe')
  assert.equal(restartLocalBackend.getProcessExecutableName('/usr/bin/python3'), 'python3')
  assert.equal(restartLocalBackend.getProcessExecutableName('python'), 'python')
})

test('identifies only local TOS Python backend processes as stoppable', () => {
  const backendPayload = normalizeBackendPayload({
    message: 'TMS Backend API is running',
    version: '0.9.8-beta.3.20',
  })

  assert.equal(
    isTosLocalBackendProcess({
      processName: 'python.exe',
      executablePath: 'D:\\python313\\python.exe',
      commandLine: '"D:\\python313\\python.exe" main.py',
      backendPayload,
    }),
    true,
  )
  assert.equal(
    isTosLocalBackendProcess({
      processName: 'python.exe',
      executablePath: 'D:\\python313\\python.exe',
      commandLine: '"D:\\python313\\python.exe" other.py',
      backendPayload,
    }),
    false,
  )
  assert.equal(
    isTosLocalBackendProcess({
      processName: 'node.exe',
      executablePath: 'D:\\nodejs\\node.exe',
      commandLine: 'node server.js',
      backendPayload,
    }),
    false,
  )
  assert.equal(
    isTosLocalBackendProcess({
      processName: 'python.exe',
      executablePath: 'D:\\python313\\python.exe',
      commandLine: '"D:\\python313\\python.exe" main.py',
      backendPayload: normalizeBackendPayload({ message: 'Other API', version: '1.0.0' }),
    }),
    false,
  )
})

test('builds backend start options from the current repository root', () => {
  const options = buildBackendStartOptions({
    repoRoot,
    pythonBin: 'D:\\python313\\python.exe',
  })

  assert.deepEqual(options, {
    command: 'D:\\python313\\python.exe',
    args: ['main.py'],
    cwd: join(repoRoot, 'tms-backend'),
  })
})

test('wraps PowerShell snippets with explicit success exit handling', () => {
  const command = buildPowerShellCommand('Write-Output "ok"')

  assert.match(command, /\$ErrorActionPreference = 'Stop'/)
  assert.match(command, /Write-Output "ok"/)
  assert.match(command, /exit 0/)
})
