const assert = require('assert')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const net = require('net')
const os = require('os')
const path = require('path')
const test = require('node:test')

const repoRoot = path.resolve(__dirname, '..', '..')

const executors = [
  {
    name: 'microsoft login executor',
    appDir: path.join(repoRoot, 'tms-electron-app', 'automation-apps', 'microsoft-login-n8n-demo'),
    token: 'local-ms-login-5f1d3d6d4bda4b2db7d54c8ce8c71e91',
  },
  {
    name: 'shipping executor',
    appDir: path.join(repoRoot, 'tms-electron-app', 'automation-apps', 'shipping-automation-demo'),
    token: 'local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f',
  },
]

for (const executor of executors) {
  test(`${executor.name} rejects local credential storage`, async () => {
    await withExecutor(executor, async ({ baseUrl, dataDir, token }) => {
      const initialCredentials = await requestJson(baseUrl, 'GET', '/api/credentials')
      assert.equal(initialCredentials.statusCode, 410)
      assert.equal(initialCredentials.ok, false)
      assert.equal(initialCredentials.hasStoredCredentials, false)
      assert.equal(initialCredentials.username, '')
      assert.equal(Object.hasOwn(initialCredentials, 'password'), false)

      const saved = await requestJson(baseUrl, 'PUT', '/api/credentials', {
        username: 'saved-user',
        password: 'saved-password',
      }, token)
      assert.equal(saved.statusCode, 410)
      assert.equal(saved.ok, false)
      assert.equal(saved.hasStoredCredentials, false)
      assert.equal(saved.username, '')
      assert.equal(Object.hasOwn(saved, 'password'), false)

      const afterSave = await requestJson(baseUrl, 'GET', '/api/credentials')
      assert.equal(afterSave.statusCode, 410)
      assert.equal(afterSave.ok, false)
      assert.equal(afterSave.hasStoredCredentials, false)
      assert.equal(afterSave.username, '')
      assert.equal(Object.hasOwn(afterSave, 'password'), false)

      const health = await requestJson(baseUrl, 'GET', '/api/health')
      assert.equal(health.config.credentialsSource, 'tos-backend-database')
      assert.equal(Object.hasOwn(health.config, 'hasStoredCredentials'), false)
      assert.equal(JSON.stringify(health).includes('saved-user'), false)
      assert.equal(JSON.stringify(health).includes('saved-password'), false)
      assert.equal(JSON.stringify(health).includes('executor.secret.local.json'), false)
      assert.equal(fs.existsSync(path.join(dataDir, 'executor.secret.local.json')), false)

      const cleared = await requestJson(baseUrl, 'DELETE', '/api/credentials', undefined, token)
      assert.equal(cleared.statusCode, 410)
      assert.equal(cleared.ok, false)
      assert.equal(cleared.hasStoredCredentials, false)
      assert.equal(cleared.username, '')
      assert.equal(Object.hasOwn(cleared, 'password'), false)

      const afterClear = await requestJson(baseUrl, 'GET', '/api/credentials')
      assert.equal(afterClear.statusCode, 410)
      assert.equal(afterClear.ok, false)
      assert.equal(afterClear.hasStoredCredentials, false)
      assert.equal(afterClear.username, '')
      assert.equal(Object.hasOwn(afterClear, 'password'), false)
    })
  })
}

async function withExecutor(executor, callback) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-executor-credentials-'))
  const port = await getFreePort()
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: executor.appDir,
    env: {
      ...process.env,
      TMS_PLAYWRIGHT_DATA_DIR: dataDir,
      TMS_PLAYWRIGHT_HOST: '127.0.0.1',
      TMS_PLAYWRIGHT_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })

  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitForHealth(baseUrl, child, () => output)
    await callback({ baseUrl, dataDir, token: executor.token })
  } finally {
    await stopChild(child)
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function waitForHealth(baseUrl, child, readOutput) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Executor exited early with code ${child.exitCode}.\n${readOutput()}`)
    }
    try {
      const payload = await requestJson(baseUrl, 'GET', '/api/health')
      if (payload.ok) return
    } catch {
      // Keep polling until the executor has finished importing dependencies.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for executor health.\n${readOutput()}`)
}

async function requestJson(baseUrl, method, pathname, body, token) {
  const headers = {}
  let requestBody
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  if (token) {
    headers['X-Executor-Token'] = token
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: requestBody,
  })
  const rawText = await response.text()
  const payload = rawText ? JSON.parse(rawText) : {}
  return {
    statusCode: response.status,
    ...payload,
  }
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return
  }
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
      resolve()
    }, 3000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
