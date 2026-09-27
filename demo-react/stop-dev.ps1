$demo = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $demo '.dev.pid'
$port = 5174

if (Test-Path $pidFile) {
    $id = Get-Content $pidFile
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host 'Picker React demo stopped.'
