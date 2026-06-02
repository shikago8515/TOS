$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "executor.pid"

if (-not (Test-Path $pidFile)) {
  Write-Output "Microsoft login executor is not running."
  exit 0
}

$executorPid = Get-Content $pidFile -Raw
$process = Get-Process -Id $executorPid -ErrorAction SilentlyContinue

if ($process) {
  Stop-Process -Id $executorPid -Force
  Write-Output "Stopped Microsoft login executor PID=$executorPid"
} else {
  Write-Output "PID file existed but process $executorPid was not running."
}

if (Test-Path $pidFile) {
  Remove-Item $pidFile -Force
}
