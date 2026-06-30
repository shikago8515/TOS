param(
  [string]$NodeExe = (Get-Command node.exe).Source,
  [string]$MakeNsis = "C:\Program Files (x86)\NSIS\Bin\makensis.exe",
  [string]$PayloadUrl = "https://ai.tomwell.net:56130/tos/automation-helper/payload/{sha256}"
)

$ErrorActionPreference = "Stop"

$ElectronDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ElectronDir
$HelperVersionPath = Join-Path $ElectronDir "automation-helper-version.json"
$ProductVersion = (Get-Content -LiteralPath $HelperVersionPath -Raw | ConvertFrom-Json).version
$OutputRoot = Join-Path $ElectronDir "dist-automation-helper"
$PayloadRoot = Join-Path $OutputRoot "payload"
$InstallerName = "TOS-Automation-Helper-Setup.$ProductVersion.exe"
$InstallerPath = Join-Path $OutputRoot $InstallerName
$PayloadArchiveName = "TOS-Automation-Helper-Payload.zip"
$PayloadArchivePath = Join-Path $OutputRoot $PayloadArchiveName
$NsiPath = Join-Path $OutputRoot "automation-helper.nsi"
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
Require-Path $MakeNsis "NSIS compiler"
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
$VerifierSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Verify.cs"
$VerifierExePath = Join-Path $OutputRoot "TOS-Automation-Helper-Verify.exe"
$DownloaderSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Download.cs"
$DownloaderExePath = Join-Path $OutputRoot "TOS-Automation-Helper-Download.exe"
$ExtractorSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Extract.cs"
$ExtractorExePath = Join-Path $OutputRoot "TOS-Automation-Helper-Extract.exe"
$CopierSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Copy.cs"
$CopierExePath = Join-Path $OutputRoot "TOS-Automation-Helper-Copy.exe"
$CleanupSourcePath = Join-Path $OutputRoot "TOS-Automation-Helper-Cleanup.cs"
$CleanupExePath = Join-Path $OutputRoot "TOS-Automation-Helper-Cleanup.exe"
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

            StopCompetingHelperProcesses(appHome);

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

            bool exited = process.WaitForExit(20000);
            if (exited && process.ExitCode != 0)
            {
                throw new InvalidOperationException("TOS automation helper failed to start. Please reinstall it or check the launcher log.");
            }

            if (ShouldNotify(args))
            {
                string message = exited
                    ? "TOS \u81ea\u52a8\u5316\u52a9\u624b\u5df2\u542f\u52a8\u3002\r\n\r\n\u8bf7\u8fd4\u56de\u6d4f\u89c8\u5668\u9875\u9762\uff0c\u70b9\u51fb\u201c\u91cd\u65b0\u68c0\u6d4b\u201d\u3002"
                    : "TOS \u81ea\u52a8\u5316\u52a9\u624b\u6b63\u5728\u540e\u53f0\u542f\u52a8\u3002\r\n\r\n\u8bf7\u8fd4\u56de\u6d4f\u89c8\u5668\u9875\u9762\uff0c\u70b9\u51fb\u201c\u91cd\u65b0\u68c0\u6d4b\u201d\u3002";
                MessageBox.Show(
                    message,
                    "TOS \u81ea\u52a8\u5316\u52a9\u624b",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
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

    private static void StopCompetingHelperProcesses(string currentAppHome)
    {
        int currentProcessId = Process.GetCurrentProcess().Id;
        StopHelperProcessesByName("node", currentProcessId);
        StopHelperProcessesByName("TOS-Automation-Helper", currentProcessId);
    }

    private static void StopHelperProcessesByName(string processName, int currentProcessId)
    {
        foreach (Process process in Process.GetProcessesByName(processName))
        {
            try
            {
                if (process.Id == currentProcessId)
                {
                    continue;
                }

                string modulePath = NormalizePath(process.MainModule == null ? null : process.MainModule.FileName);
                if (!LooksLikeAutomationHelperPath(modulePath))
                {
                    continue;
                }

                process.Kill();
                process.WaitForExit(5000);
            }
            catch
            {
                // Best effort only. If Windows denies access, the launcher start will surface the port conflict.
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static bool LooksLikeAutomationHelperPath(string value)
    {
        string path = NormalizePath(value);
        if (path.Length == 0)
        {
            return false;
        }

        return path.IndexOf(Path.DirectorySeparatorChar + "TOS-Automation-Helper" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) >= 0
            || path.EndsWith(Path.DirectorySeparatorChar + "TOS-Automation-Helper.exe", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePath(string value)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return Path.GetFullPath(value.Trim().Trim('"'));
        }
        catch
        {
            return string.Empty;
        }
    }

    private static bool ShouldNotify(string[] args)
    {
        if (args == null || args.Length == 0)
        {
            return true;
        }

        foreach (string rawArg in args)
        {
            string arg = (rawArg ?? string.Empty).Trim();
            if (arg.Equals("--notify", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            if (arg.Equals("--silent", StringComparison.OrdinalIgnoreCase) || arg.Equals("/silent", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            if (arg.StartsWith("tos:", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }
}
'@ | Set-Content -Path $LauncherSourcePath -Encoding ASCII

& $Csc /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /out:$LauncherExePath $LauncherSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# launcher build failed with exit code $LASTEXITCODE"
}
Require-Path $LauncherExePath "automation helper launcher exe"

@'
using System;
using System.IO;
using System.Security.Cryptography;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: verifier <file> <sha256>");
            return 2;
        }

        string filePath = args[0];
        string expected = Normalize(args[1]);
        if (!File.Exists(filePath))
        {
            Console.Error.WriteLine("File not found: " + filePath);
            return 3;
        }

        using (FileStream stream = File.OpenRead(filePath))
        using (SHA256 sha256 = SHA256.Create())
        {
            string actual = BitConverter.ToString(sha256.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
            {
                Console.Error.WriteLine("SHA256 mismatch. Expected " + expected + ", actual " + actual);
                return 1;
            }
        }

        return 0;
    }

    private static string Normalize(string value)
    {
        return (value ?? string.Empty).Trim().Replace("-", string.Empty).ToLowerInvariant();
    }
}
'@ | Set-Content -Path $VerifierSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$VerifierExePath $VerifierSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# payload verifier build failed with exit code $LASTEXITCODE"
}
Require-Path $VerifierExePath "automation helper payload verifier exe"

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
            Console.WriteLine("Payload download and verification completed.");
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
        try
        {
            ServicePointManager.SecurityProtocol = ServicePointManager.SecurityProtocol | (SecurityProtocolType)3072;
        }
        catch
        {
            // TLS 1.2 constant may be unavailable on very old frameworks.
        }

        string directory = Path.GetDirectoryName(outputPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (TryDownloadWithCurl(url, outputPath))
        {
            return;
        }

        DownloadWithHttpWebRequest(url, outputPath);
    }

    private static bool TryDownloadWithCurl(string url, string outputPath)
    {
        string curlPath = FindCurlPath();
        if (string.IsNullOrEmpty(curlPath))
        {
            Console.Error.WriteLine("curl.exe was not found; falling back to .NET downloader.");
            return false;
        }

        try
        {
            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = curlPath;
            info.Arguments =
                "--fail --location --silent --show-error --connect-timeout 20 --max-time 240 " +
                "--retry 2 --retry-delay 1 --output " + QuoteArgument(outputPath) + " " + QuoteArgument(url);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            using (Process process = Process.Start(info))
            {
                if (process == null)
                {
                    Console.Error.WriteLine("curl.exe did not start; falling back to .NET downloader.");
                    return false;
                }

                string stdout = process.StandardOutput.ReadToEnd();
                string stderr = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (!string.IsNullOrWhiteSpace(stdout))
                {
                    Console.WriteLine(stdout.Trim());
                }
                if (!string.IsNullOrWhiteSpace(stderr))
                {
                    Console.Error.WriteLine(stderr.Trim());
                }
                if (process.ExitCode == 0 && File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
                {
                    Console.WriteLine("Payload downloaded with curl.exe.");
                    return true;
                }

                throw new InvalidOperationException("Payload download failed with curl.exe exit code " + process.ExitCode + ".");
            }
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            Console.Error.WriteLine("curl.exe download failed: " + ex.Message + "; falling back to .NET downloader.");
        }

        try
        {
            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }
        }
        catch
        {
        }
        return false;
    }

    private static string FindCurlPath()
    {
        string systemCurl = Path.Combine(Environment.SystemDirectory, "curl.exe");
        if (File.Exists(systemCurl))
        {
            return systemCurl;
        }
        return "curl.exe";
    }

    private static string QuoteArgument(string value)
    {
        return "\"" + (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    private static void DownloadWithHttpWebRequest(string url, string outputPath)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
        request.UserAgent = "TOS-Automation-Helper-Setup/1.0";
        request.AllowAutoRedirect = true;
        request.KeepAlive = false;
        request.Timeout = 180000;
        request.ReadWriteTimeout = 180000;

        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        {
            int statusCode = (int)response.StatusCode;
            if (statusCode < 200 || statusCode >= 300)
            {
                throw new InvalidOperationException("Payload download failed, HTTP " + statusCode);
            }

            long totalBytes = response.ContentLength;
            long receivedBytes = 0;
            int lastPercent = -1;
            byte[] buffer = new byte[1024 * 128];

            using (Stream input = response.GetResponseStream())
            using (FileStream output = File.Create(outputPath))
            {
                if (input == null)
                {
                    throw new InvalidOperationException("Payload download stream is empty.");
                }

                while (true)
                {
                    int read = input.Read(buffer, 0, buffer.Length);
                    if (read <= 0)
                    {
                        break;
                    }

                    output.Write(buffer, 0, read);
                    receivedBytes += read;

                    if (totalBytes > 0)
                    {
                        int percent = (int)(receivedBytes * 100 / totalBytes);
                        if (percent != lastPercent && (percent == 100 || percent % 5 == 0))
                        {
                            Console.WriteLine("Download progress: " + percent + "%");
                            lastPercent = percent;
                        }
                    }
                }
            }

            if (totalBytes > 0 && receivedBytes != totalBytes)
            {
                throw new InvalidOperationException("Payload download incomplete: " + receivedBytes + "/" + totalBytes);
            }
        }
    }

    private static void VerifySha256(string filePath, string expected)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("Payload file not found.", filePath);
        }

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
Require-Path $DownloaderExePath "automation helper payload downloader exe"

@'
using System;
using System.IO;
using System.IO.Compression;

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
            ExtractZip(zipPath, targetDir);
            Console.WriteLine("Payload extraction completed.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static void ExtractZip(string zipPath, string targetDir)
    {
        string normalizedTarget = targetDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        using (ZipArchive archive = ZipFile.OpenRead(zipPath))
        {
            int index = 0;
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string destinationPath = Path.GetFullPath(Path.Combine(targetDir, entry.FullName));
                if (!destinationPath.StartsWith(normalizedTarget, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Unsafe zip entry: " + entry.FullName);
                }

                if (entry.FullName.EndsWith("/", StringComparison.Ordinal) || entry.FullName.EndsWith("\\", StringComparison.Ordinal))
                {
                    Directory.CreateDirectory(destinationPath);
                    continue;
                }

                string directory = Path.GetDirectoryName(destinationPath);
                if (!string.IsNullOrEmpty(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                entry.ExtractToFile(destinationPath, true);
                index++;
                if (index % 100 == 0)
                {
                    Console.WriteLine("Extracted files: " + index);
                }
            }
        }
    }
}
'@ | Set-Content -Path $ExtractorSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /out:$ExtractorExePath $ExtractorSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# payload extractor build failed with exit code $LASTEXITCODE"
}
Require-Path $ExtractorExePath "automation helper payload extractor exe"

@'
using System;
using System.IO;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: copier <source-dir> <target-dir>");
            return 2;
        }

        try
        {
            string sourceDir = Path.GetFullPath(args[0]);
            string targetDir = Path.GetFullPath(args[1]);
            if (!Directory.Exists(sourceDir))
            {
                throw new DirectoryNotFoundException("Source directory not found: " + sourceDir);
            }

            int copied = CopyDirectory(sourceDir, targetDir);
            Console.WriteLine("Copied files: " + copied);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static int CopyDirectory(string sourceDir, string targetDir)
    {
        Directory.CreateDirectory(targetDir);
        foreach (string directory in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
        {
            string relative = directory.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            Directory.CreateDirectory(Path.Combine(targetDir, relative));
        }

        int copied = 0;
        foreach (string file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
        {
            string relative = file.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string targetPath = Path.Combine(targetDir, relative);
            string targetParent = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrEmpty(targetParent))
            {
                Directory.CreateDirectory(targetParent);
            }
            File.Copy(file, targetPath, true);
            copied++;
            if (copied % 100 == 0)
            {
                Console.WriteLine("Copied files: " + copied);
            }
        }
        return copied;
    }
}
'@ | Set-Content -Path $CopierSourcePath -Encoding ASCII

& $Csc /nologo /target:exe /platform:anycpu /out:$CopierExePath $CopierSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "C# staged payload copier build failed with exit code $LASTEXITCODE"
}
Require-Path $CopierExePath "automation helper staged payload copier exe"

@'
using System;
using System.Diagnostics;
using System.IO;
using System.Net;

internal static class Program
{
    private const int AutomationRunningExitCode = 10;

    private static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            return 2;
        }

        string installDir = NormalizePath(args[0]);
        bool force = HasArg(args, "--force");
        if (installDir.Length == 0)
        {
            return 2;
        }

        if (!force && HasRunningAutomationRisk())
        {
            Console.Error.WriteLine("TOS automation appears to be running. Refusing to stop helper without explicit confirmation.");
            return AutomationRunningExitCode;
        }

        StopMatchingProcesses("TOS-Automation-Helper");
        StopMatchingProcesses("node");
        return 0;
    }

    private static bool HasArg(string[] args, string expected)
    {
        foreach (string rawArg in args)
        {
            if (string.Equals((rawArg ?? string.Empty).Trim(), expected, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static bool HasRunningAutomationRisk()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3210/health");
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream))
            {
                string body = reader.ReadToEnd();
                if (ExtractJsonNumber(body, "trackedAppCount") > 0)
                {
                    return true;
                }
                if (body.IndexOf("\"busy\": true", StringComparison.OrdinalIgnoreCase) >= 0
                    || body.IndexOf("\"activeRun\":", StringComparison.OrdinalIgnoreCase) >= 0
                    || ExtractJsonNumber(body, "activeRunCount") > 0)
                {
                    return true;
                }
            }
        }
        catch
        {
            // If no helper is listening, there is no running automation risk to block install.
        }
        return false;
    }

    private static int ExtractJsonNumber(string body, string propertyName)
    {
        if (string.IsNullOrEmpty(body) || string.IsNullOrEmpty(propertyName))
        {
            return 0;
        }

        string marker = "\"" + propertyName + "\"";
        int index = body.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return 0;
        }

        int colon = body.IndexOf(':', index + marker.Length);
        if (colon < 0)
        {
            return 0;
        }

        int cursor = colon + 1;
        while (cursor < body.Length && char.IsWhiteSpace(body[cursor]))
        {
            cursor++;
        }

        int start = cursor;
        while (cursor < body.Length && char.IsDigit(body[cursor]))
        {
            cursor++;
        }

        if (cursor <= start)
        {
            return 0;
        }

        int value;
        return int.TryParse(body.Substring(start, cursor - start), out value) ? value : 0;
    }

    private static void StopMatchingProcesses(string processName)
    {
        foreach (Process process in Process.GetProcessesByName(processName))
        {
            try
            {
                string modulePath = NormalizePath(process.MainModule.FileName);
                if (LooksLikeAutomationHelperPath(modulePath))
                {
                    Console.WriteLine("Stopping " + process.ProcessName + " (" + process.Id + "): " + modulePath);
                    process.Kill();
                    process.WaitForExit(5000);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Skip process " + processName + ": " + ex.Message);
            }
        }
    }

    private static bool LooksLikeAutomationHelperPath(string value)
    {
        string path = NormalizePath(value);
        if (path.Length == 0)
        {
            return false;
        }

        return path.IndexOf(Path.DirectorySeparatorChar + "TOS-Automation-Helper" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) >= 0
            || path.EndsWith(Path.DirectorySeparatorChar + "TOS-Automation-Helper.exe", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePath(string value)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }
            return Path.GetFullPath(value.Trim().Trim('"'));
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
Require-Path $CleanupExePath "automation helper cleanup exe"

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
Require-Path $PayloadArchivePath "automation helper payload archive"
$PayloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $PayloadArchivePath).Hash.ToLowerInvariant()

function U([string]$Hex) {
  -join (($Hex -split " ") | Where-Object { $_ } | ForEach-Object { [char][Convert]::ToInt32($_, 16) })
}

$nsisAppName = U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisWelcomeTitle = U "5b89 88c5 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisRunText = U "7acb 5373 542f 52a8 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisStartShortcut = U "542f 52a8 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisUninstallShortcut = U "5378 8f7d 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisFinishTitle = U "5b89 88c5 5b8c 6210"
$nsisFinishText = U "0054 004f 0053 0020 81ea 52a8 5316 52a9 624b 5df2 5b89 88c5 6210 529f ff0c 5e76 5df2 6ce8 518c 6d4f 89c8 5668 542f 52a8 5165 53e3 3002 8bf7 8fd4 56de 7f51 9875 70b9 51fb 201c 91cd 65b0 68c0 6d4b 201d 3002"
$nsisFinishRunText = U "7acb 5373 542f 52a8 0020 0054 004f 0053 0020 81ea 52a8 5316 52a9 624b"
$nsisDownloadFailedPrefix = U "4e0b 8f7d 81ea 52a8 5316 52a9 624b 6587 4ef6 5931 8d25 ff0c 8fd4 56de ff1a"
$nsisVerifyFailed = U "81ea 52a8 5316 52a9 624b 6587 4ef6 6821 9a8c 5931 8d25 ff0c 53ef 80fd 662f 4e0b 8f7d 4e0d 5b8c 6574 3002 8bf7 91cd 65b0 8fd0 884c 5b89 88c5 5305 3002"
$nsisExtractFailedPrefix = U "81ea 52a8 5316 52a9 624b 89e3 538b 5931 8d25 ff0c 9519 8bef 7801 ff1a"
$nsisInstallIncomplete = U "5b89 88c5 6587 4ef6 4e0d 5b8c 6574 ff0c 8bf7 91cd 65b0 8fd0 884c 5b89 88c5 5305 3002"
$nsisRunningAutomationWarning = U "68c0 6d4b 5230 672c 673a 53ef 80fd 6709 0020 0054 004f 0053 0020 81ea 52a8 5316 4efb 52a1 6b63 5728 8fd0 884c 3002 7ee7 7eed 5b89 88c5 4f1a 505c 6b62 5f53 524d 5c0f 52a9 624b 548c 6267 884c 5668 ff0c 6b63 5728 8fd0 884c 7684 6d4f 89c8 5668 6d41 7a0b 3001 4e0b 8f7d 6587 4ef6 6216 6267 884c 8bb0 5f55 53ef 80fd 4e2d 65ad 3002 5efa 8bae 7b49 5f85 4efb 52a1 5b8c 6210 540e 518d 66f4 65b0 3002 662f 5426 4ecd 8981 7ee7 7eed ff1f"

$payloadDirForNsis = $PayloadRoot.Replace("\", "\\")
$verifierForNsis = $VerifierExePath.Replace("\", "\\")
$downloaderForNsis = $DownloaderExePath.Replace("\", "\\")
$extractorForNsis = $ExtractorExePath.Replace("\", "\\")
$copierForNsis = $CopierExePath.Replace("\", "\\")
$cleanupForNsis = $CleanupExePath.Replace("\", "\\")
$installerPathForNsis = $InstallerPath.Replace("\", "\\")
$resolvedPayloadUrl = $PayloadUrl.Replace("{sha256}", $PayloadSha256)
$payloadUrlForNsis = $resolvedPayloadUrl.Replace('"', '%22')
@"
Unicode true
SetCompressor /SOLID lzma
ManifestDPIAware true
RequestExecutionLevel user
AutoCloseWindow false
ShowInstDetails show

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "$nsisAppName"
OutFile "$installerPathForNsis"
InstallDir "`$LOCALAPPDATA\TOS-Automation-Helper"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "InstallLocation"
BrandingText "TOS Workstation"

!define MUI_ABORTWARNING
!define MUI_ICON "`$`{NSISDIR`}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "`$`{NSISDIR`}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEPAGE_TITLE "$nsisWelcomeTitle"
!define MUI_FINISHPAGE_TITLE "$nsisFinishTitle"
!define MUI_FINISHPAGE_TEXT "$nsisFinishText"
!define MUI_FINISHPAGE_RUN "`$INSTDIR\TOS-Automation-Helper.exe"
!define MUI_FINISHPAGE_RUN_TEXT "$nsisFinishRunText"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "$nsisAppName" SecMain
  SetShellVarContext current
  InitPluginsDir
  StrCpy `$1 "`$TEMP\TOS-Automation-Helper-Setup.log"
  StrCpy `$2 "`$TEMP\TOS-Automation-Helper-Stage"
  Delete "`$1"
  SetOutPath "`$PLUGINSDIR"
  File /oname=TOS-Automation-Helper-Cleanup.exe "$cleanupForNsis"
  File /oname=TOS-Automation-Helper-Verify.exe "$verifierForNsis"
  File /oname=TOS-Automation-Helper-Download.exe "$downloaderForNsis"
  File /oname=TOS-Automation-Helper-Extract.exe "$extractorForNsis"
  File /oname=TOS-Automation-Helper-Copy.exe "$copierForNsis"

  DetailPrint "Stopping old helper..."
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Automation-Helper-Cleanup.exe" "`$INSTDIR" >> "`$1" 2>&1"'
  Pop `$0
  `${If} `$0 == 10
    MessageBox MB_ICONEXCLAMATION|MB_YESNO "$nsisRunningAutomationWarning" IDYES continue_helper_cleanup IDNO abort_helper_cleanup
    continue_helper_cleanup:
      nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Automation-Helper-Cleanup.exe" "`$INSTDIR" --force >> "`$1" 2>&1"'
      Pop `$0
      Goto helper_cleanup_done
    abort_helper_cleanup:
      Abort
  `${EndIf}
  helper_cleanup_done:
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$nsisExtractFailedPrefix`$0"
    Abort
  `${EndIf}

  SetOutPath "`$INSTDIR"
  DetailPrint "Cleaning old files..."
  RMDir /r "`$INSTDIR\automation-apps"
  RMDir /r "`$INSTDIR\automation-launcher"
  RMDir /r "`$INSTDIR\node"
  Delete "`$INSTDIR\automation-apps.7z"
  Delete "`$INSTDIR\TOS-Automation-Helper-Payload.7z"
  Delete "`$INSTDIR\TOS-Automation-Helper-Payload.zip"
  Delete "`$INSTDIR\7za.exe"
  Delete "`$INSTDIR\TOS-Automation-Helper.exe"

  DetailPrint "Downloading and verifying automation helper payload..."
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Automation-Helper-Download.exe" "$payloadUrlForNsis" "`$PLUGINSDIR\TOS-Automation-Helper-Payload.zip" "$PayloadSha256" >> "`$1" 2>&1"'
  Pop `$0
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$nsisDownloadFailedPrefix`$0"
    Abort
  `${EndIf}

  DetailPrint "Extracting automation helper files to staging..."
  RMDir /r "`$2"
  CreateDirectory "`$2"
  nsExec::ExecToLog 'cmd /c ""`$PLUGINSDIR\TOS-Automation-Helper-Extract.exe" "`$PLUGINSDIR\TOS-Automation-Helper-Payload.zip" "`$2" >> "`$1" 2>&1"'
  Pop `$0
  `${If} `$0 != 0
    MessageBox MB_ICONSTOP "$nsisExtractFailedPrefix`$0"
    Abort
  `${EndIf}

  DetailPrint "Copying staged helper files..."
  SetOutPath "`$INSTDIR"
  nsExec::ExecToLog 'cmd /c robocopy "`$2" "`$INSTDIR" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >> "`$1" 2>&1'
  Pop `$0
  `${If} `$0 > 7
    MessageBox MB_ICONSTOP "$nsisExtractFailedPrefix`$0"
    Abort
  `${EndIf}

  IfFileExists "`$INSTDIR\TOS-Automation-Helper.exe" +2 0
    Goto install_incomplete
  IfFileExists "`$INSTDIR\node\node.exe" +2 0
    Goto install_incomplete
  IfFileExists "`$INSTDIR\automation-launcher\bootstrap.js" +2 0
    Goto install_incomplete
  IfFileExists "`$INSTDIR\automation-apps\registry.json" +2 0
    Goto install_incomplete
  IfFileExists "`$INSTDIR\automation-apps\shipping-automation-demo\bin\start.js" +2 0
    Goto install_incomplete
  Goto install_complete

  install_incomplete:
    MessageBox MB_ICONSTOP "$nsisInstallIncomplete"
    Abort

  install_complete:

  SetOutPath "`$INSTDIR"

  DetailPrint "Registering browser protocol..."
  WriteRegStr HKCU "Software\Classes\tos" "" "URL:TOS Automation Launcher"
  WriteRegStr HKCU "Software\Classes\tos" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\tos\DefaultIcon" "" '"`$INSTDIR\TOS-Automation-Helper.exe",0'
  WriteRegStr HKCU "Software\Classes\tos\shell\open\command" "" '"`$INSTDIR\TOS-Automation-Helper.exe" "%1"'

  DetailPrint "Writing startup and uninstall registry..."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TOSAutomationLauncher" '"`$INSTDIR\TOS-Automation-Helper.exe" --silent'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "DisplayName" "TOS Automation Helper"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "DisplayVersion" "$ProductVersion"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "Publisher" "TOS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "InstallLocation" "`$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "UninstallString" '"`$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "QuietUninstallString" '"`$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper" "NoRepair" 1

  DetailPrint "Creating shortcuts..."
  CreateDirectory "`$SMPROGRAMS\TOS Automation Helper"
  CreateShortcut "`$SMPROGRAMS\TOS Automation Helper\$nsisStartShortcut.lnk" "`$INSTDIR\TOS-Automation-Helper.exe"
  CreateShortcut "`$SMPROGRAMS\TOS Automation Helper\$nsisUninstallShortcut.lnk" "`$INSTDIR\Uninstall.exe"

  WriteUninstaller "`$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /F /IM TOS-Automation-Helper.exe /T'
  DeleteRegKey HKCU "Software\Classes\tos"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TOSAutomationLauncher"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TOSAutomationHelper"
  Delete "`$SMPROGRAMS\TOS Automation Helper\$nsisStartShortcut.lnk"
  Delete "`$SMPROGRAMS\TOS Automation Helper\$nsisUninstallShortcut.lnk"
  RMDir "`$SMPROGRAMS\TOS Automation Helper"
  RMDir /r "`$INSTDIR"
SectionEnd
"@ | Set-Content -Path $NsiPath -Encoding UTF8

& $MakeNsis /V2 /INPUTCHARSET UTF8 $NsiPath
if ($LASTEXITCODE -ne 0) {
  throw "NSIS build failed with exit code $LASTEXITCODE"
}

Require-Path $InstallerPath "automation helper NSIS installer"
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
