$ErrorActionPreference = 'Stop'

$port = 3003
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $existing) {
  [PSCustomObject]@{
    mode = 'shipping-web-debug'
    stopped = $false
    message = 'No 3003 listener was running.'
  } | ConvertTo-Json -Depth 4
  exit 0
}

Stop-Process -Id $existing.OwningProcess -Force
Start-Sleep -Milliseconds 800

[PSCustomObject]@{
  mode = 'shipping-web-debug'
  stopped = $true
  processId = $existing.OwningProcess
  port = $port
} | ConvertTo-Json -Depth 4
