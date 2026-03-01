# Export Pipeline — Getting Your Show into SPTE

This page walks through the complete export pipeline from inside the simulator to a file that SPTE/RR-Engine can load and play.

---

## Prerequisites

Before exporting, you need:

- A loaded show (either auto-generated from audio or manually edited)
- The show playing back correctly in the simulator preview (animation looks right)
- The original audio file available in memory (don't navigate away from the page after uploading)

---

## Pipeline Overview

```
Choreography (.cybershow.json)
  + Music (AudioBuffer from original upload)
          │
          ▼
  app.js: exportBroadcastWav()
          │
          ▼ (via Pyodide + SCME/SGM/export_bridge.py)
  4-channel WAV (in-memory ArrayBuffer)
  Ch0: Music L  |  Ch1: Music R  |  Ch2: TD BMC  |  Ch3: BD BMC
          │
     ┌────┤
     │    │
     ▼    ▼
  .rshw  .cso
  (NRBF) (CSO1)
```

---

## Stage 1: 4-Channel WAV Generation

### What Happens

1. `pyModal.open("Exporting...")` — progress overlay appears
2. Pyodide loads (or reuses existing instance — fast if already loaded)
3. `export_bridge.py` is fetched and run inside Pyodide
4. The current show's event sequence is serialised to JSON and passed to Python:
   ```python
   render_4ch_pcm_json(sequences_json, duration_ms)
   ```
5. Python processes each event, builds frame buffers, BMC-encodes them
6. Returns `{td_b64, bd_b64, sample_rate, n_samples}` — base64 raw Int16 PCM
7. JavaScript decodes base64 → Float32Array (÷32768 to normalise)
8. Original music is extracted from the AudioBuffer (stereo, 44,100 Hz, Float32)
9. `encodeMultiChWAV([musicL, musicR, tdSignal, bdSignal], 44100)` writes the RIFF/WAVE binary
10. Browser downloads the `.wav` file

### Output File

A standard 4-channel 44,100 Hz 16-bit PCM WAV file. This file is the broadcast tape format — suitable for direct playback on hardware that reads 4-channel Cyberstar tapes, and is the input to both the `.rshw` and `.cso` exporters.

---

## Stage 2a: .rshw Export (Legacy Format)

If the user clicks "Export .rshw":

1. The 4-channel WAV is passed to `SCME/SGM/rshw_builder.py`
2. Music channels (Ch0 + Ch1) are extracted and re-wrapped in a stereo WAV header → `audioData`
3. The BMC control signals (Ch2 + Ch3) are decoded into frame events at 60 fps → `signalData`
4. Both are packed into the NRBF binary stream
5. Browser downloads the `.rshw` file

### Notes

- The `.rshw` signalData is at 60 fps; the BMC source was at 45.9375 fps. The builder resamples between these rates.
- The NRBF stream must exactly match the wire format that RR-Engine's BinaryFormatter expects — any byte-level deviation causes a deserialization exception on load.

---

## Stage 2b: .cso Export (Custom Format — Planned Decoder Not Yet in RR-Engine)

If the user clicks "Export .cso":

1. `cso-exporter.js` receives the 4-channel WAV `ArrayBuffer`
2. The WAV is parsed into four `Float32Array` channels
3. `stDirectDecode()` decodes Ch2 (TD) and Ch3 (BD) from BMC → bit arrays
4. Bit arrays are segmented into 96-bit frames at 45.9375 fps
5. Each frame is optionally validated (sync byte, blank bits)
6. Frame bitmasks are written directly to the CSO frame block (pre-decoded — no BMC at playback time)
7. Music channels (Ch0 + Ch1) are interleaved as raw 16-bit PCM → CSO music block
8. 64-byte header is prepended: magic, version, frame count, sample rate, music size
9. Browser downloads the `.cso` file

---

## Checking Your Export

After downloading, run the Signal Visualizer:

1. Open the Visualizer panel in the simulator
2. Drop your exported 4-channel WAV onto the drop zone
3. Python decodes the signal and shows:
   - Frame lock status (should be LOCKED)
   - Blank-bit integrity (should be ≥ 98%)
   - Bit error rate (should be ≤ 2%)
   - Per-channel activity chart

If all three checks pass, the file is hardware-safe and ready for SPTE.

---

## Transferring to SPTE

1. Copy the exported file to the SPTE machine (USB drive, network share, etc.)
2. In RR-Engine: File → Load Show → navigate to the file
3. For `.cso`: **decoder not yet built into RR-Engine** — cannot load this file in RR-Engine/SPTE yet; use `.rshw` for actual playback
4. For `.rshw`: RR-Engine may take a moment to deserialise on first load
5. Press Play in RR-Engine
6. The control signal is sent to the hardware driver, which activates the solenoids

---

## Troubleshooting Export Failures

| Symptom                           | Likely Cause                                       | Fix                                                                                    |
| --------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Python modal hangs                | Pyodide WASM failed to load (no internet)          | Ensure internet connection for first load; check browser console                       |
| "BMC decode failed" in CSO export | TD or BD track is silent or pure noise             | Re-export the 4-channel WAV first; check signal generator is running                   |
| Blank-bit integrity < 98%         | Encoder generated a `1` in a reserved bit position | File a bug — this should never happen with the Python pipeline                         |
| RR-Engine rejects .rshw           | NRBF format mismatch                               | Ensure you're using the current `rshw_builder.py`; check the RR-Engine version matches |
| Music is silent in RR-Engine      | Music channels missing from WAV                    | Verify the original audio was loaded before export                                     |
