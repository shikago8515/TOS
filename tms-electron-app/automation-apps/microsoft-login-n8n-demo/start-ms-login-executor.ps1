param(
  [switch]$Background
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "executor.pid"
$logsDir = Join-Path $root "logs"
$stdoutLog = Join-Path $logsDir "executor.out.log"
$stderrLog = Join-Path $logsDir "executor.err.log"

function Resolve-NodeCommand {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  throw "Node.js executable was not found."
}

if ($Background) {
  if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -Raw
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
      Write-Output "Microsoft login executor already running with PID $existingPid"
      exit 0
    }
    Remove-Item $pidFile -Force
  }

  New-Item -ItemType Directory -Force $logsDir | Out-Null
  $nodeCommand = Resolve-NodeCommand
  $process = Start-Process `
    -FilePath $nodeCommand `
    -ArgumentList @(".\server.mjs") `
    -WorkingDirectory $root `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -Path $pidFile -Value $process.Id -NoNewline
  Write-Output "Microsoft login executor started. PID=$($process.Id)"
  exit 0
}

$nodeCommand = Resolve-NodeCommand
Set-Location $root
& $nodeCommand .\server.mjs
