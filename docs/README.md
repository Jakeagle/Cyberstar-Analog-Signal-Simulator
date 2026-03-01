# Cyberstar Simulator — Documentation

Welcome to the project documentation. This folder covers everything about how the Cyberstar Simulator works, from the browser UI down to the BitArray that gets written into an `.rshw` file.

Use the sections below to find what you're looking for.

---

## What is this project?

The Cyberstar Simulator is a browser-based tool for creating, previewing, and exporting animatronic show content (showtapes) for the **Rock-Afire Explosion (RAE)** and **Munch's Make Believe Band** animatronic systems. It bridges two worlds:

- **The browser** — where a user loads audio, previews animated characters, and edits or auto-generates choreography.
- **RR-Engine / SPTE** — the Unity 3D game where showtapes are loaded and played back through the animatronic hardware. SPTE (Showbiz Pizza Time Experience) is a mod of RR-Engine, which is the open-source base game.

The core challenge is translating a choreography timeline (character movements at specific timestamps) into a precise hardware-compatible binary signal stream that SPTE can read and replay.

---

## Documentation Map

| Folder                                          | What's inside                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [main-logic/](main-logic/README.md)             | How every JavaScript module works and what it owns                                        |
| [data-flow/](data-flow/README.md)               | The end-to-end journey from an audio file to a playable export                            |
| [spte-integration/](spte-integration/README.md) | How the app connects to SPTE and the file formats SPTE accepts                            |
| [user-guide/](user-guide/README.md)             | Step-by-step instructions for creating a show and exporting it                            |
| [research/](research/README.md)                 | Technical reference: BMC encoding rules, RAE bit charts, KWS analysis, SCME module design |

---

## High-Level System Overview

```
 ┌──────────────────────────────────────────────────────┐
 │                   Browser (index.html)               │
 │                                                      │
 │  User uploads audio WAV                              │
 │  ↓                                                   │
 │  app.js → Web Audio API decodes WAV                  │
 │  ↓                                                   │
 │  show-builder.js → Pyodide → SAM (show_bridge.py)   │
 │    (audio analysis + choreography generation)        │
 │  ↓                                                   │
 │  .cybershow.json (internal format, 50 fps timeline)  │
 │  ↓                                                   │
 │  app.js → buildCustomShowtape() → playback preview   │
 │  ↓                                                   │
 │  app.js → exportBroadcastWav()                       │
 │           → Pyodide → SGM (export_bridge.py)         │
 │             (BMC encoding → 4-channel WAV)           │
 │  ↓                                                   │
 │  4-channel WAV  [MusicL | MusicR | TD BMC | BD BMC]  │
 │  ↓                           ↓                       │
 │  .rshw export            .cso export                 │
 └──────────────────────────────────────────────────────┘
          ↓                         ↓
    RR-Engine/SPTE            RR-Engine/SPTE
    legacy format             .cso (planned decoder,
                              not yet in RR-Engine)
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
| **.cso**            | Cyberstar Online — a custom file format with a planned decoder for RR-Engine (not yet built)       |
| **.cybershow.json** | Internal show format used inside the simulator; 50 fps character-movement timeline                 |
| **SCME**            | Showtape Creation & Management Engine — the Python module tree inside `SCME/`                      |
| **SAM**             | Show Analysis Module — analyses audio and generates choreography (Python, Pyodide)                 |
| **SGM**             | Signal Generation Module — encodes choreography into BMC frames and a 4-ch WAV (Python)            |
| **SVM**             | Show Validation Module — validates generated signals against hardware requirements                 |
| **SViz**            | Signal Visualizer — decodes a 4-channel WAV and renders per-channel signal charts                  |
| **KWS**             | Known-Working Show — a reference WAV recorded from real hardware, used for calibration             |
| **RAE**             | Rock-Afire Explosion — the ShowBiz Pizza animatronic band                                          |
