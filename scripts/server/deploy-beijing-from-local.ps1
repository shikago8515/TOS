#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RemoteHost = "218.240.184.58",
  [string]$RemoteUser = "tosadmin",
  [string]$RemoteSourceDir = "/home/tosadmin/TOS-source",
  [string]$RemoteDeployDir = "/home/tosadmin/TOS",
  [switch]$DryRun,
  [switch]$SkipFetch,
  [switch]$NoCache
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "[deploy-beijing] $Message"
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Resolve-NpmCommand {
  param([string]$RepoRoot)

  $repoNodeModules = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot "node_modules"))
  $npmCmdCandidates = @(Get-Command npm.cmd -All -ErrorAction SilentlyContinue)
  foreach ($candidate in $npmCmdCandidates) {
    $candidatePath = [System.IO.Path]::GetFullPath($candidate.Source)
    if (-not $candidatePath.StartsWith($repoNodeModules, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $candidatePath
    }
  }

  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if ($null -eq $npmCommand) {
    throw "Missing required command: npm"
  }
  return $npmCommand.Source
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [string[]]$Arguments = @(),
    [string]$InputText = $null
  )

  Write-Host ("> {0} {1}" -f $File, ($Arguments -join " "))
  if ($null -eq $InputText) {
    & $File @Arguments
  } else {
    $InputText | & $File @Arguments
  }

  if ($LASTEXITCODE -ne 0) {
    throw "$File failed with exit code $LASTEXITCODE"
  }
}

function Get-GitOutput {
  param([string[]]$Arguments)
  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
  return (($output | Out-String).Trim())
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

foreach ($commandName in @("git", "ssh", "scp")) {
  Require-Command $commandName
}
$npmCommand = Resolve-NpmCommand -RepoRoot $repoRoot

$remoteTarget = "${RemoteUser}@${RemoteHost}"
$remoteReleaseDir = "$RemoteSourceDir/release/server"
$remoteUploadsDir = "$RemoteDeployDir/.deploy_uploads"
$dockerNoCache = if ($NoCache) { "1" } else { "0" }

Write-Step "Checking local Git state"
Invoke-External -File git -Arguments @("status", "--short", "--branch")

$branch = Get-GitOutput @("branch", "--show-current")
if ($branch -ne "main") {
  throw "Refusing to deploy Beijing from branch '$branch'. Switch to main and align it with gitea/main first."
}

$dirtyStatus = & git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status --porcelain failed with exit code $LASTEXITCODE"
}
if (($dirtyStatus | Measure-Object).Count -gt 0) {
  if ($DryRun) {
    Write-Warning "Working tree is dirty. Dry-run will continue, but real deployment requires a clean worktree."
  } else {
    Write-Host ($dirtyStatus -join [Environment]::NewLine)
    throw "Refusing to create a formal server package from a dirty worktree."
  }
}

if (-not $SkipFetch) {
  Write-Step "Fetching Gitea main"
  Invoke-External -File git -Arguments @("fetch", "gitea", "main", "--prune")
}

if ($DryRun) {
  Write-Host "> git merge --ff-only gitea/main"
  Write-Host "DRY-RUN: skipped local fast-forward merge."
} else {
  Write-Step "Fast-forwarding local main to gitea/main"
  Invoke-External -File git -Arguments @("merge", "--ff-only", "gitea/main")
}

$head = Get-GitOutput @("rev-parse", "HEAD")
$giteaMain = Get-GitOutput @("rev-parse", "gitea/main")
if ($head -ne $giteaMain) {
  $message = "Local HEAD ($head) does not match gitea/main ($giteaMain)."
  if ($DryRun) {
    Write-Warning $message
  } else {
    throw "$message Push or fast-forward main before deploying."
  }
}

Write-Step "Running server package checks"
Invoke-External -File $npmCommand -Arguments @("run", "test:server-package")
Invoke-External -File $npmCommand -Arguments @("run", "server:package:dry-run")

if ($DryRun) {
  Write-Step "Dry-run complete"
  Write-Host "Would create package with: npm run server:package"
  Write-Host "Would upload package to: ${remoteTarget}:$remoteReleaseDir/"
  Write-Host "Would apply package from: $remoteUploadsDir"
  exit 0
}

Write-Step "Creating standard server update package"
Invoke-External -File $npmCommand -Arguments @("run", "server:package")

$releaseDir = Join-Path $repoRoot "release\server"
$package = Get-ChildItem $releaseDir -Filter "tos-server-update-*.tar.gz" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -eq $package) {
  throw "No server package found in $releaseDir"
}

Write-Step "Preparing remote package directories"
$prepareRemoteScript = @'
set -euo pipefail
REMOTE_RELEASE_DIR="$1"
REMOTE_DEPLOY_DIR="$2"
mkdir -p "$REMOTE_RELEASE_DIR" "$REMOTE_DEPLOY_DIR/.deploy_uploads"
test -f "$REMOTE_DEPLOY_DIR/docker-compose.tos.yml" || {
  echo "Missing deployment compose file: $REMOTE_DEPLOY_DIR/docker-compose.tos.yml" >&2
  exit 1
}
'@
Invoke-External -File ssh -Arguments @($remoteTarget, "bash", "-s", "--", $remoteReleaseDir, $RemoteDeployDir) -InputText $prepareRemoteScript

Write-Step "Uploading $($package.Name) to Beijing server source release directory"
Invoke-External -File scp -Arguments @($package.FullName, "${remoteTarget}:$remoteReleaseDir/")

Write-Step "Applying package on Beijing server"
$applyRemoteScript = @'
set -euo pipefail
PACKAGE_NAME="$1"
REMOTE_SOURCE_DIR="$2"
REMOTE_DEPLOY_DIR="$3"
DOCKER_NO_CACHE="$4"

SOURCE_PKG="$REMOTE_SOURCE_DIR/release/server/$PACKAGE_NAME"
UPLOAD_PKG="$REMOTE_DEPLOY_DIR/.deploy_uploads/$PACKAGE_NAME"
DEPLOY_ID="$(date +%Y%m%d%H%M%S)"
WORK="$REMOTE_DEPLOY_DIR/.deploy_uploads/work/$DEPLOY_ID"

test -f "$SOURCE_PKG" || { echo "Missing package: $SOURCE_PKG" >&2; exit 1; }
test -f "$REMOTE_DEPLOY_DIR/docker-compose.tos.yml" || {
  echo "Missing deployment compose file: $REMOTE_DEPLOY_DIR/docker-compose.tos.yml" >&2
  exit 1
}

mkdir -p "$REMOTE_DEPLOY_DIR/.deploy_uploads" "$REMOTE_DEPLOY_DIR/.deploy_uploads/work"
cp -f "$SOURCE_PKG" "$UPLOAD_PKG"
rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$UPLOAD_PKG" -C "$WORK"

cd "$REMOTE_DEPLOY_DIR"
TOS_DOCKER_NO_CACHE="$DOCKER_NO_CACHE" PKG="$PWD/.deploy_uploads/$PACKAGE_NAME" DEPLOY_ID="$DEPLOY_ID" TOS_ROOT="$PWD" bash "$WORK/deploy/apply-server-update.sh"

sudo docker compose -f docker-compose.tos.yml ps
if ! curl -fsSI http://127.0.0.1/tos/ >/dev/null; then
  curl -fsSI http://127.0.0.1:18080/ >/dev/null
fi
if ! curl -fsS http://127.0.0.1/tos/desktop-api/health; then
  curl -fsS http://127.0.0.1:18000/
fi

echo "Deployed $PACKAGE_NAME with deployId=$DEPLOY_ID"
'@
Invoke-External -File ssh -Arguments @($remoteTarget, "bash", "-s", "--", $package.Name, $RemoteSourceDir, $RemoteDeployDir, $dockerNoCache) -InputText $applyRemoteScript

Write-Step "Done"
Write-Host "Package kept on Beijing server: $remoteReleaseDir/$($package.Name)"
