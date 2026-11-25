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

  # The server script runs detached, so a dropped connection can't stop it halfway through the switch.
  $base = '/root/fixzy-update-server'
  $start = "sed -i 's/\r$//' $base.sh && rm -f $base.exit && (nohup sh -c 'bash $base.sh > $base.log 2>&1; echo `$? > $base.exit' > /dev/null 2>&1 &)"
  ssh @auth $server $start
  if ($LASTEXITCODE -ne 0) { throw 'Could not start the update. Check the site before trying again.' }

  Write-Host 'Building on the server. This can take a few minutes...'
  $wait = "for i in `$(seq 1 300); do [ -f $base.exit ] && break; sleep 3; done; cat $base.log; test -f $base.exit || exit 75; exit `$(cat $base.exit)"
  foreach ($try in 1..3) {
    ssh @auth -o ServerAliveInterval=15 $server $wait
    if ($LASTEXITCODE -ne 255) { break }
    Write-Host 'Connection dropped. The update is still running on the server; reconnecting...'
  }
  if ($LASTEXITCODE -ne 0) { throw "Update did not finish cleanly. Check the site, and read $base.log on the server." }
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
