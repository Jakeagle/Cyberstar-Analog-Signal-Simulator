# Export Pipeline

This document describes how the Lychee Conductor produces `.rshw` files from a show authored in the piano roll editor.

---

## Pipeline Overview

```
showData (piano roll)
    |
    v
Stage 1: Export 4ch WAV
    Pyodide + SGM (export_bridge.py)
    BMC encode -> 4-channel WAV
    |
    v
Stage 2: 4ch Tester validation
    Upload WAV -> Pyodide + SViz (visualizer_bridge.py)
    PASS / FAIL badge
    |
    | (PASS only)
    v
Stage 3: .rshw export
    Pyodide + SGM (rshw_builder.py)
    .rshw binary (NRBF format)
    |
    v
RR-Engine / SPTE
```

---

## Stage 1 — 4ch WAV Generation

**Triggered by:** "Export 4ch WAV" toolbar button.

### Inputs

- `showData` — the current show's character movement timeline.
- `audioBuffer` (optional) — decoded song WAV; null if no song was loaded.

### Process

1. `export4chWAV()` calls `export_bridge.render_4ch_pcm_json(seqs, durMs)` via Pyodide.
2. The show's `{frame, on}` events are converted to BMC packet streams for TD (94 bits) and BD (96 bits) at `SAMPLES_PER_BIT = 9`, 44,100 Hz.
3. Audio samples from `audioBuffer` are copied directly into channels 1 and 2.
   - `audioBuffer` is always 44,100 Hz because `AudioContext` is created with
     `{ sampleRate: 44100 }`. No resampling is needed at export time.
4. BMC Int16 PCM from Python (`td_b64` / `bd_b64`) fills channels 3 (TD) and 4 (BD).
5. `_encodeMultiChWAV()` interleaves all four Float32 channel arrays into a standard
   4-channel 44,100 Hz 16-bit PCM RIFF/WAVE container.

### Output

A `.wav` file downloaded to the browser's Downloads folder.

---

## Stage 2 — Signal Validation

**Triggered by:** "Upload 4ch WAV" in the 4ch Tester modal.

### Inputs

- The 4-channel WAV from Stage 1.

### Process

1. SViz (`visualizer_bridge.py`) decodes channels 3 and 4 from the WAV.
2. BMC frames are extracted and checked against hardware timing requirements.
3. Validation checks include:
   - Clock period stability (within tolerance of 1/FPS/96 samples)
   - No missing or extra bits per frame
   - No illegal state transitions
4. A PASS or FAIL result is returned with per-check detail.

### Output

- A PASS/FAIL badge displayed in the tester modal.
- If PASS: the "Export .rshw" button is enabled (`_tValidated = true`).

---

## Stage 3 — .rshw Export

**Triggered by:** "Export .rshw" (only enabled after PASS validation).

### Inputs

- `showData` — same source of truth used in Stage 1.

### Process

1. `convert_4ch_wav_to_rshw(wav_bytes)` in `rshw_builder.py` is called via Pyodide.
2. The WAV is parsed; channels 0–1 become `audioData` (stereo music WAV);
   channels 2–3 are BMC-decoded into TD/BD frame lists.
3. `_build_signal_data()` maps decoded BMC frames to 60 fps RSHW frames using
   **sample-count-based frame periods**:
   - TD frame duration = `94 * 9 / 44100 = 846/44100 ≈ 0.019183 s`
   - BD frame duration = `96 * 9 / 44100 = 864/44100 ≈ 0.019591 s`
     > Using the baud rate alone (`94/4800`) gives a ~2% error that compounds into
     > ~64 frames/minute of animation lag. The integer `SAMPLES_PER_BIT = 9` must
     > be used, not the theoretical `44100/4800 = 9.1875`.
4. The NRBF binary stream is assembled and returned.

### Output

A `.rshw` file downloaded to the browser's Downloads folder, loadable by RR-Engine/SPTE.

---

## What Was Removed in v3

| v2 Feature        | v3 Status                                                    |
| ----------------- | ------------------------------------------------------------ |
| `.cso` export     | Removed. No CSO output in v3.                                |
| `cso-exporter.js` | Legacy module; not loaded by `index.html`.                   |
| SAM integration   | Removed from UI. SAM still exists in `SCME/SAM/` standalone. |
| JSON export       | Removed.                                                     |
| MMBB support      | Removed. Only Rock-Afire Explosion characters.               |
