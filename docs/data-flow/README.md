# Data Flow — End-to-End Overview

This document traces how data moves through the Lychee Conductor from show creation to a validated `.rshw` export.

---

## The Pipeline at a Glance

```
  Piano roll editor (index.html)
       |
       v
  showData object                    -- .cybershow.json-compatible JS object
       |
       | (optional)
       v
  audioBuffer (WAV)                  -- decoded by Web Audio API; reference only
       |
       v
  "Export 4ch WAV" toolbar button
       |
       v
  Pyodide + SGM (export_bridge.py)   -- converts showData to BMC frames
       |
       v
  4-channel WAV file                 -- [MusicL | MusicR | TD BMC | BD BMC]
       |
       v
  4ch Tester modal
   +-- Live mode: renders LED stage from showData events
   |              performance.now() clock, no WAV needed
   |
   +-- 4ch validation mode:
          Upload 4ch WAV
               |
               v
          Pyodide + SViz (visualizer_bridge.py)
               |
               v
          PASS / FAIL badge
               |
          PASS only:
               v
          "Export .rshw" unlocked
               |
               v
          Pyodide + SGM (rshw_builder.py)
               |
               v
          .rshw file               -- loadable by RR-Engine/SPTE
```

---

## Stage 1 — Show Authoring (Piano Roll)

The user creates a show by drawing signal blocks directly in the piano roll editor
inside `index.html`. There is no audio analysis or auto-generation step.

**Key object:** `showData`

```js
{
  title: "My Show",
  frames: 9000,        // default; adjustable
  characters: {
    "Rolfe": {
      movements: {
        "Head Left-Right": [
          { frame: 100, on: true },
          { frame: 150, on: false }
        ]
      }
    }
    // ... all 8 characters + Lights
  }
}
```

`showData` is the single source of truth for everything downstream.

---

## Stage 2 — Optional Audio Reference

The user may click **"Load WAV"** in the toolbar to load a song WAV file.
The Web Audio API decodes it into `audioBuffer` (an `AudioBuffer` object).

- During editing: the WAV plays back when the user presses Play, so they can
  draw choreography to the music.
- During export: the decoded samples are interleaved into channels 1 and 2 of
  the 4-channel output WAV.
- If no WAV is loaded: channels 1 and 2 are silent; channels 3 and 4 carry BMC.

---

## Stage 3 — 4ch WAV Export

Clicking **"Export 4ch WAV"** in the toolbar:

1. Loads the Pyodide runtime (if not already warm).
2. Calls `SGM.export_bridge.generate_4ch_wav(showData, audioSamples)`.
3. BMC-encodes every `{frame, on}` event into the 96-bit hardware packet stream.
4. Interleaves music (ch1/ch2) with TD BMC (ch3) and BD BMC (ch4).
5. Downloads the result as a `.wav` file.

The sample rate is 44100 Hz. BMC clock period = 1 / (FPS * 96) samples.

---

## Stage 4 — 4ch Tester Modal

The tester modal (`#tester-overlay`) has two operating modes:

### Live Mode (default)
- No WAV file needed.
- Reads `_tLiveEvents` (sorted `{timeSec, charName, movKey, on}` from `showData`).
- Clock: `performance.now() / 1000 - _tPlayPerf` — immune to AudioContext suspend.
- Renders an LED stage arena showing which actuators are active in real time.

### 4ch Validation Mode
- User clicks **"Upload 4ch WAV"** and selects the file exported in Stage 3.
- Pyodide + SViz decodes TD/BD BMC from channels 3 and 4.
- Validates timing, clock stability, and signal integrity.
- Displays a **PASS** or **FAIL** badge.
- Only on PASS: the **"Export .rshw"** button is enabled.

---

## Stage 5 — .rshw Export (gated)

When the badge shows PASS:

1. `SGM.rshw_builder.build_rshw(showData)` is called via Pyodide.
2. Produces an NRBF binary blob in RR-Engine's legacy showtape format.
3. Downloads as `<title>.rshw`.

The `.rshw` file is loadable directly by RR-Engine and SPTE.

---

## What Happened to SAM, CSO, and app.js?

| Component           | Status in v3                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `app.js`          | Legacy (v2). Not loaded by `index.html`.                              |
| `show-builder.js` | Legacy (v2). Not loaded by `index.html`.                              |
| SAM (show_bridge)   | Legacy. Still in `SCME/SAM/` for standalone use; not called by the UI.|
| `.cso` export     | Removed. No `.cso` output in v3.                                      |
| `cso-exporter.js` | Legacy (v2). Not loaded by `index.html`.                              |
| MMBB support        | Removed. Only Rock-Afire Explosion characters are supported.            |
