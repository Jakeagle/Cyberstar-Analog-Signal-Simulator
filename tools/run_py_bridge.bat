@echo off
REM Quick helper: create venv, install deps, and run bridge (Windows)
REM This script will fail loudly with instructions if Python is not found.

where python >nul 2>&1
if %errorlevel%==0 (
	set PY=python
) else (
	where py >nul 2>&1
	if %errorlevel%==0 (
		set PY=py
	) else (
		where python3 >nul 2>&1
		if %errorlevel%==0 (
			set PY=python3
		) else (
			echo.
			echo ERROR: Python was not found on your PATH.
			echo Please install Python 3.10+ from:
			echo   https://www.python.org/downloads/
			echo
			echo On Windows: If you installed from the Microsoft Store, disable
			echo App Execution Aliases: Settings → Apps → App execution aliases
			echo
			echo Opening the download page in your browser...
			start "" "https://www.python.org/downloads/"
			pause
			exit /b 1
		)
	)
)

%PY% -m venv .venv
call .venv\Scripts\activate
pip install -r tools\requirements.txt
%PY% tools\py_bridge_server.py
pause