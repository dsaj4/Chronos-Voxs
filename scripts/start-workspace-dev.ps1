$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workspaceDir = Join-Path $repoRoot "frontend\workspace"
$url = "http://127.0.0.1:4173"
$port = 4173

function Test-PortListening {
  param([int]$TargetPort)

  try {
    Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction Stop | Select-Object -First 1 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Path (Join-Path $workspaceDir "package.json"))) {
  throw "Workspace package.json not found at $workspaceDir"
}

if (Test-PortListening -TargetPort $port) {
  Write-Host "Port $port is already in use. Opening $url ..." -ForegroundColor Yellow
  Start-Process $url | Out-Null
  exit 0
}

$needsInstall = -not (Test-Path (Join-Path $workspaceDir "node_modules"))
$cmdScript = if ($needsInstall) {
  'title Chronos-Vox Workspace Dev && cd /d "{0}" && npm.cmd install && npm.cmd run dev -- --host 127.0.0.1 --port 4173' -f $workspaceDir
} else {
  'title Chronos-Vox Workspace Dev && cd /d "{0}" && npm.cmd run dev -- --host 127.0.0.1 --port 4173' -f $workspaceDir
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $cmdScript | Out-Null

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
  Start-Sleep -Seconds 1

  if (-not (Test-PortListening -TargetPort $port)) {
    continue
  }

  try {
    Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch {
    continue
  }
}

Start-Process $url | Out-Null

if (-not $ready) {
  Write-Host "Dev server window started. If the page is not ready yet, wait a few seconds and refresh." -ForegroundColor Yellow
}
