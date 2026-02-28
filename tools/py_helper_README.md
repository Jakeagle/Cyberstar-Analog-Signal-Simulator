Python Helper — Quick Start

This repo includes a simple Python helper to run a local conversion bridge (WAV → .rshw).

Quick steps (Windows):

1. Open PowerShell in the project root.
2. Run the helper script (recommended):

   .\tools\run_py_bridge.ps1

   or, manually:

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r tools\requirements.txt
   python tools\py_bridge_server.py

Quick steps (macOS/Linux):

1. Open a terminal in the project root.
2. Run:

   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r tools/requirements.txt
   python tools/py_bridge_server.py

What it does

- Starts a small HTTP server on http://127.0.0.1:5000
- Endpoints used by the web UI:
  - POST /py-bridge/convert (upload WAV, get .rshw file)
  - GET /py-bridge/health (health check)

After starting the helper, return to the web UI and click "Check Bridge" → then "Convert to SPTE rshw".

Notes

- This Python helper uses the included Python serializer (pickle-based). If you need a BinaryFormatter (.NET)-compatible .rshw, build the .NET helper in `tools/rshw_serializer`.
- The helper requires packages in `tools/requirements.txt` (Flask, soundfile, numpy). Ensure your Python can install them (on Windows, you may need Microsoft Visual C++ Build Tools for some packages).

If nothing happens when you try to run the helper

- Double-clicking `tools/py_bridge_server.py` in Explorer or opening it in an editor will not start the server. You must run it from a terminal using the scripts above.
- If the terminal shows `Python was not found` or the script doesn't start, install Python from:

  https://www.python.org/downloads/

- On Windows, if you installed Python from the Microsoft Store, you may need to disable App Execution Aliases: Settings → Apps → App execution aliases.

After installing Python, re-run `.\tools\run_py_bridge.ps1` (PowerShell) or `tools\run_py_bridge.bat` (CMD).

GUI launcher

If you prefer to double-click a single file to start the bridge, use the GUI launcher:

- Double-click `tools/py_bridge_gui.py` (or run `python tools/py_bridge_gui.py`).
- Click `Start Server` in the window. Logs will appear inside the window and it will remain open.

This avoids the disappearing console problem when double-clicking the server script directly.
