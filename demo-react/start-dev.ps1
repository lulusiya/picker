$ErrorActionPreference = 'Stop'
$demo = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $demo 'dev-bg.out.log'
$err = Join-Path $demo 'dev-bg.err.log'
$pidFile = Join-Path $demo '.dev.pid'
$port = 5174

if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Port $port already in use; skip start."
    exit 0
}

$p = Start-Process node -ArgumentList @("$demo\node_modules\vite\bin\vite.js", '--host', '127.0.0.1', '--port', "$port") `
    -WorkingDirectory $demo -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err -PassThru

$p.Id | Out-File $pidFile
Write-Host "Picker React demo started in background (PID $($p.Id)) -> http://localhost:$port"
Write-Host "Logs: $out"
