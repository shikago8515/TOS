# TMS 报表自动化工具 - PowerShell 打包脚本
# 使用方式: .\build.ps1

Write-Host "================================================"
Write-Host "   TMS 报表自动化工具 - PowerShell 打包脚本"
Write-Host "================================================"
Write-Host ""

$electronDir = Get-Location
$frontendDir = Join-Path $electronDir "..\tms-frontend" | Resolve-Path
$distFrontendDir = Join-Path $electronDir "dist-frontend"
$distDir = Join-Path $electronDir "dist"
$winUnpackedDir = Join-Path $distDir "win-unpacked"

Write-Host "[1/5] 清理旧文件..." -ForegroundColor Cyan
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
if (Test-Path $distFrontendDir) { Remove-Item -Recurse -Force $distFrontendDir }

Write-Host "[2/5] 构建前端项目..." -ForegroundColor Cyan
Set-Location $frontendDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败！" -ForegroundColor Red
    Read-Host "按任意键退出..."
    exit 1
}

Write-Host "[3/5] 复制前端文件..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $distFrontendDir -Force | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontendDir "dist\*") $distFrontendDir

Write-Host "[4/5] 打包 Electron 应用..." -ForegroundColor Cyan
Set-Location $electronDir
npm run pack
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Electron 打包失败！" -ForegroundColor Red
    Read-Host "按任意键退出..."
    exit 1
}

Write-Host "[5/5] 复制前端文件到 win-unpacked..." -ForegroundColor Cyan
$targetDir = Join-Path $winUnpackedDir "dist-frontend"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -Recurse -Force (Join-Path $distFrontendDir "*") $targetDir

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   打包完成！🎉" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "产物位置："
Write-Host "  - win-unpacked: $winUnpackedDir"
Write-Host "  - 主程序: $(Join-Path $winUnpackedDir "TMS报表自动化工具.exe")"
Write-Host ""

# 打开文件夹
Start-Process $winUnpackedDir

Read-Host "按任意键退出..."
