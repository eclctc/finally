# Build (if needed) and run the FinAlly container.
# Usage: scripts\start_windows.ps1 [-Build] [-NoOpen]
param(
    [switch]$Build,
    [switch]$NoOpen
)
$ErrorActionPreference = "Stop"

$Image = if ($env:FINALLY_IMAGE) { $env:FINALLY_IMAGE } else { "finally" }
$Container = if ($env:FINALLY_CONTAINER) { $env:FINALLY_CONTAINER } else { "finally" }
$Port = if ($env:FINALLY_PORT) { $env:FINALLY_PORT } else { "8000" }
$Volume = if ($env:FINALLY_VOLUME) { $env:FINALLY_VOLUME } else { "finally-data" }
$RootDir = Split-Path -Parent $PSScriptRoot
$Url = "http://localhost:$Port"

docker image inspect $Image *> $null
if ($Build -or $LASTEXITCODE -ne 0) {
    Write-Host "Building image $Image..."
    docker build -t $Image $RootDir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$Running = docker ps -q --filter "name=^$Container$"
if ($Running -and -not $Build) {
    Write-Host "FinAlly is already running."
} else {
    docker rm -f $Container *> $null
    $RunArgs = @("run", "-d", "--name", $Container, "-p", "${Port}:8000", "-v", "${Volume}:/app/db")
    $EnvFile = Join-Path $RootDir ".env"
    if (Test-Path $EnvFile) { $RunArgs += @("--env-file", $EnvFile) }
    $RunArgs += $Image
    docker @RunArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "FinAlly started."
}

Write-Host "Open $Url"
if (-not $NoOpen) { Start-Process $Url }
