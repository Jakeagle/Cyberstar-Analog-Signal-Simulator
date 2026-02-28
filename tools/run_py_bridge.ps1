# PowerShell helper: create venv, install deps, run bridge
# Fail loudly if Python isn't available and provide links.

function Find-PythonBinary {
	$c = Get-Command python -ErrorAction SilentlyContinue
	if ($c) { return $c.Source }
	$c = Get-Command py -ErrorAction SilentlyContinue
	if ($c) { return $c.Source }
	$c = Get-Command python3 -ErrorAction SilentlyContinue
	if ($c) { return $c.Source }
	return $null
}

$py = Find-PythonBinary
if (-not $py) {
	Write-Host "`nERROR: Python was not found on your PATH." -ForegroundColor Red
	Write-Host "Please install Python 3.10+ from: https://www.python.org/downloads/ `n"
	Write-Host "On Windows: if you installed from the Microsoft Store, disable App Execution Aliases:`n  Settings -> Apps -> App execution aliases"
	Start-Process "https://www.python.org/downloads/"
	Read-Host -Prompt "Press Enter to close"
	exit 1
}

& $py -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r tools\requirements.txt
& $py tools\py_bridge_server.py