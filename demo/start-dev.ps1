$ErrorActionPreference = 'Stop'
$demo = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $demo 'dev-bg.out.log'
$err = Join-Path $demo 'dev-bg.err.log'
$pidFile = Join-Path $demo '.dev.pid'

if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host 'Port 5173 already in use; skip start.'
    exit 0
}

$p = Start-Process node -ArgumentList @("$demo\node_modules\vite\bin\vite.js", '--host', '127.0.0.1') `
    -WorkingDirectory $demo -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err -PassThru

$p.Id | Out-File $pidFile
Write-Host "PickAI demo started in background (PID $($p.Id)) -> http://localhost:5173"
Write-Host "Logs: $out"
