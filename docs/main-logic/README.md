# Main Logic — Module Overview

This folder documents every JavaScript file in the root of the Cyberstar Simulator project. Each module has a clear, single owner responsibility. Read this first to understand which file does what.

---

## Module Map

| File                                             | Short Purpose                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [app.js](app.md)                                 | Central coordinator: playback engine, WAV export, UI wiring, Python process modal                                                  |
| [cyberstar-signals.js](signal-generator.md)      | Real-time BMC signal generator, streams control audio to the Web Audio API                                                         |
| [show-builder.js](show-builder.md)               | Analyzes uploaded audio using Python (Pyodide + SAM) and returns a `.cybershow.json`                                               |
| [cso-exporter.js](cso-exporter.md)               | Converts a finished 4-channel WAV into a `.cso` (Cyberstar Online) binary file; decoder for RR-Engine is planned but not yet built |
| [character-movements.js](character-movements.md) | Static catalog mapping each character movement name to its TD/BD track and bit index                                               |
| [showtapes.js](showtapes.md)                     | Bundled pre-built showtape timelines; used for demo playback and testing                                                           |
| [signal-visualizer.js](signal-visualizer.md)     | SViz front-end bridge: sends PCM data to Pyodide and renders the decoded signal chart                                              |
| [editor.html / index.html](html-ui.md)           | UI shell: layout, controls, intro overlay, monitor panels                                                                          |

---

## Dependency Order

These files must be loaded **in this order** in `index.html`. Later files depend on earlier ones.

```
1. character-movements.js   → defines CHARACTER_MOVEMENTS (global const)
2. showtapes.js             → defines SHOWTAPES, BAND_CHARACTERS (global const)
3. cyberstar-signals.js     → defines CyberstarSignalGenerator class
4. show-builder.js          → defines window.buildShowWithPython()
5. cso-exporter.js          → defines exportCso(), stDirectDecode() (partial dependency on app.js)
6. signal-visualizer.js     → defines window.visualizeSignal()
7. app.js                   → wires everything together, must load LAST
```

---

## Architectural Principle

Each module is **self-contained** for its domain. There is no build step and no bundler — this is intentional so the project runs directly in a browser over a local HTTP server (e.g. `npx live-server`) without any install step.

Python code runs **inside** the browser via [Pyodide](https://pyodide.org/) — a WebAssembly port of CPython. The Pyodide WASM bundle is loaded once per page session and shared between `show-builder.js` and `signal-visualizer.js` to avoid double-downloading ~30 MB of runtime.
