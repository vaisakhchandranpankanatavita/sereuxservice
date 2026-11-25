# Run from your PC to put the latest committed Fixzy code on the server (websites, admin and API).
# Uses the deploy key if it exists; otherwise ssh asks for the server password (twice).
$ErrorActionPreference = 'Stop'
$server = 'root@145.223.18.106'
Set-Location (Split-Path $PSScriptRoot -Parent)

# Only these are uploaded, so signing keys, APKs, local settings and videos never leave this PC.
$paths = 'backend', 'admin', 'src', 'assets', 'shell.html', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'scripts-vercel.mjs'

$changes = git status --porcelain -- @paths deploy
if ($changes) {
  Write-Host 'These changes are not committed. Commit them first, then run this again:'
  $changes
  exit 1
}

$key = "$HOME\.ssh\worksuite_deploy"
$auth = @()
if (Test-Path $key) { $auth = @('-i', $key) }

$work = Join-Path $env:TEMP "fixzy-update-$PID"
New-Item -ItemType Directory -Force $work | Out-Null
try {
  git archive --format=tar.gz -o "$work\fixzy-update.tar.gz" HEAD -- @paths
  if ($LASTEXITCODE -ne 0) { throw 'Could not package the code.' }
  Copy-Item "$PSScriptRoot\update-server.sh" "$work\fixzy-update-server.sh"

  Write-Host "Uploading commit $(git rev-parse --short HEAD) from branch $(git branch --show-current)..."
  scp @auth "$work\fixzy-update.tar.gz" "$work\fixzy-update-server.sh" "${server}:/root/"
  if ($LASTEXITCODE -ne 0) { throw 'Upload failed. The live site was not changed.' }

  ssh @auth -o ServerAliveInterval=15 $server "sed -i 's/\r$//' /root/fixzy-update-server.sh && bash /root/fixzy-update-server.sh"
  if ($LASTEXITCODE -ne 0) { throw 'Update did not finish. Read the messages above.' }
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
