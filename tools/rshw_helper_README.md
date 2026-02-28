# rshw_helper — Build & Packaging

This folder contains a convenience script to publish the `rshw_serializer` C# project as a single-file Windows x64 executable and package it into a ZIP for distribution.

Files added:

- `build_helper.ps1` — Powershell script that runs `dotnet publish` and zips the output to `tools/dist/rshw_helper_win_x64.zip`.

Quick build steps (Windows PowerShell):

```powershell
# From repository root
pwsh -ExecutionPolicy Bypass -File tools/build_helper.ps1
```

Requirements:

- .NET SDK (6/7/8) installed and on `PATH` (required by `dotnet publish`).
- PowerShell (Windows built-in) for the packaging script.

Output:

- `tools/dist/rshw_helper_win_x64.zip` — contains the single-file executable and any runtime files.

Usage notes:

- If you plan to use the browser → bridge flow, either ensure `dotnet` is available on the user's machine or extract the published single-file executable next to `tools/py_bridge_server.py`. The Python bridge will prefer calling `dotnet` if available; if you put the executable in the same folder the bridge can call it directly.
- To distribute a helper to non-technical users, upload the ZIP to GitHub Releases (or your download hosting) and update the app's helper modal `Download Helper` link to point to the release asset.

Next steps you may want me to do:

- Run the publish step here (requires .NET SDK installed in this environment). I can run it if you want and if .NET is available.
- Update the web UI helper modal to point to the built ZIP artifact location (local path during development or a remote release URL).
