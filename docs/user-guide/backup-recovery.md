# Backup & Recovery

> **v3.2** — The Backup & Recovery modal is the primary way to save and restore show files outside of browser local storage.

Open the modal via the **🗄️ Backup & Recover** button in the toolbar.

---

## Overview

The modal is split into two panels:

```
┌─────────────────────────────────────────────────────┐
│  🗄️  Backup & Recovery                          ×   │
├─────────────────────────┬───────────────────────────┤
│  📦 Show File (.lcsf)   │  🔄 Recover from 4ch WAV  │
│                         │                           │
│  [Export .lcsf]         │  [Choose 4ch WAV…]        │
│                         │  Recovered show title     │
│  ─────────────────────  │  Band selector            │
│  Import from .lcsf:     │                           │
│  [Choose .lcsf…]        │  [Recover Show]           │
│  [Import Show]          │                           │
│                         │  Recovery log…            │
└─────────────────────────┴───────────────────────────┘
```

---

## Left Panel — Show File (.lcsf)

### What is .lcsf?

`.lcsf` stands for **Lychee Conductor Show File**. It is the standard portable show format as of v3.2.

- Same JSON structure as the older `.cybershow.json` format — fully backward-compatible.
- Contains all character signals, state-hold blocks, timing, and band metadata.
- Human-readable and hand-editable.
- `cyberstar_show: true` and `lcsf_version: "3.2"` keys identify it to the importer.

### Exporting (.lcsf)

1. Open the Backup & Recovery modal.
2. The **Export current show** section shows the currently loaded show name and cue count.
3. Click **↓ Export .lcsf** — the browser downloads `<show-title>.lcsf`.

> The export reflects the **live editor state**: any unsaved edits are included. You do not need to Save to browser storage first.

### Importing (.lcsf)

1. Click **📂 Choose .lcsf…** and select a `.lcsf` (or `.cybershow.json`) file.
2. Click **↑ Import Show**.
3. The show loads into the editor immediately.

> **Warning:** Importing replaces the currently open show. Save (Ctrl+S) before importing if you want to keep your work.

### File format details

```json
{
  "cyberstar_show": true,
  "lcsf_version": "3.2",
  "version": "3.0",
  "title": "My Show",
  "band": "rock",
  "duration_ms": 180000,
  "duration_frames": 9000,
  "fps": 50,
  "bpm": null,
  "description": "",
  "savedAt": "2026-03-03T12:00:00.000Z",
  "characters": {
    "Rolfe": {
      "track": "TD",
      "signals": [
        {
          "frame": 100,
          "timestamp": "0:02.000",
          "movement": "mouth",
          "bit": 0,
          "state": true,
          "note": ""
        },
        {
          "frame": 110,
          "timestamp": "0:02.200",
          "movement": "mouth",
          "bit": 0,
          "state": false,
          "note": ""
        }
      ],
      "state_blocks": []
    }
  }
}
```

Key fields for manual editing:

| Field          | Meaning                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `frame`        | 50-fps frame number from show start — **this drives timing**                        |
| `state`        | `true` = actuator ON, `false` = actuator OFF                                        |
| `state_blocks` | Regions where the preceding state is held (see [Manual Editing](manual-editing.md)) |
| `band`         | `"rock"` (Rock-Afire Explosion) or `"munch"` (Munch's Make Believe Band)            |

---

## Right Panel — Recover from 4ch WAV

This tool reconstructs a show from a 4-channel WAV file — useful when the original `.lcsf` is lost but the exported 4ch WAV still exists.

### How it works

A 4-channel WAV produced by Lychee Conductor has this channel layout:

| Channel | Content                                 |
| ------- | --------------------------------------- |
| 1 (L)   | Music left                              |
| 2 (R)   | Music right                             |
| **3**   | **TD — Treble Data BMC control signal** |
| **4**   | **BD — Bass Data BMC control signal**   |

The recovery tool:

1. Loads the WAV using the browser's WebAudio API.
2. Extracts channels 3 and 4 as raw audio data.
3. Runs a JavaScript BMC decoder (±30 % tolerance window, matching the Python `BMCDecoder`) on both channels.
4. Groups the decoded bit stream into 94-bit (TD) and 96-bit (BD) frames.
5. Detects rising and falling edges in each bit position across all frames.
6. Maps bit positions back to character movements using `CHARACTER_MOVEMENTS`.
7. Loads the resulting signal cues into the editor as a new show.

### Steps

1. Click **📂 Choose 4ch WAV…** and select the WAV file (must be 4-channel, 44 100 Hz).
2. Type a **Recovered show title** (defaults to the filename).
3. Select the correct **Band** — the bit-to-movement mapping differs between Rock-Afire Explosion and Munch's Make Believe Band.
4. Click **🔄 Recover Show**.
5. Monitor the recovery log for progress and any warnings.
6. When complete, the recovered show opens in the editor.

> **Save immediately** after recovery (Ctrl+S or the 💾 Save button) to persist the result in browser storage, then export a `.lcsf` backup.

### Limitations and notes

- **Frame alignment:** The decoder assumes the BMC signal starts at sample 0 of the WAV (true for all WAVs exported by this tool). Externally sourced WAVs with a different start offset may produce a frame shift of ≤1 show frame (≤20 ms).
- **Reserved bits:** Some bit positions in the TD and BD frames are hardware-reserved blanks (e.g., TD bit 55 and 64, BD bit 44). Transitions on these bits are silently ignored.
- **Band mismatch:** If the wrong band is selected, no cues will be recovered (the bit positions don't overlap sensibly between the two band configurations).
- **Noise:** Very low-level or corrupted control signals may produce spurious transitions. Delete unexpected signal blocks in the editor after recovery.
- **Stereo WAVs:** The tool will abort with an error if fewer than 4 channels are present. Use a standard 4ch WAV from the **Export 4ch WAV** function.

### Recovery log messages

| Message                                             | Meaning                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `WAV: 4ch @ 44100 Hz · 180.00 s`                    | File decoded successfully                                                |
| `N bits decoded from TD/BD`                         | BMC decoders found valid signal data                                     |
| `N transitions on reserved/unmapped bits — ignored` | Blank or hardware-reserved bits changed state; not a problem             |
| `No BMC signal detected on channels 3 / 4`          | The file probably isn't a 4ch WAV from this tool, or channels are silent |
| `No character movements recovered`                  | Band mismatch, or channels 3/4 are empty                                 |
