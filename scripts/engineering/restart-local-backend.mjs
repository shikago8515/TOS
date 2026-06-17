import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultBackendUrl = 'http://127.0.0.1:8000'
const defaultHost = '127.0.0.1'
const defaultPort = 8000

export function normalizeBackendPayload(payload) {
  return {
    message: typeof payload?.message === 'string' ? payload.message.trim() : '',
    version: typeof payload?.version === 'string' ? payload.version.trim().replace(/^v/i, '') : '',
  }
}

export function isTosLocalBackendProcess({
  processName,
  executablePath,
  commandLine,
  backendPayload,
}) {
  const normalizedPayload = normalizeBackendPayload(backendPayload)
  if (normalizedPayload.message !== 'TMS Backend API is running') {
    return false
  }

  const executableName = basename(String(executablePath || processName || '')).toLowerCase()
  if (!/^python(?:\d+(?:\.\d+)*)?(?:\.exe)?$/.test(executableName)) {
    return false
  }

  const normalizedCommandLine = String(commandLine || '').toLowerCase()
  return /\b(?:main|backend_launcher)\.py\b/.test(normalizedCommandLine)
}

export function buildBackendStartOptions({
  repoRoot = defaultRepoRoot,
  pythonBin = process.env.PYTHON || 'python',
} = {}) {
  return {
    command: pythonBin,
    args: ['main.py'],
    cwd: join(repoRoot, 'tms-backend'),
  }
}

export function buildPowerShellCommand(command) {
  return [
    "$ErrorActionPreference = 'Stop'",
    command,
    'exit 0',
  ].join('\n')
}

export async function restartLocalBackend({
  repoRoot = defaultRepoRoot,
  backendUrl = defaultBackendUrl,
  pythonBin = process.env.PYTHON || 'python',
  fetchImpl = globalThis.fetch,
  port = defaultPort,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable; use Node.js 18+ or pass fetchImpl.')
  }

  const expectedVersion = await readExpectedVersion(repoRoot)
  const existingBackend = await readBackendPayload(fetchImpl, backendUrl)
  const listener = await findWindowsListener(defaultHost, port)

  if (listener) {
    if (!existingBackend.ok) {
      throw new Error(`Port ${port} is already in use but does not expose the TOS backend root endpoint.`)
    }

    const processInfo = await readWindowsProcess(listener.pid)
    if (!isTosLocalBackendProcess({
      ...processInfo,
      backendPayload: existingBackend.payload,
    })) {
      throw new Error(`Port ${port} is already in use by a non-TOS backend process: ${formatProcess(processInfo)}`)
    }

    await stopWindowsProcess(listener.pid)
    await waitForPortRelease(port)
  }

  const startOptions = buildBackendStartOptions({ repoRoot, pythonBin })
  const child = spawn(startOptions.command, startOptions.args, {
    cwd: startOptions.cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()

  const backendPayload = await waitForExpectedBackendVersion({
    fetchImpl,
    backendUrl,
    expectedVersion,
  })

  return {
    pid: child.pid,
    version: backendPayload.version,
    backendUrl,
  }
}

async function readExpectedVersion(repoRoot) {
  const payload = JSON.parse(await readFile(resolve(repoRoot, 'app-version.json'), 'utf8'))
  const version = normalizeBackendPayload({ version: payload.version }).version
  if (!version) {
    throw new Error('app-version.json is missing version.')
  }
  return version
}

async function readBackendPayload(fetchImpl, backendUrl) {
  try {
    const response = await fetchImpl(backendUrl, { method: 'GET' })
    if (!response.ok) {
      return { ok: false, payload: {} }
    }
    const text = await response.text()
    return {
      ok: true,
      payload: normalizeBackendPayload(text ? JSON.parse(text) : {}),
    }
  } catch {
    return { ok: false, payload: {} }
  }
}

async function waitForExpectedBackendVersion({
  fetchImpl,
  backendUrl,
  expectedVersion,
  timeoutMs = 20000,
  intervalMs = 500,
}) {
  const deadline = Date.now() + timeoutMs
  let lastVersion = ''

  while (Date.now() < deadline) {
    const result = await readBackendPayload(fetchImpl, backendUrl)
    if (result.ok) {
      lastVersion = result.payload.version
      if (result.payload.version === expectedVersion) {
        return result.payload
      }
    }
    await delay(intervalMs)
  }

  throw new Error(
    `Backend did not report expected version ${expectedVersion} within ${timeoutMs}ms; last version was ${lastVersion || '<missing>'}.`,
  )
}

async function findWindowsListener(host, port) {
  if (process.platform !== 'win32') {
    throw new Error('dev:backend:restart currently supports Windows local development only.')
  }

  const output = await runPowerShellJson(`
    $connection = Get-NetTCPConnection -LocalAddress '${host}' -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
      [PSCustomObject]@{ pid = $connection.OwningProcess } | ConvertTo-Json -Compress
    }
  `)
  return output ? { pid: Number(output.pid) } : null
}

async function readWindowsProcess(pid) {
  const output = await runPowerShellJson(`
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue
    if ($process) {
      [PSCustomObject]@{
        pid = $process.ProcessId
        processName = $process.Name
        executablePath = $process.ExecutablePath
        commandLine = $process.CommandLine
      } | ConvertTo-Json -Compress
    }
  `)
  if (!output) {
    throw new Error(`Unable to read process ${pid}.`)
  }
  return output
}

async function stopWindowsProcess(pid) {
  await runPowerShell(`
    Stop-Process -Id ${pid} -Force -ErrorAction Stop
  `)
}

async function waitForPortRelease(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listener = await findWindowsListener(defaultHost, port)
    if (!listener) {
      return
    }
    await delay(250)
  }
  throw new Error(`Port ${port} did not release within ${timeoutMs}ms.`)
}

async function runPowerShellJson(command) {
  const output = await runPowerShell(command)
  const text = output.trim()
  return text ? JSON.parse(text) : null
}

function runPowerShell(command) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      buildPowerShellCommand(command),
    ], {
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectRun)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectRun(new Error(stderr.trim() || `PowerShell exited with code ${code}`))
        return
      }
      resolveRun(stdout)
    })
  })
}

function formatProcess(processInfo) {
  return `${processInfo.processName || '<unknown>'} ${processInfo.pid || ''} ${processInfo.commandLine || ''}`.trim()
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

async function main() {
  const result = await restartLocalBackend()
  process.stdout.write(`Backend restarted: ${result.backendUrl} version ${result.version} pid ${result.pid}\n`)
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
