@echo off
REM Convenience wrapper: create signals.json (via Python) then run rshw_serializer.exe
SETLOCAL ENABLEDELAYEDEXPANSION
if "%~1"=="" (
  echo Usage: convert_with_exe.bat input.wav [output.rshw]
  exit /b 2
)
set INWAV=%~1
set OUT=%~2
if "%OUT%"=="" set OUT=%~n1.rshw
set EXE=tools\dist\rshw_helper_win_x64\rshw_serializer.exe
if not exist "%EXE%" (
  echo ERROR: Prebuilt EXE not found at %EXE%
  echo Extract tools\dist\rshw_helper_win_x64.zip first.
  pause
  exit /b 3
)
where python >nul 2>&1 || where py >nul 2>&1
if %errorlevel% neq 0 (
  echo WARNING: Python not found. The EXE requires a signals JSON which this wrapper generates using Python.
  echo You can instead run the EXE in server mode (see README) or install Python from https://www.python.org/downloads/
  echo Press any key to continue and attempt to run the EXE without signals (will fail)...
  pause >nul
)
REM Generate signals.json using wav_to_rshw.py
python tools\wav_to_rshw.py --signals-json "%INWAV%" "%TEMP%\signals.json"
if %errorlevel% neq 0 (
  echo Failed to generate signals.json
  pause
  exit /b 4
)
echo Generated signals: %TEMP%\signals.json
"%EXE%" --wav "%INWAV%" --signals "%TEMP%\signals.json" --out "%OUT%"


ENDLOCALpausenecho Result: %OUT%