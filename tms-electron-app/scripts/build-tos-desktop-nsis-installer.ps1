param(
  [string]$AppOutDir = "",
  [string]$MakeNsis = "C:\Program Files (x86)\NSIS\Bin\makensis.exe",
  [string]$PayloadUrl = "http://172.16.8.13:56130/tos/tos-desktop/payload/{sha256}"
)

$ErrorActionPreference = "Stop"

$ElectronDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ElectronDir
$ProductVersion = (Get-Content -LiteralPath (Join-Path $RepoRoot "app-version.json") -Raw | ConvertFrom-Json).version
$SourceAppDir = if ($AppOutDir) {
  [System.IO.Path]::GetFullPath($AppOutDir)
} else {
  Join-Path $ElectronDir "dist\win-unpacked"
}
$OutputRoot = Join-Path $ElectronDir "dist-tos-desktop"
$PayloadRoot = Join-Path $OutputRoot "payload"
$InstallerName = "TOS-Desktop-Setup.$ProductVersion.exe"
$InstallerPath = Join-Path $OutputRoot $InstallerName
$PayloadArchiveName = "TOS-Desktop-Payload.zip"
$PayloadArchivePath = Join-Path $OutputRoot $PayloadArchiveName
$NsiPath = Join-Path $OutputRoot "tos-desktop.nsi"
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

function ConvertFrom-Utf8Base64([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

$AppDisplayName = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiA=="
$FinishRunText = ConvertFrom-Utf8Base64 "5ZCv5YqoIFRPUw=="
$StopDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5YGc5q2i5pen54mIIFRPUyDov5vnqIsuLi4="
$DownloadDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5LiL6L29IFRPUyDmoYzpnaLniYjmlofku7YuLi4="
$DownloadFailedMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOaWh+S7tuS4i+i9veWksei0peOAgumAgOWHuuS7o+egge+8mg=="
$ExtractDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo6Kej5Y6LIFRPUyDmoYzpnaLniYjmlofku7YuLi4="
$ExtractFailedMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOaWh+S7tuino+WOi+Wksei0peOAgumAgOWHuuS7o+egge+8mg=="
$InstallDetail = ConvertFrom-Utf8Base64 "5q2j5Zyo5a6J6KOFIFRPUyDmoYzpnaLniYjmlofku7YuLi4="
$CopyFailedMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOaWh+S7tuWkjeWItuWksei0peOAgumAgOWHuuS7o+egge+8mg=="
$IncompleteMessage = ConvertFrom-Utf8Base64 "VE9TIOahjOmdoueJiOWuieijheS4jeWujOaVtO+8jOivt+mHjeaWsOi/kOihjOWuieijheWMheOAgg=="

Require-Path $MakeNsis "NSIS compiler"
Require-Path $Csc "C# compiler"
Require-Path $SourceAppDir "TOS win-unpacked app"

if (Test-Path -LiteralPath $OutputRoot) {
  Assert-Under $OutputRoot $ElectronDir
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $PayloadRoot -Force | Out-Null

Copy-Item -Path (Join-Path $SourceAppDir "*") -Destination $PayloadRoot -Recurse -Force

$payloadTosExe = Join-Path $PayloadRoot "TOS.exe"
$payloadElectronExe = Join-Path $PayloadRoot "electron.exe"
if ((-not (Test-Path -LiteralPath $payloadTosExe)) -and (Test-Path -LiteralPath $payloadElectronExe)) {
  Rename-Item -LiteralPath $payloadElectronExe -NewName "TOS.exe"
}
Require-Path $payloadTosExe "TOS executable"
Require-Path (Join-Path $PayloadRoot "resources\app.asar") "TOS app.asar"

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

$DownloaderSourcePath = Join-Path $OutputRoot "TOS-Desktop-Download.cs"
$DownloaderExePath = Join-Path $OutputRoot "TOS-Desktop-Download.exe"
$ExtractorSourcePath = Join-Path $OutputRoot "TOS-Desktop-Extract.cs"
$ExtractorExePath = Join-Path $OutputRoot "TOS-Desktop-Extract.exe"
$CopierSourcePath = Join-Path $OutputRoot "TOS-Desktop-Copy.cs"
$CopierExePath = Join-Path $OutputRoot "TOS-Desktop-Copy.exe"
$CleanupSourcePath = Join-Path $OutputRoot "TOS-Desktop-Cleanup.cs"
$CleanupExePath = Join-Path $OutputRoot "TOS-Desktop-Cleanup.exe"

@'
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Usage: downloader <url> <output-file> <sha256>");
            return 2;
        }

        try
        {
            string url = args[0];
            string outputPath = args[1];
            string expectedSha256 = Normalize(args[2]);
            DownloadFile(url, outputPath);
            VerifySha256(outputPath, expectedSha256);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static void DownloadFile(string url, string outputPath)
    {
        string directory = Path.GetDirectoryName(outputPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        string curlPath = Path.Combine(Environment.SystemDirectory, "curl.exe");
        if (File.Exists(curlPath))
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = curlPath;
            info.Arguments = "--fail --location --silent --show-error --connect-timeout 20 --max-time 600 --retry 2 --retry-delay 1 --output " + Quote(outputPath) + " " + Quote(url);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            using (Process process = Process.Start(info))
            {
                process.WaitForExit();
                if (process.ExitCode == 0 && File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
                {
                    return;
                }
            }
        }

        ServicePointManager.SecurityProtocol = ServicePointManager.SecurityProtocol | (SecurityProtocolType)3072;
        using (WebClient client = new WebClient())
        {
            client.Headers.Add("User-Agent", "TOS-Desktop-Setup/1.0");
            client.DownloadFile(url, outputPath);
        }
    }

    private static void VerifySha256(string filePath, string expected)
    {
        using (FileStream stream = File.OpenRead(filePath))
        using (SHA256 sha256 = SHA256.Create())
        {
            string actual = BitConverter.ToString(sha256.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Payload SHA256 mismatch. Expected " + expected + ", actual " + actual);
            }
        }
    }

    private static string Quote(string value)
    {
        return "\"" + (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    private static string Normalize(string value)
    {
        return (value ?? string.Empty).Trim().Replace("-", string.Empty).ToLowerInvariant();
    }
}
'@ | Set-Content -Path $DownloaderSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$DownloaderExePath $DownloaderSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# payload downloader build failed with exit code $LASTEXITCODE"
}
Require-Path $DownloaderExePath "TOS desktop payload downloader exe"

@'
using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: extractor <zip-file> <target-dir>");
            return 2;
        }

        try
        {
            string zipPath = Path.GetFullPath(args[0]);
            string targetDir = Path.GetFullPath(args[1]);
            if (!File.Exists(zipPath))
            {
                throw new FileNotFoundException("Payload zip not found.", zipPath);
            }

            Directory.CreateDirectory(targetDir);
            string tarPath = FindTar();
            Console.WriteLine("tar: " + tarPath);
            Console.WriteLine("zip: " + zipPath);
            Console.WriteLine("target: " + targetDir);

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = tarPath;
            info.Arguments = "-xf " + Quote(zipPath) + " -C " + Quote(targetDir);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            using (Process process = Process.Start(info))
            {
                string output = process.StandardOutput.ReadToEnd();
                string error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (!string.IsNullOrWhiteSpace(output))
                {
                    Console.WriteLine(output.Trim());
                }
                if (!string.IsNullOrWhiteSpace(error))
                {
                    Console.Error.WriteLine(error.Trim());
                }
                if (process.ExitCode != 0)
                {
                    return process.ExitCode;
                }
            }

            Console.WriteLine("Payload extraction completed.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static string FindTar()
    {
        string windir = Environment.GetEnvironmentVariable("WINDIR") ?? @"C:\Windows";
        string[] candidates = new string[]
        {
            Path.Combine(windir, "Sysnative", "tar.exe"),
            Path.Combine(windir, "System32", "tar.exe"),
            "tar.exe"
        };
        foreach (string candidate in candidates)
        {
            if (candidate.Equals("tar.exe", StringComparison.OrdinalIgnoreCase) || File.Exists(candidate))
            {
                return candidate;
            }
        }
        throw new FileNotFoundException("Windows tar.exe was not found.");
    }

    private static string Quote(string value)
    {
        return "\"" + (value ?? string.Empty).Replace("\"", "\\\"") + "\"";
    }
}
'@ | Set-Content -Path $ExtractorSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$ExtractorExePath $ExtractorSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# payload extractor build failed with exit code $LASTEXITCODE"
}
Require-Path $ExtractorExePath "TOS desktop payload extractor exe"

@'
using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static string logPath;

    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: copier <source-dir> <target-dir> [log-file]");
            return 2;
        }

        try
        {
            string sourceDir = Path.GetFullPath(args[0]);
            string targetDir = Path.GetFullPath(args[1]);
            logPath = args.Length >= 3 ? args[2] : null;
            if (!Directory.Exists(sourceDir))
            {
                throw new DirectoryNotFoundException("Source directory not found: " + sourceDir);
            }

            Directory.CreateDirectory(targetDir);
            string robocopy = Path.Combine(Environment.SystemDirectory, "robocopy.exe");
            if (!File.Exists(robocopy))
            {
                robocopy = "robocopy.exe";
            }

            Log("robocopy: " + robocopy);
            Log("source: " + sourceDir);
            Log("target: " + targetDir);

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = robocopy;
            info.Arguments = Quote(sourceDir) + " " + Quote(targetDir) + " /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP";
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            int exitCode;
            using (Process process = Process.Start(info))
            {
                string output = process.StandardOutput.ReadToEnd();
                string error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                exitCode = process.ExitCode;
                if (!string.IsNullOrWhiteSpace(output))
                {
                    Log(output.Trim());
                }
                if (!string.IsNullOrWhiteSpace(error))
                {
                    Log(error.Trim());
                }
            }

            Log("robocopy exit: " + exitCode);
            return exitCode <= 7 ? 0 : exitCode;
        }
        catch (Exception ex)
        {
            Log(ex.ToString());
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static void Log(string message)
    {
        Console.WriteLine(message);
        if (string.IsNullOrWhiteSpace(logPath))
        {
            return;
        }
        File.AppendAllText(logPath, message + Environment.NewLine);
    }

    private static string Quote(string value)
    {
        return "\"" + (value ?? string.Empty).Replace("\"", "\\\"") + "\"";
    }
}
'@ | Set-Content -Path $CopierSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$CopierExePath $CopierSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# staged payload copier build failed with exit code $LASTEXITCODE"
}
Require-Path $CopierExePath "TOS desktop staged payload copier exe"

@'
using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            return 2;
        }

        string installDir = NormalizePath(args[0]);
        StopMatchingProcesses("TOS", installDir);
        StopMatchingProcesses("electron", installDir);
        StopMatchingProcesses("tos-backend", installDir);
        return 0;
    }

    private static void StopMatchingProcesses(string processName, string installDir)
    {
        foreach (Process process in Process.GetProcessesByName(processName))
        {
            try
            {
                string modulePath = NormalizePath(process.MainModule.FileName);
                if (IsUnder(modulePath, installDir))
                {
                    process.Kill();
                    process.WaitForExit(5000);
                }
            }
            catch
            {
            }
        }
    }

    private static bool IsUnder(string path, string root)
    {
        if (path.Length == 0 || root.Length == 0)
        {
            return false;
        }
        string normalizedRoot = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return path.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePath(string value)
    {
        try
        {
            return string.IsNullOrWhiteSpace(value) ? string.Empty : Path.GetFullPath(value.Trim().Trim('"'));
        }
        catch
        {
            return string.Empty;
        }
    }
}
'@ | Set-Content -Path $CleanupSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$CleanupExePath $CleanupSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# cleanup helper build failed with exit code $LASTEXITCODE"
}
Require-Path $CleanupExePath "TOS desktop cleanup helper exe"

if (Test-Path -LiteralPath $PayloadArchivePath) {
  Assert-Under $PayloadArchivePath $OutputRoot
  Remove-Item -LiteralPath $PayloadArchivePath -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $PayloadRoot,
  $PayloadArchivePath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)
Require-Path $PayloadArchivePath "TOS desktop payload archive"
$PayloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $PayloadArchivePath).Hash.ToLowerInvariant()
$resolvedPayloadUrl = $PayloadUrl.Replace("{sha256}", $PayloadSha256)
$payloadUrlForNsis = $resolvedPayloadUrl.Replace('"', '%22')
$installerPathForNsis = $InstallerPath.Replace("\", "\\")
$downloaderForNsis = $DownloaderExePath.Replace("\", "\\")
$extractorForNsis = $ExtractorExePath.Replace("\", "\\")
$copierForNsis = $CopierExePath.Replace("\", "\\")
$cleanupForNsis = $CleanupExePath.Replace("\", "\\")

@"
Unicode true
SetCompressor /SOLID lzma
ManifestDPIAware true
RequestExecutionLevel user
AutoCloseWindow false
ShowInstDetails show

!include "MUI2.nsh"
!include "LogicLib.nsh"

!macro TOS_LOG TEXT
  FileOpen `$R9 "`$1" a
  FileWrite `$R9 "`$`{TEXT`}`$\r`$\n"
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
  StrCpy `$1 "`$TEMP\TOS-Desktop-Setup.log"
  StrCpy `$2 "`$TEMP\TOS-Desktop-Stage"
  Delete "`$1"
  !insertmacro TOS_LOG "start instdir=`$INSTDIR"
  !insertmacro TOS_LOG "stage=`$2"
  SetOutPath "`$PLUGINSDIR"
  File /oname=TOS-Desktop-Download.exe "$downloaderForNsis"
  File /oname=TOS-Desktop-Extract.exe "$extractorForNsis"
  File /oname=TOS-Desktop-Copy.exe "$copierForNsis"
  File /oname=TOS-Desktop-Cleanup.exe "$cleanupForNsis"

  DetailPrint "$StopDetail"
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Desktop-Cleanup.exe" "`$INSTDIR" >> "`$1" 2>&1"'
  Pop `$0
  !insertmacro TOS_LOG "cleanup exit=`$0"

  DetailPrint "$DownloadDetail"
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Desktop-Download.exe" "$payloadUrlForNsis" "`$PLUGINSDIR\TOS-Desktop-Payload.zip" "$PayloadSha256" >> "`$1" 2>&1"'
  Pop `$0
  !insertmacro TOS_LOG "download exit=`$0"
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$DownloadFailedMessage`$0"
    Abort
  `${EndIf}

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
  throw "NSIS build failed with exit code $LASTEXITCODE"
}

Require-Path $InstallerPath "TOS desktop NSIS installer"
$installer = Get-Item -LiteralPath $InstallerPath
$payload = Get-Item -LiteralPath $PayloadArchivePath
[PSCustomObject]@{
  ok = $true
  installerPath = $installer.FullName
  installerName = $InstallerName
  size = $installer.Length
  payloadPath = $payload.FullName
  payloadName = $PayloadArchiveName
  payloadSize = $payload.Length
  payloadSha256 = $PayloadSha256
  payloadUrl = $resolvedPayloadUrl
  builder = "NSIS"
} | ConvertTo-Json -Depth 3
