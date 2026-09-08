$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Server = Join-Path $ProjectRoot "tests\meshtastic_cli_dashboard\server.py"
$Port = 8765

if (-not (Test-Path $Python)) {
  throw "未找到项目 Python：$Python"
}

if (-not (Test-Path $Server)) {
  throw "未找到 dashboard 服务：$Server"
}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Stop-Process -Id $_ -Force
  }
  Start-Sleep -Milliseconds 500
}

Set-Location $ProjectRoot
& $Python -B $Server $Port
