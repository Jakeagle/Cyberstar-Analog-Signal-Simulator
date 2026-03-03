# Creating a Show

This guide walks through creating a new show from scratch in the Lychee Conductor.

---

## 1. Open the App

Open `index.html` in a modern browser (Chrome or Edge recommended for Pyodide compatibility). The piano roll editor loads immediately — no server required.

---

## 2. Start a New Show

Click **"New Show"** in the toolbar. A modal appears with fields for:

- **Show Title** — used as the filename when exporting
- **Duration (frames)** — default 9000 frames (3 minutes at 50 fps); 1 frame = 20 ms

Click **Create** to initialise a blank `showData` object and clear the timeline.

---

## 3. (Optional) Load a WAV File

Click **"Load WAV"** to open a song WAV file. The file is decoded into an `AudioBuffer` used for:

- **Playback reference** — hear the music while drawing choreography
- **Export** — music samples are mixed into channels 1 and 2 of the 4-channel output WAV

Loading a WAV is optional. If you skip it, the export will still produce valid BMC data on channels 3 and 4; the music channels will be silent.

---

## 4. Draw Signal Blocks

Each row in the timeline represents one **movement** for one character. Rows are grouped by character (Rolfe, Earl, Dook LaRue, Fatz, Beach Bear, Looney Bird, Mitzi, Billy Bob, Lights).

- **Click and drag** on an empty area of the timeline to create a new signal block.
- **Click an existing block** to select it; drag to move it.
- **Right-click a block** (or press Delete with it selected) to remove it.
- Toggle **"Snap"** in the toolbar to enable frame-boundary snapping.
- Toggle **"State"** mode to draw toggle-style (press-and-hold) vs. momentary pulses.

---

## 5. Preview Playback

Use the transport buttons:

| Button    | Action                                       |
| --------- | -------------------------------------------- |
| **Play**  | Start playback from the current position     |
| **Pause** | Pause; resume continues from the same spot   |
| **Stop**  | Stop and return to frame 0                   |

If a WAV is loaded, audio plays in sync with the timeline cursor. Character highlight in the label panel shows which actuators are currently "on".

---

## 6. Save Your Work

Click **"Save"** to persist the current `showData` to `localStorage` under the show title.
Click **"Saved Shows"** to open a list of saved shows and load a previous one.

Shows are saved as `.cybershow.json`-compatible objects in browser storage — no server needed.

---

## Next Steps

- See [Manual Editing](manual-editing.md) for advanced timeline controls.
- See [Exporting for SPTE](exporting-for-spte.md) to produce a `.rshw` file.
