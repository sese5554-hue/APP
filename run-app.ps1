param(
  [ValidateSet('chrome')]
  [string]$Target = 'chrome'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host '1/4 Checking backend packages...'
if (-not (Test-Path (Join-Path $projectRoot 'node_modules\express'))) {
  & npm.cmd install --cache (Join-Path $projectRoot '.npm-cache')
  if ($LASTEXITCODE -ne 0) { throw 'Could not install backend packages.' }
}

if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
  Copy-Item (Join-Path $projectRoot '.env.example') (Join-Path $projectRoot '.env')
  Write-Warning 'Created .env. The Flutter screen will still open, but API data needs a running MariaDB.'
}

Write-Host '2/4 Starting backend...'
$existingServer = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $existingServer) {
  Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $projectRoot
  Start-Sleep -Seconds 2
} else {
  Write-Host 'A server is already listening on port 3000.'
}

if (-not (Test-Path (Join-Path $projectRoot 'web\index.html'))) {
  Write-Host '3/4 Creating Flutter web support...'
  & flutter create --platforms=web --no-pub .
  if ($LASTEXITCODE -ne 0) { throw 'Could not create Flutter web support. Check Flutter SDK write access.' }
}

Write-Host '4/4 Opening the app in Chrome...'
& flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'Could not get Flutter packages.' }

& flutter run -d chrome --web-hostname 127.0.0.1 --dart-define=API_BASE_URL=http://localhost:3000
exit $LASTEXITCODE
