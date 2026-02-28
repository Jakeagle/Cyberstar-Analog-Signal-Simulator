param()

Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projDir = Join-Path $scriptRoot 'rshw_serializer'
$outDir = Join-Path $projDir 'publish'
$zipDir = Join-Path $scriptRoot 'dist'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error "dotnet CLI not found in PATH. Install .NET SDK (6/7/8) and re-run this script."
    exit 1
}

if (-not (Test-Path $projDir)) {
    Write-Error "Could not find project directory: $projDir"
    exit 1
}

if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
if (-not (Test-Path $zipDir)) { New-Item -ItemType Directory -Path $zipDir | Out-Null }

Write-Host "Publishing rshw_serializer as single-file Windows x64 executable..."

try {
    dotnet publish $projDir -r win-x64 -c Release -o $outDir /p:PublishSingleFile=true /p:PublishTrimmed=true /p:PublishReadyToRun=true --self-contained true
} catch {
    Write-Error "dotnet publish failed: $_"
    exit 1
}

$zipPath = Join-Path $zipDir 'rshw_helper_win_x64.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Packaging published output to $zipPath..."
try {
    Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath -Force
} catch {
    Write-Error "Failed to create zip: $_"
    exit 1
}

Write-Host "Success. Artifact: $zipPath"
Write-Host "Place the extracted executable next to py_bridge_server.py or ensure dotnet is available so the bridge can call the serializer."
