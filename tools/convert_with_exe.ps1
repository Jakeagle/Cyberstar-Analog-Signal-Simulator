param(
  [Parameter(Mandatory=$true)][string]$inputWav,
  [string]$outputRshw
)
if (-not $outputRshw) { $base = [IO.Path]::GetFileNameWithoutExtension($inputWav); $outputRshw = "$base.rshw" }
$exe = "tools\dist\rshw_helper_win_x64\rshw_serializer.exe"
if (-not (Test-Path $exe)) {
  Write-Error "Prebuilt EXE not found at $exe. Extract tools\dist\rshw_helper_win_x64.zip first."
  exit 3
}
$python = Get-Command python -ErrorAction SilentlyContinue; if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  Write-Warning "Python not found. This wrapper uses Python to generate signals.json required by the EXE. Install Python (https://www.python.org/downloads/) or run the GUI/server alternative."
  Read-Host "Press Enter to continue"
}
$signals = [IO.Path]::Combine($env:TEMP, 'signals.json')
& $python.Source -- signals-json $inputWav $signals
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to generate signals.json"; exit 4 }
Write-Host "Generated signals: $signals"
& $exe --wav $inputWav --signals $signals --out $outputRshw
if ($LASTEXITCODE -eq 0) { Write-Host "Wrote $outputRshw" } else { Write-Error "Serializer failed"; exit $LASTEXITCODE }
Read-Host "Done. Press Enter to close"
