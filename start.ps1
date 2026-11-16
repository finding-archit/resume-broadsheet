# Start backend and frontend together on Windows (PowerShell).
# Usage: .\start.ps1                     (backend on 8000)
#        .\start.ps1 -BackendPort 8010   (if port 8000 is already in use)
param([int]$BackendPort = 8000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    Write-Error 'Backend virtualenv missing. Run the installation steps in README.md first.'
}
if (-not (Test-Path (Join-Path $root 'frontend\node_modules'))) {
    Write-Error "Frontend dependencies missing. Run 'npm install' in frontend\ first."
}

$backend = Start-Process -FilePath $python -WorkingDirectory (Join-Path $root 'backend') `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $BackendPort `
    -PassThru -NoNewWindow
try {
    Write-Host "Backend:  http://127.0.0.1:$BackendPort  (API docs: http://127.0.0.1:$BackendPort/docs)"
    Write-Host 'Frontend: http://127.0.0.1:5173'
    $env:BACKEND_URL = "http://127.0.0.1:$BackendPort"
    Push-Location (Join-Path $root 'frontend')
    npx vite --host 127.0.0.1 --port 5173
}
finally {
    Pop-Location
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id }
}
