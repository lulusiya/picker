$demo = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $demo '.dev.pid'

if (Test-Path $pidFile) {
    $id = Get-Content $pidFile
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host 'PickAI demo stopped.'
