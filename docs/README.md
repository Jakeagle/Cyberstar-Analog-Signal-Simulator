# Lychee Conductor — Documentation

> **v3.1 — Rebrand:** This project was formerly known as **Cyberstar Simulator**. As of v3.1 it has been rebranded to **Lychee Conductor** by [Lychee Interactive](https://github.com/Jakeagle/Cyberstar-Analog-Signal-Simulator). All user-facing names have been updated; internal format identifiers (e.g. `.cybershow.json`, `cyberstar_show` keys) remain unchanged for compatibility. References to _Cyberstar hardware_, _Cyberstar Online (CSO format)_, and `CyberstarSignalGenerator` throughout these docs refer to the **animatronic hardware ecosystem**, not the app.

Welcome to the project documentation. This folder covers everything about how the Lychee Conductor works, from the browser UI down to the BitArray that gets written into an `.rshw` file.

Use the sections below to find what you're looking for.

---

## What is this project?

The Lychee Conductor is a browser-based tool for creating, previewing, and exporting animatronic show content (showtapes) for the **Rock-Afire Explosion (RAE)** animatronic system. It bridges two worlds:

- **The browser** — where a user draws choreography in a piano roll editor, previews animated characters in the 4ch Tester, and exports a validated showtape.
- **RR-Engine / SPTE** — the Unity 3D game where showtapes are loaded and played back through the animatronic hardware. SPTE (Showbiz Pizza Time Experience) is a mod of RR-Engine, which is the open-source base game.

The core challenge is translating a choreography timeline (character movements at specific timestamps) into a precise hardware-compatible binary signal stream that SPTE can read and replay.

---

## Documentation Map

| Folder                                          | What's inside                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [main-logic/](main-logic/README.md)             | How every JavaScript module works and what it owns                                        |
| [data-flow/](data-flow/README.md)               | The end-to-end journey from a show to a playable export                                   |
| [spte-integration/](spte-integration/README.md) | How the app connects to SPTE and the file formats SPTE accepts                            |
| [user-guide/](user-guide/README.md)             | Step-by-step instructions for creating a show and exporting it                            |
| [research/](research/README.md)                 | Technical reference: BMC encoding rules, RAE bit charts, KWS analysis, SCME module design |

---

## High-Level System Overview

```
 +------------------------------------------------------+
 |         Browser (index.html - single-file app)       |
 |                                                      |
 |  Piano roll editor                                   |
 |    User draws signal blocks -> showData object       |
 |                                                      |
 |  (Optional) Load WAV -> audioBuffer                  |
 |    for song playback during editing                  |
 |                                                      |
 |  "Export 4ch WAV" (toolbar)                          |
 |    v Pyodide -> SGM (export_bridge.py)               |
 |       BMC encode -> 4-channel WAV                    |
 |                                                      |
 |  4-channel WAV  [MusicL | MusicR | TD BMC | BD BMC]  |
 |    v                                                 |
 |  4ch Tester modal                                    |
 |    Upload WAV -> SViz (Pyodide) -> PASS/FAIL badge   |
 |    PASS -> unlocks "Export .rshw" button             |
 |    v SGM (rshw_builder.py)                           |
 |    .rshw file                                        |
 |                                                      |
 |  Live tester (no WAV required)                       |
 |    LED visualization from showData events            |
 |    performance.now() clock - immune to suspend       |
 +------------------------------------------------------+
          |
          v
    RR-Engine/SPTE (.rshw)
```

---

## Key Terminology

| Term                | Meaning                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **SPTE**            | Showbiz Pizza Time Experience — a Unity 3D game for show creation and playback; a mod of RR-Engine |
| **RR-Engine**       | An open-source Unity 3D show creation and playback game; SPTE is a mod built on top of it          |
| **BMC**             | Biphase Mark Code — the self-clocking binary encoding used on the control audio tracks             |
| **TD**              | Treble Data — the high-frequency control signal track (94 channels, e.g. Rolfe, Fatz, Dook)        |
| **BD**              | Bass Data — the second control signal track (96 channels, e.g. Beach Bear, Mitzi, Billy Bob)       |
| **Frame**           | One 96-bit BMC packet sent at 45.9375 fps; contains the on/off state of every actuator             |
| **.rshw**           | RR-Engine's legacy NRBF binary showtape format                                                     |
| **.cybershow.json** | Internal show format used inside the simulator; 50 fps character-movement timeline                 |
| **SCME**            | Showtape Creation and Management Engine — the Python module tree inside `SCME/`                    |
| **SGM**             | Signal Generation Module — encodes choreography into BMC frames and a 4-ch WAV (Python)            |
| **SVM**             | Show Validation Module — validates generated signals against hardware requirements                 |
| **SViz**            | Signal Visualizer — decodes a 4-channel WAV and validates the BMC signal; runs in the tester modal |
| **SAM**             | Show Analysis Module — analyses audio and generates choreography (Python, legacy/standalone only)  |
| **KWS**             | Known-Working Show — a reference WAV recorded from real hardware, used for calibration             |
| **RAE**             | Rock-Afire Explosion — the ShowBiz Pizza animatronic band (Rock-Afire is the only band in v3)      |
