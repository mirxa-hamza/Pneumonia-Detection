[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot "frontend"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"
$npmExe = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
$runtimeDir = Join-Path $projectRoot ".runtime"
$apiProcess = $null
$frontendProcess = $null

function Wait-ForPort([int]$Port, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect("127.0.0.1", $Port)
            return $true
        } catch {
            Start-Sleep -Milliseconds 350
        } finally {
            $client.Dispose()
        }
    }
    return $false
}

if (-not (Test-Path (Join-Path $projectRoot "artifacts\best_model.pt"))) {
    throw "Missing artifacts\best_model.pt. Add the trained Kaggle model before starting the project."
}

if (-not (Test-Path $pythonExe)) {
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $pyLauncher) { throw "Python was not found. Install Python 3.10+ and run this command again." }
    & $pyLauncher.Source -m venv (Join-Path $projectRoot ".venv")
    & $pythonExe -m pip install --upgrade pip
    # Serving does not need the training-only analytics and Gradio packages.
    & $pythonExe -m pip install -r (Join-Path $projectRoot "requirements-api.txt")
}

if (-not $npmExe) { throw "Node.js and npm are required. Install Node.js 20.9+ and run this command again." }
if (-not (Test-Path (Join-Path $frontendRoot "node_modules"))) {
    Push-Location $frontendRoot
    try { & $npmExe install } finally { Pop-Location }
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
try {
    $apiProcess = Start-Process -FilePath $pythonExe -WorkingDirectory $projectRoot -PassThru -NoNewWindow `
        -ArgumentList "-m", "uvicorn", "src.api:app", "--host", "127.0.0.1", "--port", "8000" `
        -RedirectStandardOutput (Join-Path $runtimeDir "api.log") -RedirectStandardError (Join-Path $runtimeDir "api-error.log")
    if (-not (Wait-ForPort 8000 30)) {
        throw "The model API did not start. See .runtime\api-error.log for details."
    }

    $frontendProcess = Start-Process -FilePath "cmd.exe" -WorkingDirectory $frontendRoot -PassThru -NoNewWindow `
        -ArgumentList "/d", "/c", "`"$npmExe`" run dev -- --hostname 127.0.0.1" `
        -RedirectStandardOutput (Join-Path $runtimeDir "frontend.log") -RedirectStandardError (Join-Path $runtimeDir "frontend-error.log")
    if (-not (Wait-ForPort 3000 45)) {
        throw "The frontend did not start. See .runtime\frontend-error.log for details."
    }

    Write-Host "PneumoScan is running at http://127.0.0.1:3000" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the frontend and API."
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:3000" }
    Wait-Process -Id $frontendProcess.Id
} finally {
    if ($frontendProcess -and -not $frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id -Force }
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
}
