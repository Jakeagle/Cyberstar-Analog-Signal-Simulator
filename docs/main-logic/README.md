# Main Logic — Module Overview

This folder documents the JavaScript modules in the Lychee Conductor. In v3, the application is a **single-file** architecture: `index.html` inlines all editor, tester, and export logic as an SCME bridge IIFE. Only one external JS file is loaded.

---

## Active Modules

| File                                             | Status | Short Purpose                                                                                         |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `index.html` (inline SCME IIFE)                  | Active | Piano roll editor, 4ch tester, SGM export, SViz validation — all inlined                              |
| [character-movements.js](character-movements.md) | Active | Static catalog mapping each character movement to its TD/BD track and bit index; loaded by `<script>` |

## Legacy Modules (present in repo, not loaded by the editor)

These files exist for reference and can be studied independently, but `index.html` does not load them.

| File                                          | Short Purpose                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [app.js](app.md)                              | v2 simulator shell: playback engine, SAM wiring, WAV export, UI (superseded by inline SCME IIFE) |
| [cyberstar-signals.js](signal-generator.md)   | Real-time BMC signal generator for browser preview (v2 simulator only)                           |
| [show-builder.js](show-builder.md)            | Analyses uploaded audio via Pyodide + SAM and returns a `.cybershow.json` (v2 auto-generation)   |
| [cso-exporter.js](cso-exporter.md)            | Converts a 4-channel WAV into a `.cso` binary; CSO format is not used in v3                      |
| [showtapes.js](showtapes.md)                  | Bundled pre-built showtape timelines for demo and testing (not loaded by the editor)             |
| [signal-visualizer.js](signal-visualizer.md)  | SViz front-end bridge (v2 drop-zone approach); validation is now integrated in the tester modal  |
| [editor.html → index.legacy.html](html-ui.md) | Retired v2 editor; superseded by `index.html`                                                    |

---

## Script Loading Order

In v3, only one external script is loaded:

```
1. character-movements.js   → defines CHARACTER_MOVEMENTS (global const)
```

All other logic runs inside the inline `<script>` tags in `index.html`, which has access to `CHARACTER_MOVEMENTS` by the time the IIFE executes.

---

## Architectural Principle

The project runs directly in a browser over a local HTTP server with no build step and no bundler. Python code runs inside the browser via [Pyodide](https://pyodide.org/) — a WebAssembly port of CPython. Pyodide is loaded lazily on first export or validation and cached as `window._svizPyodide` for the session.
