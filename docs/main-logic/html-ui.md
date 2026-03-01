# HTML UI — index.html and editor.html

The simulator has two HTML entry points:

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `index.html`  | Main application shell — audio upload, playback, export                       |
| `editor.html` | Manual show editor — drag-and-drop timeline editor for precision choreography |

---

## index.html Structure

### Intro Overlay

The page opens with a full-screen video intro (`#intro-overlay`). The user can click anywhere or press any key to skip it. Once skipped:

- The overlay fades out (`intro-hidden` class)
- `document.body` gets `app-ready` class
- All `.reveal-stagger` elements animate in sequentially (150ms + 120ms × index stagger)

### Main Layout Sections

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header bar                                                          │
│    Band selector toggle (Munch / Rock-Afire)                         │
├─────────────────────────────────────────────────────────────────────┤
│  Left sidebar                │  Main content area                    │
│    My Shows list             │    Now Playing card                   │
│    Upload audio button       │    Character monitors (6–7 panels)    │
│    Band info                 │    Playback controls                  │
│                              │    Progress bar / time display        │
├─────────────────────────────────────────────────────────────────────┤
│  Export panel                                                        │
│    Export 4-ch WAV button                                            │
│    Export .rshw button                                               │
│    Export .cso button                                                │
│    Signal Visualizer drop zone                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Python Modal (`#py-modal`)

A full-screen progress overlay that appears while Pyodide is running. Contains:

- Title text (`#py-modal-title`)
- Status message (`#py-modal-msg`)
- Progress bar (`#py-modal-bar`)

Controlled entirely by the `pyModal` IIFE in `app.js`. Never shown unless a Python operation is in progress.

### Character Monitor Panels

Each character gets a monitor panel (`#monitor-rolfe`, `#monitor-fatz`, etc.). Each panel shows:

- Character name
- A small LED/activity grid showing which movements are currently active
- Real-time signal state (signals lit = actuator on)

Panels are generated dynamically in `app.js` based on `BAND_CONFIG[currentBand].characters`.

---

## editor.html Structure

The manual editor is a separate page for users who want fine-grained control over the show timeline rather than auto-generation.

### Features

- **Timeline grid**: Horizontal axis = time, vertical axis = characters/movements
- **Drag to draw**: Click and drag on any row to create an on-event; release to create the matching off-event
- **JSON import/export**: Load and save `.cybershow.json` files directly
- **Preview playback**: Runs the show in the simulator preview without leaving the editor

### Relationship to app.js

The editor saves its timeline to `localStorage` in the same `.cybershow.json` format that `show-builder.js` and the SAM module produce. This means any manually-edited show can be exported using the exact same pipeline as an auto-generated show.

---

## Styling — styles.css

All styling is in a single flat CSS file. Key design decisions:

- **Dark theme throughout** — easier on the eyes during late-night show programming
- **Responsive layouts** via CSS Grid and Flexbox — usable on both laptops and large monitor displays
- **CSS custom properties** for brand colours (green accent, dark background)
- **No external CSS framework** — keeps the project dependency-free
