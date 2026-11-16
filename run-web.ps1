$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$serverReady = $false
try {
  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
  $serverReady = $response.StatusCode -eq 200 -and $response.Content.Contains('오늘도 완식')
} catch { }

if (-not $serverReady) {
  Write-Host 'Starting Clean Plate Today server...'
  Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $projectRoot
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) { throw 'The app server did not start on port 3000.' }
} else {
  Write-Host 'Using the server already running on port 3000.'
}

$chromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) {
  $chromeCommand = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($chromeCommand) { $chrome = $chromeCommand.Source }
}
if (-not $chrome) { throw 'Google Chrome was not found. Install Chrome and run this file again.' }

Start-Process -FilePath $chrome -ArgumentList 'http://127.0.0.1:3000/'
