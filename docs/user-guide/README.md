# User Guide — Getting Started

Welcome! This guide explains how to use the Cyberstar Simulator to create a new animatronic show and export it for SPTE playback.

---

## What You Need

- A modern web browser (Chrome 110+ or Firefox 112+ recommended)
- A local HTTP server running in the project folder (see below)
- An audio file for your show (**WAV only** — MP3 and other formats are not valid; SPTE only accepts WAV files)
- An internet connection the **first time** (to download the Pyodide WASM runtime, ~30 MB, cached after that)

---

## Starting the Simulator

The simulator **cannot** be opened directly as a `file://` URL because browsers block module loading and `fetch()` from local files for security reasons. You need a local HTTP server:

### Option A — Node.js (easiest)

```bash
cd "path/to/Cyberstar Simulator"
npx live-server
```

This opens `http://127.0.0.1:8080` automatically in your browser.

### Option B — Python

```bash
cd "path/to/Cyberstar Simulator"
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

### Option C — VS Code

Install the **Live Server** extension, right-click `index.html` → "Open with Live Server".

---

## First Load

1. The **intro animation** plays automatically. Click anywhere or press any key to skip it.
2. The main interface fades in with character monitor panels visible.
3. The app defaults to the **Rock-Afire Explosion** band. Toggle to Munch's Make Believe Band using the band selector in the header.

---

## Pages in This Guide

| Page                                           | What it covers                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [creating-a-show.md](creating-a-show.md)       | Full walkthrough: upload audio → auto-generate choreography → preview                                    |
| [manual-editing.md](manual-editing.md)         | Using the editor to hand-craft or fine-tune a show timeline                                              |
| [exporting-for-spte.md](exporting-for-spte.md) | How to export `.rshw`, `.cso`, or raw 4-channel WAV; note `.cso` requires a decoder not yet in RR-Engine |
| [troubleshooting.md](troubleshooting.md)       | Common problems and how to fix them                                                                      |

---

## Quick Orientation

```
┌──────────────────────────────────────────────────────────┐
│  Header: Band toggle │ Title │ Settings                  │
├────────────┬─────────────────────────────────────────────┤
│  Sidebar   │  Character monitors (6–7 panels)             │
│            │                                             │
│  My Shows  │  [Rolfe] [Earl] [Fatz] [Dook] [BB] [Mitzi]  │
│            │  [Billy Bob]                                │
│  Upload ↑  │                                             │
│            │  Now Playing: ________________________      │
│            │  ▶ ⏸ ⏹  [========        ] 1:23 / 4:16  │
├────────────┴─────────────────────────────────────────────┤
│  Export: [4-ch WAV] [.rshw] [.cso]  │  Signal Visualizer │
└──────────────────────────────────────────────────────────┘
```

- **Character monitors**: LED panels showing real-time actuator activity during playback
- **Now Playing card**: Shows the current show name, BPM, and playback controls
- **Export row**: Buttons to download the show in different formats
- **Signal Visualizer**: Drop a 4-channel WAV here to inspect its BMC content
