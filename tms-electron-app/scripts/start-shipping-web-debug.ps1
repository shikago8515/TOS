$ErrorActionPreference = 'Stop'

$port = 3003
$repoRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $repoRoot 'automation-apps\shipping-automation-demo\server.mjs'
$dataDir = Join-Path $env:APPDATA 'tms-integration-tool\automation-apps\shipping-automation-demo'
$logDir = Join-Path $dataDir 'launcher-logs'
$stdoutPath = Join-Path $logDir 'shipping-web-debug.out.log'
$stderrPath = Join-Path $logDir 'shipping-web-debug.err.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  try {
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 800
  } catch {
    Write-Warning "Failed to stop existing 3003 listener: $($_.Exception.Message)"
  }
}

if (Test-Path $stdoutPath) { Remove-Item $stdoutPath -Force }
if (Test-Path $stderrPath) { Remove-Item $stderrPath -Force }

$innerCommand = @"
`$env:TMS_PLAYWRIGHT_DATA_DIR = '$dataDir'
`$env:TMS_PLAYWRIGHT_PORT = '$port'
node '$serverPath'
"@

Start-Process `
  -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $innerCommand) `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath | Out-Null

Start-Sleep -Seconds 2

$health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -Method Get
$result = [PSCustomObject]@{
  mode = 'shipping-web-debug'
  serverPath = $serverPath
  dataDir = $dataDir
  healthUrl = "http://127.0.0.1:$port/health"
  stdoutPath = $stdoutPath
  stderrPath = $stderrPath
  config = $health.config
}

$result | ConvertTo-Json -Depth 6
