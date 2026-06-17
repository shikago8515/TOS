param(
  [string]$AppOutDir = "",
  [string]$MakeNsis = "C:\Program Files (x86)\NSIS\Bin\makensis.exe",
  [switch]$SkipPayloadBuild
)

$ErrorActionPreference = "Stop"

$ElectronDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ElectronDir
$ProductVersion = (Get-Content -LiteralPath (Join-Path $RepoRoot "app-version.json") -Raw | ConvertFrom-Json).version
$WebInstallerBuilder = Join-Path $PSScriptRoot "build-tos-desktop-nsis-installer.ps1"
$WebOutputRoot = Join-Path $ElectronDir "dist-tos-desktop"
$OutputRoot = Join-Path $ElectronDir "dist-tos-desktop-full"
$InstallerName = "TOS-Desktop-Full-Setup.$ProductVersion.exe"
$InstallerPath = Join-Path $OutputRoot $InstallerName
$PayloadArchiveName = "TOS-Desktop-Payload.zip"
$PayloadArchivePath = Join-Path $WebOutputRoot $PayloadArchiveName
$ExtractorExePath = Join-Path $WebOutputRoot "TOS-Desktop-Extract.exe"
$CopierExePath = Join-Path $WebOutputRoot "TOS-Desktop-Copy.exe"
$CleanupExePath = Join-Path $WebOutputRoot "TOS-Desktop-Cleanup.exe"
$NsiPath = Join-Path $OutputRoot "tos-desktop-full.nsi"

function Require-Path([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Assert-Under([string]$Path, [string]$Root) {
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside output root: $Path"
  }
}

function ConvertFrom-Utf8Base64([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

$AppDisplayName = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiA=="
$FinishRunText = ConvertFrom-Utf8Base64 "5ZCv5YqoIFRPUw=="
$StopDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5YGc5q2i5pen54mIIFRPUyDov5vnqIsuLi4="
$PrepareDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5YeG5aSHIFRPUyDmoYzpnaLniYjlronoo4Xlj5EuLi4="
$ExtractDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo6Kej5Y6LIFRPUyDmoYzpnaLniYjmlofku7YuLi4="
$ExtractFailedMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOaWh+S7tuino+WOi+Wksei0peOAgumAgOWHuuS7o+egge+8mg=="
$InstallDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5a6J6KOFIFRPUyDmoYzpnaLniYjmlofku7YuLi4="
$CopyFailedMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOaWh+S7tuWkjeWItuWksei0peOAgumAgOWHuuS7o+egge+8mg=="
$IncompleteMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOWuieijheS4jeWujOaVtO+8jOivt+mHjeaWsOi/kOihjOWuieijheWMheOAgg=="

Require-Path $MakeNsis "NSIS compiler"
Require-Path $WebInstallerBuilder "TOS desktop web installer builder"

if (-not $SkipPayloadBuild) {
  $builderArgs = @("-ExecutionPolicy", "Bypass", "-File", $WebInstallerBuilder, "-MakeNsis", $MakeNsis)
  if ($AppOutDir) {
    $builderArgs += @("-AppOutDir", $AppOutDir)
  }
  & powershell @builderArgs
  if ($LASTEXITCODE -ne 0) {
    throw "TOS desktop payload build failed with exit code $LASTEXITCODE"
  }
}

Require-Path $PayloadArchivePath "TOS desktop payload archive"
Require-Path $ExtractorExePath "TOS desktop payload extractor exe"
Require-Path $CopierExePath "TOS desktop staged payload copier exe"
Require-Path $CleanupExePath "TOS desktop cleanup helper exe"

if (Test-Path -LiteralPath $OutputRoot) {
  Assert-Under $OutputRoot $ElectronDir
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$PayloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $PayloadArchivePath).Hash.ToLowerInvariant()
$PayloadSize = (Get-Item -LiteralPath $PayloadArchivePath).Length
$installerPathForNsis = $InstallerPath.Replace("\", "\\")
$payloadForNsis = $PayloadArchivePath.Replace("\", "\\")
$extractorForNsis = $ExtractorExePath.Replace("\", "\\")
$copierForNsis = $CopierExePath.Replace("\", "\\")
$cleanupForNsis = $CleanupExePath.Replace("\", "\\")

@"
Unicode true
SetCompressor lzma
ManifestDPIAware true
RequestExecutionLevel user
AutoCloseWindow false
ShowInstDetails show

!include "MUI2.nsh"
!include "LogicLib.nsh"

!macro TOS_LOG TEXT
  FileOpen `$R9 "`$1" a
  FileWrite `$R9 "`${TEXT}`$\r`$\n"
  FileClose `$R9
!macroend

Name "$AppDisplayName"
OutFile "$installerPathForNsis"
InstallDir "`$LOCALAPPDATA\TOS"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "InstallLocation"
BrandingText "TOS"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "`$INSTDIR\TOS.exe"
!define MUI_FINISHPAGE_RUN_TEXT "$FinishRunText"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "$AppDisplayName" SecMain
  SetShellVarContext current
  InitPluginsDir
  StrCpy `$1 "`$TEMP\TOS-Desktop-Full-Setup.log"
  StrCpy `$2 "`$TEMP\TOS-Desktop-Full-Stage"
  Delete "`$1"
  !insertmacro TOS_LOG "start full installer instdir=`$INSTDIR"
  !insertmacro TOS_LOG "stage=`$2"
  !insertmacro TOS_LOG "embedded payload sha256=$PayloadSha256"
  !insertmacro TOS_LOG "embedded payload size=$PayloadSize"

  SetOutPath "`$PLUGINSDIR"
  File /oname=TOS-Desktop-Extract.exe "$extractorForNsis"
  File /oname=TOS-Desktop-Copy.exe "$copierForNsis"
  File /oname=TOS-Desktop-Cleanup.exe "$cleanupForNsis"
  SetCompress off
  File /oname=TOS-Desktop-Payload.zip "$payloadForNsis"
  SetCompress auto

  DetailPrint "$StopDetail"
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Desktop-Cleanup.exe" "`$INSTDIR" >> "`$1" 2>&1"'
  Pop `$0
  !insertmacro TOS_LOG "cleanup exit=`$0"

  DetailPrint "$PrepareDetail"
  IfFileExists "`$PLUGINSDIR\TOS-Desktop-Payload.zip" +2 0
    Goto install_incomplete

  DetailPrint "$ExtractDetail"
  RMDir /r "`$2"
  CreateDirectory "`$2"
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Desktop-Extract.exe" "`$PLUGINSDIR\TOS-Desktop-Payload.zip" "`$2" >> "`$1" 2>&1"'
  Pop `$0
  !insertmacro TOS_LOG "extract exit=`$0"
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$ExtractFailedMessage`$0"
    Abort
  `${EndIf}

  DetailPrint "$InstallDetail"
  SetOutPath "`$INSTDIR"
  RMDir /r "`$INSTDIR\locales"
  RMDir /r "`$INSTDIR\resources"
  Delete "`$INSTDIR\TOS.exe"
  Delete "`$INSTDIR\electron.exe"
  Delete "`$INSTDIR\TOS-Desktop-Payload.zip"
  nsExec::ExecToLog '"`$PLUGINSDIR\TOS-Desktop-Copy.exe" "`$2" "`$INSTDIR" "`$1"'
  Pop `$0
  !insertmacro TOS_LOG "copy exit=`$0"
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$CopyFailedMessage`$0"
    Abort
  `${EndIf}

  IfFileExists "`$INSTDIR\TOS.exe" +2 0
    Goto install_incomplete
  IfFileExists "`$INSTDIR\resources\app.asar" +2 0
    Goto install_incomplete
  Goto install_complete

  install_incomplete:
    !insertmacro TOS_LOG "install incomplete"
    MessageBox MB_ICONSTOP "$IncompleteMessage"
    Abort

  install_complete:
  !insertmacro TOS_LOG "install complete"
  SetOutPath "`$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "DisplayName" "$AppDisplayName"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "DisplayVersion" "$ProductVersion"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "Publisher" "TOS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "InstallLocation" "`$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "UninstallString" '"`$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "QuietUninstallString" '"`$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop" "NoRepair" 1
  CreateDirectory "`$SMPROGRAMS\TOS"
  CreateShortcut "`$SMPROGRAMS\TOS\TOS.lnk" "`$INSTDIR\TOS.exe"
  CreateShortcut "`$DESKTOP\TOS.lnk" "`$INSTDIR\TOS.exe"
  CopyFiles /SILENT "`$PLUGINSDIR\TOS-Desktop-Cleanup.exe" "`$INSTDIR\TOS-Desktop-Cleanup.exe"
  WriteUninstaller "`$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'cmd /c ""`$INSTDIR\TOS-Desktop-Cleanup.exe" "`$INSTDIR"'
  Delete "`$DESKTOP\TOS.lnk"
  Delete "`$SMPROGRAMS\TOS\TOS.lnk"
  RMDir "`$SMPROGRAMS\TOS"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSDesktop"
  RMDir /r "`$INSTDIR"
SectionEnd
"@ | Set-Content -Path $NsiPath -Encoding UTF8

& $MakeNsis /V2 /INPUTCHARSET UTF8 $NsiPath
if ($LASTEXITCODE -ne 0) {
  throw "NSIS full installer build failed with exit code $LASTEXITCODE"
}

Require-Path $InstallerPath "TOS desktop full NSIS installer"
$installer = Get-Item -LiteralPath $InstallerPath
[PSCustomObject]@{
  ok = $true
  installerPath = $installer.FullName
  installerName = $InstallerName
  size = $installer.Length
  payloadPath = $PayloadArchivePath
  payloadName = $PayloadArchiveName
  payloadSize = $PayloadSize
  payloadSha256 = $PayloadSha256
  builder = "NSIS-full"
  networkDuringInstall = $false
} | ConvertTo-Json -Depth 3
