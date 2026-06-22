param(
  [string]$NodeExe = (Get-Command node.exe).Source,
  [string]$CodeSigningCertificateThumbprint = $env:TOS_CODESIGN_THUMBPRINT,
  [string]$TimestampServer = $env:TOS_CODESIGN_TIMESTAMP
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($TimestampServer)) {
  $TimestampServer = "http://timestamp.digicert.com"
}

$ElectronDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ElectronDir
$HelperVersionPath = Join-Path $ElectronDir "automation-helper-version.json"
$ProductVersion = (Get-Content -LiteralPath $HelperVersionPath -Raw | ConvertFrom-Json).version
$OutputRoot = Join-Path $ElectronDir "dist-automation-helper"
$PayloadRoot = Join-Path $OutputRoot "payload"
$InstallerName = "TOS-Automation-Helper-Setup.$ProductVersion.exe"
$InstallerPath = Join-Path $OutputRoot $InstallerName
$PayloadZipPath = Join-Path $OutputRoot "payload.zip"
$PayloadPackPath = Join-Path $OutputRoot "payload.pack"
$SevenZip = Join-Path $ElectronDir "node_modules\7zip-bin\win\x64\7za.exe"
$Csc = if (Test-Path (Join-Path $env:SystemRoot "Microsoft.NET\Framework64\v4.0.30319\csc.exe")) {
  Join-Path $env:SystemRoot "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
} else {
  Join-Path $env:SystemRoot "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

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

Require-Path $NodeExe "Node runtime"
Require-Path $SevenZip "7-Zip"
Require-Path $Csc "C# compiler"
Require-Path $HelperVersionPath "automation helper version file"
Require-Path (Join-Path $ElectronDir "automation-launcher") "automation launcher"
Require-Path (Join-Path $ElectronDir "automation-apps") "automation apps"
Require-Path (Join-Path $ElectronDir "adidas-materials-main.js") "adidas Materials collector entry"
Require-Path (Join-Path $ElectronDir "adidas-materials-preload.js") "adidas Materials preload entry"
Require-Path (Join-Path $ElectronDir "node_modules") "Electron Node dependencies"
Require-Path (Join-Path $PSScriptRoot "copy-automation-helper-dependencies.js") "automation helper dependency copier"

if (Test-Path -LiteralPath $OutputRoot) {
  Assert-Under $OutputRoot $ElectronDir
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $PayloadRoot -Force | Out-Null

New-Item -ItemType Directory -Path (Join-Path $PayloadRoot "node") -Force | Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $PayloadRoot "node\node.exe") -Force
Copy-Item -LiteralPath (Join-Path $ElectronDir "automation-helper-version.json") -Destination (Join-Path $PayloadRoot "automation-helper-version.json") -Force
Copy-Item -LiteralPath (Join-Path $ElectronDir "automation-launcher") -Destination (Join-Path $PayloadRoot "automation-launcher") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $ElectronDir "automation-apps") -Destination (Join-Path $PayloadRoot "automation-apps") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $ElectronDir "adidas-materials-main.js") -Destination (Join-Path $PayloadRoot "adidas-materials-main.js") -Force
Copy-Item -LiteralPath (Join-Path $ElectronDir "adidas-materials-preload.js") -Destination (Join-Path $PayloadRoot "adidas-materials-preload.js") -Force
& $NodeExe (Join-Path $PSScriptRoot "copy-automation-helper-dependencies.js") (Join-Path $ElectronDir "node_modules") (Join-Path $PayloadRoot "node_modules") ws exceljs
if ($LASTEXITCODE -ne 0) {
  throw "Automation helper dependency copy failed with exit code $LASTEXITCODE"
}

$LauncherSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Launcher.cs"
$LauncherExePath = Join-Path $PayloadRoot "TOS-Automation-Helper.exe"
@'
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string appHome = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string nodeExe = Path.Combine(appHome, "node", "node.exe");
            string bootstrap = Path.Combine(appHome, "automation-launcher", "bootstrap.js");
            string appRoot = Path.Combine(appHome, "automation-apps");
            string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TOS-Automation-Helper");

            if (!File.Exists(nodeExe))
            {
                throw new FileNotFoundException("Node runtime not found.", nodeExe);
            }
            if (!File.Exists(bootstrap))
            {
                throw new FileNotFoundException("Automation launcher bootstrap not found.", bootstrap);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodeExe,
                Arguments = "\"" + bootstrap + "\"",
                WorkingDirectory = appHome,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            startInfo.EnvironmentVariables["TMS_AUTOMATION_APP_ROOT"] = appRoot;
            startInfo.EnvironmentVariables["TMS_AUTOMATION_LAUNCHER_DATA_DIR"] = dataDir;
            startInfo.EnvironmentVariables["TMS_AUTOMATION_APP_NAME"] = "TOS-Automation-Helper";

            Process process = Process.Start(startInfo);
            if (process == null)
            {
                throw new InvalidOperationException("Failed to start automation helper.");
            }

            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "TOS Automation Helper",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }
}
'@ | Set-Content -Path $LauncherSourcePath -Encoding ASCII

& $Csc /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /out:$LauncherExePath $LauncherSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# launcher build failed with exit code $LASTEXITCODE"
}
Require-Path $LauncherExePath "automation helper launcher exe"

$runtimeDirs = @("uploads", "runs", "run-artifacts", "playwright-user-data", "tests")
Get-ChildItem -LiteralPath $PayloadRoot -Recurse -Directory -Force |
  Where-Object { $runtimeDirs -contains $_.Name } |
  Sort-Object FullName -Descending |
  ForEach-Object {
    Assert-Under $_.FullName $PayloadRoot
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }

$runtimeFiles = @(
  "*.log",
  "*.xlsx",
  "*.stdout.json",
  "*.stderr.json",
  "*.local.json",
  "*.secret.local.json",
  "executor.secret*.json",
  "temp-*.py"
)
foreach ($pattern in $runtimeFiles) {
  Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File -Force -Filter $pattern |
    ForEach-Object {
      Assert-Under $_.FullName $PayloadRoot
      Remove-Item -LiteralPath $_.FullName -Force
    }
}

@'
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

function U([string]$Hex) {
  -join (($Hex -split " ") | Where-Object { $_ } | ForEach-Object { [char][Convert]::ToInt32($_, 16) })
}

$installDir = Split-Path -Parent $PSCommandPath
$nodeExe = Join-Path $installDir "node\node.exe"
$launcherExe = Join-Path $installDir "TOS-Automation-Helper.exe"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\TOS Automation Helper"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "TOS Automation Helper.lnk"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper"

$confirm = [System.Windows.Forms.MessageBox]::Show(
  (U "786e 8ba4 5378 8f7d 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b ff1f 5378 8f7d 540e 6d4f 89c8 5668 9875 9762 5c06 65e0 6cd5 542f 52a8 672c 673a 81ea 52a8 5316 3002"),
  (U "5378 8f7d 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"),
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question
)
if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
  exit 0
}

if (Test-Path -LiteralPath $nodeExe) {
  Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -eq $nodeExe } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
}
if (Test-Path -LiteralPath $launcherExe) {
  Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -eq $launcherExe } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
}

$protocolCommandPath = "HKCU:\Software\Classes\tos\shell\open\command"
if (Test-Path $protocolCommandPath) {
  $protocolCommand = (Get-Item $protocolCommandPath).GetValue("")
  if ([string]$protocolCommand -like "*$installDir*") {
    Remove-Item "HKCU:\Software\Classes\tos" -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
if (Test-Path $runPath) {
  $runValue = (Get-ItemProperty -Path $runPath -Name "TOSAutomationLauncher" -ErrorAction SilentlyContinue).TOSAutomationLauncher
  if ([string]$runValue -like "*$installDir*") {
    Remove-ItemProperty -Path $runPath -Name "TOSAutomationLauncher" -Force -ErrorAction SilentlyContinue
  }
}

Remove-Item -LiteralPath $startMenuDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $desktopShortcut -Force -ErrorAction SilentlyContinue
Remove-Item -Path $uninstallKey -Recurse -Force -ErrorAction SilentlyContinue

[System.Windows.Forms.MessageBox]::Show(
  (U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b 5df2 5378 8f7d 3002"),
  (U "5378 8f7d 5b8c 6210"),
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null

$deleteCommand = 'timeout /t 2 /nobreak >nul & rmdir /s /q "{0}"' -f $installDir
Start-Process -FilePath "$env:ComSpec" -ArgumentList @("/c", $deleteCommand) -WindowStyle Hidden
'@ | Set-Content -Path (Join-Path $PayloadRoot "uninstall-helper.ps1") -Encoding ASCII

@'
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
home = fso.GetParentFolderName(WScript.ScriptFullName)
script = home & "\uninstall-helper.ps1"
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & Chr(34) & script & Chr(34)
shell.Run cmd, 0, True
'@ | Set-Content -Path (Join-Path $PayloadRoot "uninstall-helper.vbs") -Encoding ASCII

Push-Location $PayloadRoot
try {
  & $SevenZip a -tzip -mx=7 $PayloadZipPath . | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "7-Zip failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$payloadFiles = Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File -Force | Sort-Object FullName
$packStream = [System.IO.File]::Open($PayloadPackPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
  $writer = New-Object System.IO.BinaryWriter($packStream, [System.Text.Encoding]::UTF8)
  try {
    $writer.Write([System.Text.Encoding]::ASCII.GetBytes("TOSPACK2"))
    $writer.Write([int]$payloadFiles.Count)
    foreach ($file in $payloadFiles) {
      $relativePath = $file.FullName.Substring($PayloadRoot.Length).TrimStart("\", "/") -replace "\\", "/"
      $relativeBytes = [System.Text.Encoding]::UTF8.GetBytes($relativePath)
      $compressedStream = New-Object System.IO.MemoryStream
      $writer.Write([int]$relativeBytes.Length)
      $writer.Write($relativeBytes)
      $writer.Write([long]$file.Length)
      $inputStream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
      try {
        $deflateStream = New-Object System.IO.Compression.DeflateStream($compressedStream, [System.IO.Compression.CompressionLevel]::Optimal, $true)
        try {
          $inputStream.CopyTo($deflateStream)
        } finally {
          $deflateStream.Dispose()
        }
      } finally {
        $inputStream.Dispose()
      }
      $compressedBytes = $compressedStream.ToArray()
      $compressedStream.Dispose()
      $writer.Write([long]$compressedBytes.Length)
      $writer.Write($compressedBytes)
    }
  } finally {
    $writer.Dispose()
  }
} finally {
  $packStream.Dispose()
}
Require-Path $PayloadPackPath "automation helper payload pack"

@'
param(
  [Parameter(Mandatory = $true)]
  [string]$PayloadZip
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function U([string]$Hex) {
  -join (($Hex -split " ") | Where-Object { $_ } | ForEach-Object { [char][Convert]::ToInt32($_, 16) })
}

$defaultInstallDir = Join-Path $env:LOCALAPPDATA "TOS-Automation-Helper"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\TOS Automation Helper"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper"
$existingInstallDir = $null
try {
  $existingInstallDir = (Get-ItemProperty -Path $uninstallKey -Name "InstallLocation" -ErrorAction SilentlyContinue).InstallLocation
} catch {}
if ([string]::IsNullOrWhiteSpace($existingInstallDir)) {
  $existingInstallDir = $defaultInstallDir
}

function New-Shortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$Description, [string]$WorkingDirectory) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = $Target
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = $Description
  $shortcut.Save()
}

function Remove-IfExists([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  }
}

function Normalize-InstallDir([string]$Path) {
  $trimmed = $Path.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return $trimmed
  }

  $normalized = [System.IO.Path]::GetFullPath($trimmed)
  $leaf = Split-Path -Leaf $normalized
  if ($leaf -ieq "automation-apps") {
    $parent = Split-Path -Parent $normalized
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
      return $parent
    }
  }

  return $normalized
}

function Report-InstallProgress([object]$ProgressWorker, [int]$Percent, [string]$Message) {
  if ($ProgressWorker -ne $null) {
    $ProgressWorker.ReportProgress($Percent, $Message)
  }
}

function Install-Helper([string]$InstallDir, [bool]$CreateStartMenu, [bool]$CreateDesktopShortcut, [bool]$StartWithWindows, [bool]$LaunchAfterInstall, [object]$ProgressWorker) {
  $wscript = Join-Path $env:SystemRoot "System32\wscript.exe"
  $launcherExe = Join-Path $InstallDir "TOS-Automation-Helper.exe"
  $uninstallVbs = Join-Path $InstallDir "uninstall-helper.vbs"
  $nodeExe = Join-Path $InstallDir "node\node.exe"

  Report-InstallProgress $ProgressWorker 8 (U "6b63 5728 51c6 5907 5b89 88c5 76ee 5f55 002e 002e 002e")
  if (Test-Path -LiteralPath $nodeExe) {
    Report-InstallProgress $ProgressWorker 15 (U "6b63 5728 5173 95ed 65e7 52a9 624b 8fdb 7a0b 002e 002e 002e")
    Get-CimInstance Win32_Process |
      Where-Object { $_.ExecutablePath -eq $nodeExe } |
      ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
  }
  if (Test-Path -LiteralPath $launcherExe) {
    Report-InstallProgress $ProgressWorker 18 (U "6b63 5728 5173 95ed 65e7 52a9 624b 8fdb 7a0b 002e 002e 002e")
    Get-CimInstance Win32_Process |
      Where-Object { $_.ExecutablePath -eq $launcherExe } |
      ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
  }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Report-InstallProgress $ProgressWorker 25 (U "6b63 5728 89e3 538b 52a9 624b 6587 4ef6 002e 002e 002e")
  Expand-Archive -LiteralPath $PayloadZip -DestinationPath $InstallDir -Force
  if (-not (Test-Path -LiteralPath $launcherExe)) {
    throw "Launcher exe not found after install: $launcherExe"
  }

  Report-InstallProgress $ProgressWorker 62 (U "6b63 5728 6ce8 518c 6d4f 89c8 5668 96c6 6210 002e 002e 002e")
  New-Item -Path "HKCU:\Software\Classes\tos\DefaultIcon" -Force | Out-Null
  New-Item -Path "HKCU:\Software\Classes\tos\shell\open\command" -Force | Out-Null
  Set-Item -Path "HKCU:\Software\Classes\tos" -Value "URL:TOS Automation Launcher"
  New-ItemProperty -Path "HKCU:\Software\Classes\tos" -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
  Set-Item -Path "HKCU:\Software\Classes\tos\DefaultIcon" -Value ('"{0}",0' -f $launcherExe)
  Set-Item -Path "HKCU:\Software\Classes\tos\shell\open\command" -Value ('"{0}" "%1"' -f $launcherExe)

  Report-InstallProgress $ProgressWorker 72 (U "6b63 5728 5199 5165 5f00 673a 542f 52a8 548c 5378 8f7d 4fe1 606f 002e 002e 002e")
  New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Force | Out-Null
  if ($StartWithWindows) {
    New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "TOSAutomationLauncher" -Value ('"{0}"' -f $launcherExe) -PropertyType String -Force | Out-Null
  } else {
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "TOSAutomationLauncher" -Force -ErrorAction SilentlyContinue
  }

  New-Item -Path $uninstallKey -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "DisplayName" -Value "TOS Automation Helper" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "DisplayVersion" -Value "1.0.0" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "Publisher" -Value "TOS" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "InstallLocation" -Value $InstallDir -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "UninstallString" -Value ('"{0}" "{1}"' -f $wscript, $uninstallVbs) -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "QuietUninstallString" -Value ('"{0}" "{1}"' -f $wscript, $uninstallVbs) -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "NoModify" -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "NoRepair" -Value 1 -PropertyType DWord -Force | Out-Null

  Report-InstallProgress $ProgressWorker 84 (U "6b63 5728 521b 5efa 5feb 6377 65b9 5f0f 002e 002e 002e")
  if ($CreateStartMenu) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    New-Shortcut -Path (Join-Path $startMenuDir "Start TOS Automation Helper.lnk") -Target $launcherExe -Arguments "" -Description "Start TOS Automation Helper" -WorkingDirectory $InstallDir
    New-Shortcut -Path (Join-Path $startMenuDir "Uninstall TOS Automation Helper.lnk") -Target $wscript -Arguments ('"{0}"' -f $uninstallVbs) -Description "Uninstall TOS Automation Helper" -WorkingDirectory $InstallDir
  } else {
    Remove-Item -LiteralPath $startMenuDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  $desktopShortcut = Join-Path $desktopDir "TOS Automation Helper.lnk"
  if ($CreateDesktopShortcut) {
    New-Shortcut -Path $desktopShortcut -Target $launcherExe -Arguments "" -Description "Start TOS Automation Helper" -WorkingDirectory $InstallDir
  } else {
    Remove-IfExists $desktopShortcut
  }

  if ($LaunchAfterInstall) {
    Report-InstallProgress $ProgressWorker 94 (U "6b63 5728 542f 52a8 52a9 624b 002e 002e 002e")
    Start-Process -FilePath $launcherExe -WindowStyle Hidden
  }
  Report-InstallProgress $ProgressWorker 99 (U "6b63 5728 5b8c 6210 5b89 88c5 002e 002e 002e")
}

$form = New-Object System.Windows.Forms.Form
$form.Text = U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(720, 460)
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

$teal = [System.Drawing.Color]::FromArgb(13, 148, 136)
$tealDark = [System.Drawing.Color]::FromArgb(15, 118, 110)
$slate = [System.Drawing.Color]::FromArgb(15, 23, 42)
$muted = [System.Drawing.Color]::FromArgb(100, 116, 139)
$line = [System.Drawing.Color]::FromArgb(226, 232, 240)
$soft = [System.Drawing.Color]::FromArgb(248, 250, 252)

$side = New-Object System.Windows.Forms.Panel
$side.Location = New-Object System.Drawing.Point(0, 0)
$side.Size = New-Object System.Drawing.Size(220, 460)
$side.BackColor = $tealDark
$form.Controls.Add($side)

$brand = New-Object System.Windows.Forms.Label
$brand.Text = "TOS"
$brand.Font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$brand.ForeColor = [System.Drawing.Color]::White
$brand.AutoSize = $true
$brand.Location = New-Object System.Drawing.Point(26, 32)
$side.Controls.Add($brand)

$brandSub = New-Object System.Windows.Forms.Label
$brandSub.Text = U "81ea 52a8 5316 52a9 624b"
$brandSub.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$brandSub.ForeColor = [System.Drawing.Color]::FromArgb(204, 251, 241)
$brandSub.AutoSize = $true
$brandSub.Location = New-Object System.Drawing.Point(30, 76)
$side.Controls.Add($brandSub)

$sideText = New-Object System.Windows.Forms.Label
$sideText.Text = U "5b89 88c5 672c 673a 81ea 52a8 5316 6865 63a5 7a0b 5e8f ff0c 7528 4e8e 6d4f 89c8 5668 9875 9762 8c03 7528 672c 673a 81ea 52a8 5316 3002"
$sideText.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$sideText.ForeColor = [System.Drawing.Color]::FromArgb(209, 250, 229)
$sideText.MaximumSize = New-Object System.Drawing.Size(160, 120)
$sideText.AutoSize = $true
$sideText.Location = New-Object System.Drawing.Point(30, 134)
$side.Controls.Add($sideText)

$step1 = New-Object System.Windows.Forms.Label
$step1.Text = U "0031 0020 0020 5b89 88c5 9009 9879"
$step1.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$step1.ForeColor = [System.Drawing.Color]::White
$step1.AutoSize = $true
$step1.Location = New-Object System.Drawing.Point(30, 314)
$side.Controls.Add($step1)

$step2 = New-Object System.Windows.Forms.Label
$step2.Text = U "0032 0020 0020 6b63 5728 5b89 88c5"
$step2.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$step2.ForeColor = [System.Drawing.Color]::FromArgb(153, 246, 228)
$step2.AutoSize = $true
$step2.Location = New-Object System.Drawing.Point(30, 344)
$side.Controls.Add($step2)

$title = New-Object System.Windows.Forms.Label
$title.Text = U "5b89 88c5 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$title.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 13, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $slate
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(250, 28)
$form.Controls.Add($title)

$desc = New-Object System.Windows.Forms.Label
$desc.Text = U "9009 62e9 5b89 88c5 4f4d 7f6e 548c 8981 521b 5efa 7684 5feb 6377 65b9 5f0f 3002"
$desc.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 9)
$desc.ForeColor = $muted
$desc.AutoSize = $true
$desc.Location = New-Object System.Drawing.Point(252, 60)
$form.Controls.Add($desc)

$pathLabel = New-Object System.Windows.Forms.Label
$pathLabel.Text = U "5b89 88c5 4f4d 7f6e"
$pathLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$pathLabel.ForeColor = $slate
$pathLabel.AutoSize = $true
$pathLabel.Location = New-Object System.Drawing.Point(254, 104)
$form.Controls.Add($pathLabel)

$pathBox = New-Object System.Windows.Forms.TextBox
$pathBox.Text = $existingInstallDir
$pathBox.Size = New-Object System.Drawing.Size(334, 24)
$pathBox.Location = New-Object System.Drawing.Point(256, 128)
$form.Controls.Add($pathBox)

$browseButton = New-Object System.Windows.Forms.Button
$browseButton.Text = U "6d4f 89c8 002e 002e 002e"
$browseButton.Size = New-Object System.Drawing.Size(88, 28)
$browseButton.Location = New-Object System.Drawing.Point(600, 126)
$browseButton.Add_Click({
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = U "9009 62e9 5b89 88c5 6587 4ef6 5939"
  $dialog.SelectedPath = $pathBox.Text
  if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    $pathBox.Text = Normalize-InstallDir $dialog.SelectedPath
  }
})
$form.Controls.Add($browseButton)

$componentLabel = New-Object System.Windows.Forms.Label
$componentLabel.Text = U "7ec4 4ef6 548c 4efb 52a1"
$componentLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$componentLabel.ForeColor = $slate
$componentLabel.AutoSize = $true
$componentLabel.Location = New-Object System.Drawing.Point(254, 176)
$form.Controls.Add($componentLabel)

$requiredCore = New-Object System.Windows.Forms.CheckBox
$requiredCore.Text = U "6838 5fc3 52a9 624b 6587 4ef6 548c 672c 673a 81ea 52a8 5316 5e94 7528"
$requiredCore.Checked = $true
$requiredCore.Enabled = $false
$requiredCore.AutoSize = $true
$requiredCore.Location = New-Object System.Drawing.Point(258, 204)
$form.Controls.Add($requiredCore)

$requiredProtocol = New-Object System.Windows.Forms.CheckBox
$requiredProtocol.Text = U "6ce8 518c 0020 0074 006f 0073 003a 002f 002f 0020 6d4f 89c8 5668 542f 52a8 534f 8bae"
$requiredProtocol.Checked = $true
$requiredProtocol.Enabled = $false
$requiredProtocol.AutoSize = $true
$requiredProtocol.Location = New-Object System.Drawing.Point(258, 232)
$form.Controls.Add($requiredProtocol)

$startupCheck = New-Object System.Windows.Forms.CheckBox
$startupCheck.Text = U "968f 0020 0057 0069 006e 0064 006f 0077 0073 0020 81ea 52a8 542f 52a8"
$startupCheck.Checked = $true
$startupCheck.AutoSize = $true
$startupCheck.Location = New-Object System.Drawing.Point(258, 260)
$form.Controls.Add($startupCheck)

$startMenuCheck = New-Object System.Windows.Forms.CheckBox
$startMenuCheck.Text = U "521b 5efa 5f00 59cb 83dc 5355 5feb 6377 65b9 5f0f"
$startMenuCheck.Checked = $true
$startMenuCheck.AutoSize = $true
$startMenuCheck.Location = New-Object System.Drawing.Point(258, 288)
$form.Controls.Add($startMenuCheck)

$desktopCheck = New-Object System.Windows.Forms.CheckBox
$desktopCheck.Text = U "521b 5efa 684c 9762 5feb 6377 65b9 5f0f"
$desktopCheck.Checked = $false
$desktopCheck.AutoSize = $true
$desktopCheck.Location = New-Object System.Drawing.Point(258, 316)
$form.Controls.Add($desktopCheck)

$launchCheck = New-Object System.Windows.Forms.CheckBox
$launchCheck.Text = U "5b89 88c5 5b8c 6210 540e 542f 52a8 52a9 624b"
$launchCheck.Checked = $true
$launchCheck.AutoSize = $true
$launchCheck.Location = New-Object System.Drawing.Point(258, 344)
$form.Controls.Add($launchCheck)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = U "5efa 8bae 4fdd 7559 9ed8 8ba4 7684 5f53 524d 7528 6237 76ee 5f55 ff0c 907f 514d 7ba1 7406 5458 6743 9650 63d0 793a 3002"
$hint.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$hint.ForeColor = $muted
$hint.AutoSize = $true
$hint.Location = New-Object System.Drawing.Point(256, 374)
$form.Controls.Add($hint)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Style = "Blocks"
$progress.Minimum = 0
$progress.Maximum = 100
$progress.Value = 0
$progress.Size = New-Object System.Drawing.Size(430, 16)
$progress.Location = New-Object System.Drawing.Point(256, 270)
$progress.Visible = $false
$form.Controls.Add($progress)

$status = New-Object System.Windows.Forms.Label
$status.Text = ""
$status.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 9)
$status.ForeColor = $muted
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(256, 300)
$form.Controls.Add($status)

$footer = New-Object System.Windows.Forms.Panel
$footer.Location = New-Object System.Drawing.Point(220, 404)
$footer.Size = New-Object System.Drawing.Size(500, 56)
$footer.BackColor = $soft
$form.Controls.Add($footer)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = U "53d6 6d88"
$cancelButton.Size = New-Object System.Drawing.Size(82, 30)
$cancelButton.Location = New-Object System.Drawing.Point(300, 13)
$cancelButton.Add_Click({ $form.Close() })
$footer.Controls.Add($cancelButton)

$installButton = New-Object System.Windows.Forms.Button
$installButton.Text = U "5b89 88c5"
$installButton.Size = New-Object System.Drawing.Size(90, 30)
$installButton.Location = New-Object System.Drawing.Point(392, 13)
$installButton.BackColor = $teal
$installButton.ForeColor = [System.Drawing.Color]::White
$installButton.FlatStyle = "Flat"
$installButton.FlatAppearance.BorderSize = 0
$footer.Controls.Add($installButton)

$finishButton = New-Object System.Windows.Forms.Button
$finishButton.Text = U "5b8c 6210"
$finishButton.Size = New-Object System.Drawing.Size(90, 30)
$finishButton.Location = New-Object System.Drawing.Point(392, 13)
$finishButton.Visible = $false
$finishButton.Add_Click({ $form.Close() })
$footer.Controls.Add($finishButton)

$installWorker = New-Object System.ComponentModel.BackgroundWorker
$installWorker.WorkerReportsProgress = $true
$installWorker.DoWork += {
  param($sender, $eventArgs)

  $options = $eventArgs.Argument
  Install-Helper `
    -InstallDir $options.InstallDir `
    -CreateStartMenu $options.CreateStartMenu `
    -CreateDesktopShortcut $options.CreateDesktopShortcut `
    -StartWithWindows $options.StartWithWindows `
    -LaunchAfterInstall $options.LaunchAfterInstall `
    -ProgressWorker $sender
  $eventArgs.Result = $options.InstallDir
}
$installWorker.ProgressChanged += {
  param($sender, $eventArgs)

  $nextValue = [Math]::Max(0, [Math]::Min(99, [int]$eventArgs.ProgressPercentage))
  if ($progress.Value -ne $nextValue) {
    $progress.Value = $nextValue
  }
  if ($eventArgs.UserState -ne $null) {
    $status.Text = [string]$eventArgs.UserState
  }
}
$installWorker.RunWorkerCompleted += {
  param($sender, $eventArgs)

  $progress.Style = "Blocks"
  $form.ControlBox = $true
  if ($eventArgs.Error -ne $null) {
    $progress.Value = 0
    $title.Text = U "5b89 88c5 5931 8d25"
    $desc.Text = U "5b89 88c5 672a 5b8c 6210 ff0c 8bf7 67e5 770b 9519 8bef 4fe1 606f 3002"
    $status.Text = $eventArgs.Error.Message
    $finishButton.Text = U "5173 95ed"
  } else {
    $progress.Value = 100
    $title.Text = U "5b89 88c5 5b8c 6210"
    $desc.Text = U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b 5df2 51c6 5907 5c31 7eea ff0c 53ef 4ee5 4f9b 6d4f 89c8 5668 81ea 52a8 5316 9875 9762 4f7f 7528 3002"
    $status.Text = (U "5b89 88c5 4f4d 7f6e ff1a") + [string]$eventArgs.Result
    $finishButton.Text = U "5b8c 6210"
  }

  $finishButton.Visible = $true
  $finishButton.Focus()
  $form.AcceptButton = $finishButton
}

$installButton.Add_Click({
  if ($installWorker.IsBusy) {
    return
  }

  $chosenDir = Normalize-InstallDir $pathBox.Text
  if ([string]::IsNullOrWhiteSpace($chosenDir)) {
    [System.Windows.Forms.MessageBox]::Show((U "8bf7 9009 62e9 5b89 88c5 6587 4ef6 5939 3002"), (U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"), [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    return
  }
  $pathBox.Text = $chosenDir

  $title.Text = U "6b63 5728 5b89 88c5"
  $desc.Text = U "6b63 5728 5b89 88c5 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b ff0c 8bf7 7a0d 5019 3002"
  $step1.ForeColor = [System.Drawing.Color]::FromArgb(153, 246, 228)
  $step2.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
  $step2.ForeColor = [System.Drawing.Color]::White

  foreach ($control in @($pathLabel, $pathBox, $browseButton, $componentLabel, $requiredCore, $requiredProtocol, $startupCheck, $startMenuCheck, $desktopCheck, $launchCheck, $hint, $installButton, $cancelButton)) {
    $control.Visible = $false
  }
  $progress.Visible = $true
  $progress.Style = "Blocks"
  $progress.Value = 1
  $status.Text = U "6b63 5728 590d 5236 6587 4ef6 5e76 6ce8 518c 6d4f 89c8 5668 96c6 6210 002e 002e 002e"
  $form.Refresh()
  $form.ControlBox = $false

  $installWorker.RunWorkerAsync([pscustomobject]@{
    InstallDir = $chosenDir
    CreateStartMenu = $startMenuCheck.Checked
    CreateDesktopShortcut = $desktopCheck.Checked
    StartWithWindows = $startupCheck.Checked
    LaunchAfterInstall = $launchCheck.Checked
  })
})

[void]$form.ShowDialog()
'@ | Set-Content -Path (Join-Path $OutputRoot "install-ui.ps1") -Encoding ASCII

@'
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
home = fso.GetParentFolderName(WScript.ScriptFullName)
payload = home & "\payload.zip"
script = home & "\install-ui.ps1"
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & Chr(34) & script & Chr(34) & " " & Chr(34) & payload & Chr(34)
shell.Run cmd, 0, True
'@ | Set-Content -Path (Join-Path $OutputRoot "install-ui.vbs") -Encoding ASCII

$InstallerUiSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Installer.cs"
$InstallerUiExePath = $InstallerPath
@'
using Microsoft.Win32;
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

internal sealed class InstallerForm : Form
{
    private static readonly string LogPath = Path.Combine(Path.GetTempPath(), "TOS-Automation-Helper-Setup.log");
    private readonly Color teal = Color.FromArgb(13, 148, 136);
    private readonly Color tealDark = Color.FromArgb(15, 118, 110);
    private readonly Color slate = Color.FromArgb(15, 23, 42);
    private readonly Color muted = Color.FromArgb(100, 116, 139);
    private readonly Color soft = Color.FromArgb(248, 250, 252);

    private Label title;
    private Label desc;
    private Label step1;
    private Label step2;
    private Label pathLabel;
    private TextBox pathBox;
    private Button browseButton;
    private Label componentLabel;
    private CheckBox requiredCore;
    private CheckBox requiredProtocol;
    private CheckBox startupCheck;
    private CheckBox startMenuCheck;
    private CheckBox desktopCheck;
    private CheckBox launchCheck;
    private Label hint;
    private ProgressBar progress;
    private Label status;
    private Button cancelButton;
    private Button installButton;
    private Button finishButton;
    private BackgroundWorker worker;
    private bool installing;

    public InstallerForm()
    {
        Log("InstallerForm ctor");
        BuildUi();
    }

    internal static void Log(string message)
    {
        try
        {
            File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff ") + message + Environment.NewLine, Encoding.UTF8);
        }
        catch
        {
        }
    }

    private static string U(string hex)
    {
        StringBuilder builder = new StringBuilder();
        foreach (string part in hex.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            builder.Append((char)Convert.ToInt32(part, 16));
        }
        return builder.ToString();
    }

    private static string Quote(string value)
    {
        return "\"" + value + "\"";
    }

    private static string GetExistingInstallDir()
    {
        string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TOS-Automation-Helper");
        try
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper"))
            {
                object value = key == null ? null : key.GetValue("InstallLocation");
                string existing = value == null ? null : value.ToString();
                if (!string.IsNullOrWhiteSpace(existing))
                {
                    return existing;
                }
            }
        }
        catch
        {
        }
        return fallback;
    }

    private static string NormalizeInstallDir(string path)
    {
        string trimmed = (path ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return trimmed;
        }

        string normalized = Path.GetFullPath(trimmed);
        string leaf = Path.GetFileName(normalized.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        if (string.Equals(leaf, "automation-apps", StringComparison.OrdinalIgnoreCase))
        {
            string parent = Path.GetDirectoryName(normalized);
            if (!string.IsNullOrWhiteSpace(parent))
            {
                return parent;
            }
        }
        return normalized;
    }

    private void BuildUi()
    {
        Log("BuildUi start");
        Text = U("0054 004f 0053 0020 81ea 52a8 5316 52a9 624b");
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(720, 460);
        BackColor = Color.White;
        Font = new Font("Microsoft YaHei UI", 9f);

        Panel side = new Panel();
        side.Location = new Point(0, 0);
        side.Size = new Size(220, 460);
        side.BackColor = tealDark;
        Controls.Add(side);

        Label brand = new Label();
        brand.Text = "TOS";
        brand.Font = new Font("Segoe UI", 22f, FontStyle.Bold);
        brand.ForeColor = Color.White;
        brand.AutoSize = true;
        brand.Location = new Point(26, 32);
        side.Controls.Add(brand);

        Label brandSub = new Label();
        brandSub.Text = U("81ea 52a8 5316 52a9 624b");
        brandSub.ForeColor = Color.FromArgb(204, 251, 241);
        brandSub.AutoSize = true;
        brandSub.Location = new Point(30, 76);
        side.Controls.Add(brandSub);

        Label sideText = new Label();
        sideText.Text = U("5b89 88c5 672c 673a 81ea 52a8 5316 6865 63a5 7a0b 5e8f ff0c 7528 4e8e 6d4f 89c8 5668 9875 9762 8c03 7528 672c 673a 81ea 52a8 5316 3002");
        sideText.ForeColor = Color.FromArgb(209, 250, 229);
        sideText.MaximumSize = new Size(160, 120);
        sideText.AutoSize = true;
        sideText.Location = new Point(30, 134);
        side.Controls.Add(sideText);

        step1 = new Label();
        step1.Text = U("0031 0020 0020 5b89 88c5 9009 9879");
        step1.Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Bold);
        step1.ForeColor = Color.White;
        step1.AutoSize = true;
        step1.Location = new Point(30, 314);
        side.Controls.Add(step1);

        step2 = new Label();
        step2.Text = U("0032 0020 0020 6b63 5728 5b89 88c5");
        step2.ForeColor = Color.FromArgb(153, 246, 228);
        step2.AutoSize = true;
        step2.Location = new Point(30, 344);
        side.Controls.Add(step2);

        title = new Label();
        title.Text = U("5b89 88c5 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b");
        title.Font = new Font("Microsoft YaHei UI", 13f, FontStyle.Bold);
        title.ForeColor = slate;
        title.AutoSize = true;
        title.Location = new Point(250, 28);
        Controls.Add(title);

        desc = new Label();
        desc.Text = U("9009 62e9 5b89 88c5 4f4d 7f6e 548c 8981 521b 5efa 7684 5feb 6377 65b9 5f0f 3002");
        desc.ForeColor = muted;
        desc.AutoSize = true;
        desc.Location = new Point(252, 60);
        Controls.Add(desc);

        pathLabel = NewLabel(U("5b89 88c5 4f4d 7f6e"), new Point(254, 104), true);
        Controls.Add(pathLabel);

        pathBox = new TextBox();
        pathBox.Text = GetExistingInstallDir();
        pathBox.Size = new Size(334, 24);
        pathBox.Location = new Point(256, 128);
        Controls.Add(pathBox);

        browseButton = new Button();
        browseButton.Text = U("6d4f 89c8 002e 002e 002e");
        browseButton.Size = new Size(88, 28);
        browseButton.Location = new Point(600, 126);
        browseButton.Click += BrowseButtonClick;
        Controls.Add(browseButton);

        componentLabel = NewLabel(U("7ec4 4ef6 548c 4efb 52a1"), new Point(254, 176), true);
        Controls.Add(componentLabel);

        requiredCore = NewCheckBox(U("6838 5fc3 52a9 624b 6587 4ef6 548c 672c 673a 81ea 52a8 5316 5e94 7528"), new Point(258, 204), true, false);
        requiredProtocol = NewCheckBox(U("6ce8 518c 0020 0074 006f 0073 003a 002f 002f 0020 6d4f 89c8 5668 542f 52a8 534f 8bae"), new Point(258, 232), true, false);
        startupCheck = NewCheckBox(U("968f 0020 0057 0069 006e 0064 006f 0077 0073 0020 81ea 52a8 542f 52a8"), new Point(258, 260), true, true);
        startMenuCheck = NewCheckBox(U("521b 5efa 5f00 59cb 83dc 5355 5feb 6377 65b9 5f0f"), new Point(258, 288), true, true);
        desktopCheck = NewCheckBox(U("521b 5efa 684c 9762 5feb 6377 65b9 5f0f"), new Point(258, 316), false, true);
        launchCheck = NewCheckBox(U("5b89 88c5 5b8c 6210 540e 542f 52a8 52a9 624b"), new Point(258, 344), true, true);
        Controls.Add(requiredCore);
        Controls.Add(requiredProtocol);
        Controls.Add(startupCheck);
        Controls.Add(startMenuCheck);
        Controls.Add(desktopCheck);
        Controls.Add(launchCheck);

        hint = new Label();
        hint.Text = U("5efa 8bae 4fdd 7559 9ed8 8ba4 7684 5f53 524d 7528 6237 76ee 5f55 ff0c 907f 514d 7ba1 7406 5458 6743 9650 63d0 793a 3002");
        hint.ForeColor = muted;
        hint.AutoSize = true;
        hint.Location = new Point(256, 374);
        Controls.Add(hint);

        progress = new ProgressBar();
        progress.Style = ProgressBarStyle.Blocks;
        progress.Minimum = 0;
        progress.Maximum = 100;
        progress.Value = 0;
        progress.Size = new Size(430, 16);
        progress.Location = new Point(256, 270);
        progress.Visible = false;
        Controls.Add(progress);

        status = new Label();
        status.Text = string.Empty;
        status.ForeColor = muted;
        status.AutoSize = true;
        status.MaximumSize = new Size(430, 80);
        status.Location = new Point(256, 300);
        Controls.Add(status);

        Panel footer = new Panel();
        footer.Location = new Point(220, 404);
        footer.Size = new Size(500, 56);
        footer.BackColor = soft;
        Controls.Add(footer);

        cancelButton = new Button();
        cancelButton.Text = U("53d6 6d88");
        cancelButton.Size = new Size(82, 30);
        cancelButton.Location = new Point(300, 13);
        cancelButton.Click += delegate { Close(); };
        footer.Controls.Add(cancelButton);

        installButton = new Button();
        installButton.Text = U("5b89 88c5");
        installButton.Size = new Size(90, 30);
        installButton.Location = new Point(392, 13);
        installButton.BackColor = teal;
        installButton.ForeColor = Color.White;
        installButton.FlatStyle = FlatStyle.Flat;
        installButton.FlatAppearance.BorderSize = 0;
        installButton.Click += BeginInstall;
        footer.Controls.Add(installButton);
        AcceptButton = installButton;
        installButton.Select();

        finishButton = new Button();
        finishButton.Text = U("5b8c 6210");
        finishButton.Size = new Size(90, 30);
        finishButton.Location = new Point(392, 13);
        finishButton.Visible = false;
        finishButton.Enabled = false;
        finishButton.Click += delegate { Close(); };
        footer.Controls.Add(finishButton);

        worker = new BackgroundWorker();
        worker.WorkerReportsProgress = true;
        worker.DoWork += WorkerDoWork;
        worker.ProgressChanged += WorkerProgressChanged;
        worker.RunWorkerCompleted += WorkerCompleted;

        FormClosing += InstallerFormClosing;
        Log("BuildUi complete");
    }

    private Label NewLabel(string text, Point point, bool bold)
    {
        Label label = new Label();
        label.Text = text;
        label.Font = new Font("Microsoft YaHei UI", 9f, bold ? FontStyle.Bold : FontStyle.Regular);
        label.ForeColor = slate;
        label.AutoSize = true;
        label.Location = point;
        return label;
    }

    private CheckBox NewCheckBox(string text, Point point, bool check, bool enabled)
    {
        CheckBox box = new CheckBox();
        box.Text = text;
        box.Checked = check;
        box.Enabled = enabled;
        box.AutoSize = true;
        box.Location = point;
        return box;
    }

    private void BrowseButtonClick(object sender, EventArgs e)
    {
        using (FolderBrowserDialog dialog = new FolderBrowserDialog())
        {
            dialog.Description = U("9009 62e9 5b89 88c5 6587 4ef6 5939");
            dialog.SelectedPath = pathBox.Text;
            if (dialog.ShowDialog(this) == DialogResult.OK)
            {
                pathBox.Text = NormalizeInstallDir(dialog.SelectedPath);
            }
        }
    }

    private void BeginInstall(object sender, EventArgs e)
    {
        Log("BeginInstall click");
        if (worker.IsBusy)
        {
            Log("BeginInstall ignored: worker busy");
            return;
        }

        string chosenDir = NormalizeInstallDir(pathBox.Text);
        Log("Chosen install dir: " + chosenDir);
        if (string.IsNullOrWhiteSpace(chosenDir))
        {
            Log("BeginInstall blocked: empty install dir");
            MessageBox.Show(this, U("8bf7 9009 62e9 5b89 88c5 6587 4ef6 5939 3002"), Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        pathBox.Text = chosenDir;
        title.Text = U("6b63 5728 5b89 88c5");
        desc.Text = U("6b63 5728 5b89 88c5 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b ff0c 8bf7 7a0d 5019 3002");
        step1.ForeColor = Color.FromArgb(153, 246, 228);
        step2.Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Bold);
        step2.ForeColor = Color.White;

        Control[] hideControls = new Control[] { pathLabel, pathBox, browseButton, componentLabel, requiredCore, requiredProtocol, startupCheck, startMenuCheck, desktopCheck, launchCheck, hint, installButton, cancelButton };
        foreach (Control control in hideControls)
        {
            control.Visible = false;
        }

        progress.Visible = true;
        progress.Value = 1;
        status.Text = U("6b63 5728 590d 5236 6587 4ef6 5e76 6ce8 518c 6d4f 89c8 5668 96c6 6210 002e 002e 002e");
        installing = true;
        Refresh();

        worker.RunWorkerAsync(new InstallOptions
        {
            InstallDir = chosenDir,
            CreateStartMenu = startMenuCheck.Checked,
            CreateDesktopShortcut = desktopCheck.Checked,
            StartWithWindows = startupCheck.Checked,
            LaunchAfterInstall = launchCheck.Checked
        });
        Log("Worker started");
    }

    private void WorkerDoWork(object sender, DoWorkEventArgs e)
    {
        Log("WorkerDoWork start");
        InstallOptions options = (InstallOptions)e.Argument;
        InstallHelper(options, (BackgroundWorker)sender);
        e.Result = options.InstallDir;
        Log("WorkerDoWork complete");
    }

    private void WorkerProgressChanged(object sender, ProgressChangedEventArgs e)
    {
        int nextValue = Math.Max(0, Math.Min(99, e.ProgressPercentage));
        if (progress.Value != nextValue)
        {
            progress.Value = nextValue;
        }
        if (e.UserState != null)
        {
            status.Text = e.UserState.ToString();
        }
    }

    private void WorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
    {
        Log("WorkerCompleted start");
        installing = false;
        if (e.Error != null)
        {
            Log("WorkerCompleted error: " + e.Error.ToString());
            progress.Value = 0;
            title.Text = U("5b89 88c5 5931 8d25");
            desc.Text = U("5b89 88c5 672a 5b8c 6210 ff0c 8bf7 67e5 770b 9519 8bef 4fe1 606f 3002");
            status.Text = e.Error.Message;
            finishButton.Text = U("5173 95ed");
        }
        else
        {
            Log("WorkerCompleted success");
            progress.Value = 100;
            title.Text = U("5b89 88c5 5b8c 6210");
            desc.Text = U("0054 004f 0053 0020 81ea 52a8 5316 52a9 624b 5df2 51c6 5907 5c31 7eea ff0c 53ef 4ee5 4f9b 6d4f 89c8 5668 81ea 52a8 5316 9875 9762 4f7f 7528 3002");
            status.Text = U("5b89 88c5 4f4d 7f6e ff1a") + e.Result.ToString();
            finishButton.Text = U("5b8c 6210");
        }

        finishButton.Visible = true;
        finishButton.Enabled = false;
        AcceptButton = null;

        Timer enableFinishTimer = new Timer();
        enableFinishTimer.Interval = 1500;
        enableFinishTimer.Tick += delegate
        {
            enableFinishTimer.Stop();
            enableFinishTimer.Dispose();
            finishButton.Enabled = true;
            Log("Finish button enabled");
        };
        enableFinishTimer.Start();
        Log("WorkerCompleted end");
    }

    private void InstallerFormClosing(object sender, FormClosingEventArgs e)
    {
        Log("FormClosing installing=" + installing.ToString());
        if (installing)
        {
            e.Cancel = true;
            Log("FormClosing canceled because install is running");
        }
    }

    private void InstallHelper(InstallOptions options, BackgroundWorker progressWorker)
    {
        Log("InstallHelper start");
        string installDir = options.InstallDir;
        string launcherExe = Path.Combine(installDir, "TOS-Automation-Helper.exe");
        string nodeExe = Path.Combine(installDir, "node", "node.exe");
        string uninstallVbs = Path.Combine(installDir, "uninstall-helper.vbs");
        string wscript = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "wscript.exe");
        string startMenuDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"Microsoft\Windows\Start Menu\Programs\TOS Automation Helper");
        string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "TOS Automation Helper.lnk");

        progressWorker.ReportProgress(8, U("6b63 5728 51c6 5907 5b89 88c5 76ee 5f55 002e 002e 002e"));
        Log("Killing old helper processes");
        KillByPath(nodeExe);
        KillByPath(launcherExe);

        Directory.CreateDirectory(installDir);
        Log("Extract payload");
        ExtractPayload(installDir, progressWorker);
        if (!File.Exists(launcherExe))
        {
            throw new FileNotFoundException("Launcher exe not found after install.", launcherExe);
        }

        progressWorker.ReportProgress(72, U("6b63 5728 6ce8 518c 6d4f 89c8 5668 96c6 6210 002e 002e 002e"));
        Log("Register protocol");
        RegisterProtocol(launcherExe);

        progressWorker.ReportProgress(80, U("6b63 5728 5199 5165 5f00 673a 542f 52a8 548c 5378 8f7d 4fe1 606f 002e 002e 002e"));
        Log("Register startup/uninstall");
        RegisterStartup(launcherExe, options.StartWithWindows);
        RegisterUninstall(installDir, wscript, uninstallVbs);

        progressWorker.ReportProgress(90, U("6b63 5728 521b 5efa 5feb 6377 65b9 5f0f 002e 002e 002e"));
        Log("Create shortcuts");
        if (options.CreateStartMenu)
        {
            Directory.CreateDirectory(startMenuDir);
            CreateShortcut(Path.Combine(startMenuDir, "Start TOS Automation Helper.lnk"), launcherExe, string.Empty, "Start TOS Automation Helper", installDir);
            CreateShortcut(Path.Combine(startMenuDir, "Uninstall TOS Automation Helper.lnk"), wscript, Quote(uninstallVbs), "Uninstall TOS Automation Helper", installDir);
        }
        else if (Directory.Exists(startMenuDir))
        {
            Directory.Delete(startMenuDir, true);
        }

        if (options.CreateDesktopShortcut)
        {
            CreateShortcut(desktopShortcut, launcherExe, string.Empty, "Start TOS Automation Helper", installDir);
        }
        else if (File.Exists(desktopShortcut))
        {
            File.Delete(desktopShortcut);
        }

        if (options.LaunchAfterInstall)
        {
            progressWorker.ReportProgress(96, U("6b63 5728 542f 52a8 52a9 624b 002e 002e 002e"));
            Log("Launch helper");
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = launcherExe;
            startInfo.WorkingDirectory = installDir;
            startInfo.UseShellExecute = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(startInfo);
        }

        progressWorker.ReportProgress(99, U("6b63 5728 5b8c 6210 5b89 88c5 002e 002e 002e"));
        Log("InstallHelper complete");
    }

    private void ExtractPayload(string installDir, BackgroundWorker progressWorker)
    {
        Log("ExtractPayload start");
        progressWorker.ReportProgress(20, U("6b63 5728 89e3 538b 52a9 624b 6587 4ef6 002e 002e 002e"));
        string root = Path.GetFullPath(installDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        using (Stream packStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.pack"))
        {
            if (packStream == null)
            {
                throw new FileNotFoundException("Installer payload pack resource not found.");
            }

            using (BinaryReader reader = new BinaryReader(packStream, Encoding.UTF8))
            {
                byte[] magic = reader.ReadBytes(8);
                if (Encoding.ASCII.GetString(magic) != "TOSPACK2")
                {
                    throw new InvalidDataException("Invalid installer payload pack.");
                }
                int total = reader.ReadInt32();
                Log("Payload pack file count: " + total.ToString());
                byte[] buffer = new byte[1024 * 1024];
                for (int index = 0; index < total; index++)
                {
                    int pathLength = reader.ReadInt32();
                    if (pathLength <= 0 || pathLength > 4096)
                    {
                        throw new InvalidDataException("Invalid payload path length.");
                    }
                    string relativePath = Encoding.UTF8.GetString(reader.ReadBytes(pathLength)).Replace('/', Path.DirectorySeparatorChar);
                    long fileLength = reader.ReadInt64();
                    if (fileLength < 0)
                    {
                        throw new InvalidDataException("Invalid payload file length.");
                    }
                    long compressedLength = reader.ReadInt64();
                    if (compressedLength < 0)
                    {
                        throw new InvalidDataException("Invalid payload compressed length.");
                    }

                    string destination = Path.GetFullPath(Path.Combine(installDir, relativePath));
                    if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("Invalid payload entry: " + relativePath);
                    }

                    string parent = Path.GetDirectoryName(destination);
                    if (!string.IsNullOrWhiteSpace(parent))
                    {
                        Directory.CreateDirectory(parent);
                    }

                    using (FileStream output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        byte[] compressedBytes = reader.ReadBytes((int)compressedLength);
                        if (compressedBytes.Length != compressedLength)
                        {
                            throw new EndOfStreamException("Unexpected end of payload pack.");
                        }
                        using (MemoryStream compressedStream = new MemoryStream(compressedBytes))
                        using (DeflateStream deflateStream = new DeflateStream(compressedStream, CompressionMode.Decompress))
                        {
                            deflateStream.CopyTo(output);
                        }
                    }

                    FileInfo writtenFile = new FileInfo(destination);
                    if (writtenFile.Length != fileLength)
                    {
                        throw new InvalidDataException("Payload file length mismatch: " + relativePath);
                    }

                    /*
                    {
                        long remaining = fileLength;
                        while (remaining > 0)
                        {
                            int readSize = (int)Math.Min(buffer.Length, remaining);
                            int read = reader.Read(buffer, 0, readSize);
                            if (read <= 0)
                            {
                                throw new EndOfStreamException("Unexpected end of payload pack.");
                            }
                            output.Write(buffer, 0, read);
                            remaining -= read;
                        }
                    }
                    */

                    int percent = 20 + (int)(50.0 * (index + 1) / Math.Max(total, 1));
                    progressWorker.ReportProgress(Math.Min(percent, 70), U("6b63 5728 5199 51fa 52a9 624b 6587 4ef6 002e 002e 002e"));
                }
            }
        }
        Log("ExtractPayload complete");
    }

    private static void KillByPath(string exePath)
    {
        if (string.IsNullOrWhiteSpace(exePath))
        {
            return;
        }

        foreach (Process process in Process.GetProcesses())
        {
            try
            {
                string runningPath = process.MainModule == null ? null : process.MainModule.FileName;
                if (string.Equals(runningPath, exePath, StringComparison.OrdinalIgnoreCase))
                {
                    process.Kill();
                    process.WaitForExit(3000);
                }
            }
            catch
            {
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void RegisterProtocol(string launcherExe)
    {
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\tos"))
        {
            key.SetValue(string.Empty, "URL:TOS Automation Launcher");
            key.SetValue("URL Protocol", string.Empty, RegistryValueKind.String);
        }
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\tos\DefaultIcon"))
        {
            key.SetValue(string.Empty, Quote(launcherExe) + ",0");
        }
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\tos\shell\open\command"))
        {
            key.SetValue(string.Empty, Quote(launcherExe) + " \"%1\"");
        }
    }

    private static void RegisterStartup(string launcherExe, bool startWithWindows)
    {
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
        {
            if (startWithWindows)
            {
                key.SetValue("TOSAutomationLauncher", Quote(launcherExe), RegistryValueKind.String);
            }
            else
            {
                key.DeleteValue("TOSAutomationLauncher", false);
            }
        }
    }

    private static void RegisterUninstall(string installDir, string wscript, string uninstallVbs)
    {
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper"))
        {
            key.SetValue("DisplayName", "TOS Automation Helper", RegistryValueKind.String);
            key.SetValue("DisplayVersion", "1.0.0", RegistryValueKind.String);
            key.SetValue("Publisher", "TOS", RegistryValueKind.String);
            key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
            key.SetValue("UninstallString", Quote(wscript) + " " + Quote(uninstallVbs), RegistryValueKind.String);
            key.SetValue("QuietUninstallString", Quote(wscript) + " " + Quote(uninstallVbs), RegistryValueKind.String);
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    private static void CreateShortcut(string path, string target, string arguments, string description, string workingDirectory)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null)
        {
            return;
        }

        object shell = Activator.CreateInstance(shellType);
        object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { path });
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { target });
        shortcutType.InvokeMember("Arguments", BindingFlags.SetProperty, null, shortcut, new object[] { arguments });
        shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
        shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { description });
        shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
    }

    private sealed class InstallOptions
    {
        public string InstallDir;
        public bool CreateStartMenu;
        public bool CreateDesktopShortcut;
        public bool StartWithWindows;
        public bool LaunchAfterInstall;
    }
}

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        try
        {
            InstallerForm.Log("Program.Main start");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
            InstallerForm.Log("Program.Main end");
            return 0;
        }
        catch (Exception ex)
        {
            InstallerForm.Log("Program.Main exception: " + ex.ToString());
            MessageBox.Show(ex.ToString(), "TOS Automation Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
'@ | Set-Content -Path $InstallerUiSourcePath -Encoding ASCII

& $Csc /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll "/resource:$PayloadPackPath,payload.pack" /out:$InstallerUiExePath $InstallerUiSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# installer UI build failed with exit code $LASTEXITCODE"
}
Require-Path $InstallerUiExePath "automation helper installer UI exe"
Remove-Item -LiteralPath (Join-Path $OutputRoot "install-ui.ps1") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $OutputRoot "install-ui.vbs") -Force -ErrorAction SilentlyContinue

if (-not [string]::IsNullOrWhiteSpace($CodeSigningCertificateThumbprint)) {
  $certificate = Get-ChildItem -Path "Cert:\CurrentUser\My\$CodeSigningCertificateThumbprint" -ErrorAction SilentlyContinue
  if (-not $certificate) {
    $certificate = Get-ChildItem -Path "Cert:\LocalMachine\My\$CodeSigningCertificateThumbprint" -ErrorAction SilentlyContinue
  }
  if (-not $certificate) {
    throw "Code signing certificate not found: $CodeSigningCertificateThumbprint"
  }

  $signature = Set-AuthenticodeSignature -FilePath $InstallerPath -Certificate $certificate -TimestampServer $TimestampServer
  if ($signature.Status -ne "Valid") {
    throw "Code signing failed: $($signature.Status) $($signature.StatusMessage)"
  }
}

Require-Path $InstallerPath "automation helper installer"
$installer = Get-Item -LiteralPath $InstallerPath
[PSCustomObject]@{
  ok = $true
  installerPath = $installer.FullName
  installerName = $InstallerName
  size = $installer.Length
  signed = -not [string]::IsNullOrWhiteSpace($CodeSigningCertificateThumbprint)
} | ConvertTo-Json -Depth 3
