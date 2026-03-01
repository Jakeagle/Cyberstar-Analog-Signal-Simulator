# SCME Modules — Design Rationale and Structure

The **Showtape Creation & Management Engine (SCME)** is the Python module tree in `SCME/`. It handles all signal-level processing: audio analysis, BMC encoding, frame building, decoding, validation, and visualisation.

This page explains why each module exists, what it does, and how the modules relate.

---

## Module Tree

```
SCME/
├── __init__.py
├── SGM_validation_report.txt   ← output of SVM on a test file
│
├── SAM/                        Show Analysis Module
│   ├── __init__.py
│   └── show_bridge.py          ← Pyodide entry point for audio → choreography
│
├── SGM/                        Signal Generation Module
│   ├── __init__.py
│   ├── bmc_encoder.py          ← Stateful BMC encoder (bit → PCM samples)
│   ├── export_bridge.py        ← Pyodide entry point for choreography → 4-ch WAV
│   ├── frame_builder.py        ← Event-based frame assembly
│   └── rshw_builder.py         ← NRBF .rshw writer
│
├── SMM/                        Shared Memory Module (constants)
│   ├── __init__.py
│   └── constants.py            ← All KWS-confirmed hardware constants
│
├── SViz/                       Signal Visualizer
│   ├── __init__.py
│   └── visualizer_bridge.py    ← Pyodide entry point for 4-ch WAV → decoded report
│
└── SVM/                        Show Validation Module
    ├── __init__.py
    ├── bmc_decoder.py           ← Hardware-accurate BMC decoder with PLL model
    ├── frame_sync.py            ← Frame boundary detection
    ├── hardware_sim.py          ← Physical hardware simulation
    └── validate.py              ← Full automated test suite
```

---

## SAM — Show Analysis Module

**Purpose:** Turn raw audio samples into a choreographed show timeline.

**Algorithm (`show_bridge.py` → `analyze_and_choreograph()`):**

1. **Frequency split via boxcar (moving-average) filters** — No FFT is used. The absolute value of each sample is smoothed with two window sizes:
   - `w_slow = sample_rate // 150` → bass envelope
   - `w_fast = sample_rate // 2000` → treble envelope
   - Mid is the difference between the slow and fast envelopes
   - NumPy `cumsum` is used when available; a pure-Python loop provides identical results as a fallback

2. **Onset strength** — Each band's samples are divided into 50 ms chunks. The onset strength per chunk is `max(0, energy[i] − energy[i−1])`, i.e. each positive energy increase.

3. **Combined onset curve** — `bass_onset + 0.6 × mid_onset + 0.3 × treble_onset`. Treble onsets are also tracked separately for vocalist cues.

4. **Peak picking** — Local maxima above an adaptive threshold with a minimum gap (150 ms for beats, 80 ms for treble peaks).

5. **BPM estimation** — Inter-onset intervals are collected, sorted, and the **median** is taken. Result is clamped to 60–210 BPM. This is the `_estimate_bpm()` function — no autocorrelation is used.

6. **Choreography** — Each detected beat triggers a movement from the relevant character's role table (`_ROCK` or `_MUNCH`), cycling through the list. On treble-only onsets not close to a beat, vocalist characters receive a `soft` idle movement.

7. **Output** — A `.cybershow.json` v3.0 string is returned directly to JavaScript.

**Design decisions:**

- **Self-contained in one file** (`show_bridge.py`): The Pyodide bridge must be fetchable as a single file over HTTP. Splitting into multiple files would require either a bundler or a `sys.path` hack inside Pyodide. Single-file keeps it simple.
- **NumPy optional**: The code runs without NumPy (using pure Python loops) if NumPy isn't available. This was important during early development when Pyodide NumPy loading was unreliable. With Pyodide 0.27+ it always loads, but the fallback remains.
- **No file I/O**: Everything passes as lists and JSON strings. No `open()` calls because Pyodide's virtual filesystem is not reliable for this use case.
- **Band-specific role tables**: The characters' movement vocabularies (`_ROCK`, `_MUNCH`) are hard-coded dictionaries. This is the artistic layer — it captures which character should respond to bass, treble, soft passages, etc. The tables are tuned by hand based on the original show character roles.

---

## SGM — Signal Generation Module

**Purpose:** Convert a choreography event sequence into hardware-conformant BMC PCM.

**Design decisions:**

- **`BMCEncoder` is stateful (class, not function)**: The output level persists between frames. This is critical — a function that resets state per frame would produce a DC offset at every frame boundary, breaking the decoder's PLL lock.
- **`FrameBuilder` takes events, not pre-computed frames**: Events (`{time_ms, channel, state}`) are more compact than per-frame BitArrays for a full show. The builder handles the interpolation internally.
- **`export_bridge.py` inlines constants**: The bridge file is injected into Pyodide at runtime by JavaScript. Importing from `SCME.SMM.constants` would require Pyodide package setup. Inline constants avoid this complexity while keeping a single authoritative source (`constants.py`) that is manually mirrored.
- **`rshw_builder.py` is separate from `export_bridge.py`**: RSHW is a completely different codec from raw PCM. Keeping them separate makes each testable in isolation.

---

## SMM — Shared Memory Module (Constants)

**Purpose:** Single source of truth for all hardware constants.

**Design decisions:**

- **All constants have comments explaining their source**: Every value in `constants.py` has an inline comment saying "KWS-confirmed", "Source-confirmed", or "Community-confirmed". This prevents future developers from changing a constant without understanding its provenance.
- **No functions**: SMM is constants only. This keeps it importable without side effects in any context.

---

## SVM — Show Validation Module

**Purpose:** Verify that generated signals match hardware requirements.

**Design decisions:**

- **`BMCDecoder` models analog hardware**: The ±30% tolerance window models what an analog PLL would accept. A stricter tolerance would produce false failures on hardware that is actually fine. A looser tolerance would miss genuine problems.
- **`validate.py` is a standalone script**: It can be run as `python -m SCME.SVM.validate` or directly. This makes it easy to run in CI or as a pre-commit hook.
- **Four test categories**: Constants → Encoder → Frame builder → KWS cross-check. Each builds on the last. If constants fail, there's no point testing the encoder.

---

## SViz — Signal Visualizer

**Purpose:** Decode and visualise a 4-channel WAV for inspection.

**Design decisions:**

- **Self-contained (like export_bridge.py)**: All constants and decoding logic are inlined because it runs inside Pyodide with no package infrastructure.
- **Returns a dict, not JSON**: Pyodide automatically converts Python dicts to JavaScript objects. Returning a dict avoids a redundant `json.dumps` + JS `JSON.parse` round-trip.
- **Channel chart is rendered in JavaScript**: Python returns the decoded data (bit arrays, frame counts, error lists). JavaScript renders the visual chart using Canvas. This separation keeps Python focused on signal processing and JS focused on rendering — where it excels.

---

## Adding a New Module to SCME

1. Create the folder: `SCME/NewModule/`
2. Add `__init__.py`
3. Add your Python file(s)
4. If it needs Pyodide access: create a `_bridge.py` that is self-contained (no imports from other SCME modules that aren't inlined)
5. Update `SCME/__init__.py` to export from the new module
6. Add tests to `SVM/validate.py`
7. Document it here and in the relevant docs folder
