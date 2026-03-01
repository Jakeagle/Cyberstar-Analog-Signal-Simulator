# Hardware Timing — Confirmed Constants and Derivations

This page is the canonical reference for every hardware timing constant used in the project. Each constant is sourced and the derivation is explained. When a constant is changed, this page must be updated first.

---

## System 1 — Physical Cyberstar Hardware

These values govern the actual BMC signal on the control tracks.

### Sample Rate

| Constant      | Value     | Source                            |
| ------------- | --------- | --------------------------------- |
| `SAMPLE_RATE` | 44,100 Hz | KWS WAV file header (all 4 files) |

The hardware records and plays back at 44,100 Hz — the standard CD sample rate. SPTE only accepts 44,100 Hz WAV input. This is non-negotiable.

### Baud Rate

| Constant    | Value     | Source                          |
| ----------- | --------- | ------------------------------- |
| `BAUD_RATE` | 4,800 bps | KWS run-length bimodal analysis |

The bimodal peak at 9 samples (at 44,100 Hz) places the baud rate at `44100 / 9 = 4900`. However, the exact value is `44100 / 9.1875 = 4800` exactly, confirming 4,800 bps as the design rate and 9 as the floor-divided integer implementation.

### Samples Per Bit

| Constant          | Value | Derivation                                |
| ----------------- | ----- | ----------------------------------------- |
| `SAMPLES_PER_BIT` | 9     | `floor(44100 / 4800) = floor(9.1875) = 9` |

**Critical:** always use integer floor division. The `.1875` fractional remainder is real and the hardware tolerates it via PLL clock recovery. Using `round(9.1875) = 9` is coincidentally the same, but using `int(9.1875)` (Python truncation, equivalent to floor for positive numbers) is correct. Never use floating-point here.

### Half-Period Split

| Constant     | Value | Derivation   |
| ------------ | ----- | ------------ |
| `BMC_HALF_A` | 4     | `9 // 2 = 4` |
| `BMC_HALF_B` | 5     | `9 - 4 = 5`  |

The 9-sample bit period splits asymmetrically (4 + 5) because 9 is odd. The hardware tolerates this asymmetry — KWS run-length peaks are observed at both 4 and 5 samples with equal frequency, confirming the hardware alternates or tolerates both.

### BMC Amplitude Levels

| Constant   | Value   | Reasoning                                         |
| ---------- | ------- | ------------------------------------------------- |
| `BMC_HIGH` | +32,767 | Maximum positive int16 — maximum signal amplitude |
| `BMC_LOW`  | -32,768 | Maximum negative int16 — maximum signal amplitude |

Full-scale square wave maximises signal-to-noise ratio. The analog hardware adds noise; we start at maximum amplitude so the decoded signal remains above noise floor.

### Frame Structure

| Constant         | Value       | Source                                                                          |
| ---------------- | ----------- | ------------------------------------------------------------------------------- |
| `TD_FRAME_BITS`  | 94          | RAE_Bit_Chart_2.pdf                                                             |
| `BD_FRAME_BITS`  | 96          | RAE_Bit_Chart_2.pdf                                                             |
| Frame byte count | 12          | 96 bits / 8 = 12 bytes (rounded up to byte boundary; TD uses 94 of the 96 bits) |
| Frame rate       | 45.9375 fps | 4800 / 96                                                                       |

### Blank Bits

| Track | Blank bits (1-based) | Source                                            |
| ----- | -------------------- | ------------------------------------------------- |
| TD    | 56, 65, 70           | RAE_Bit_Chart_2.pdf + KWS confirmation (always 0) |
| BD    | 45                   | RAE_Bit_Chart_2.pdf + KWS confirmation            |

---

## RR-Engine / SPTE Playback

RR-Engine operates independently when loading and playing `.rshw` files. Its internal signal generation is not part of the simulator's scope — the simulator only needs to produce valid `.rshw` output. Key confirmed values:

| Constant           | Value     | Source                                                  |
| ------------------ | --------- | ------------------------------------------------------- |
| `.rshw` frame rate | 60 fps    | `UI_ShowtapeManager.dataStreamedFPS` (RR-Engine source) |
| `SPTE_SAMPLE_RATE` | 44,100 Hz | Confirmed — SPTE rejects any WAV not at 44,100 Hz       |

---

## Browser Preview vs. Hardware Export

| System                            | Baud rate | Samp/bit | Frame rate  | Use case             |
| --------------------------------- | --------- | -------- | ----------- | -------------------- |
| Browser JS (cyberstar-signals.js) | 4,410 bps | 10       | 45.9375 fps | Browser preview only |
| Python SGM (export_bridge.py)     | 4,800 bps | 9        | 45.9375 fps | Hardware export      |

The browser uses 4,410 baud because `44100 / 4410 = 10.0` exactly — an integer number of samples per bit with no rounding. This is a limitation of the Web Audio API: the API works in floating-point sample counts and scheduling, making fractional-sample-per-bit rates (like the hardware's 9.1875 samp/bit) impractical for real-time browser preview. Using 10 samples/bit gives a clean integer period that the Web Audio API can schedule without drift. The Python encoder uses the KWS-confirmed 4,800 baud for all real exports.

> ⚠ **NEVER MIX THESE TWO SYSTEMS IN THE SAME OUTPUT FILE.**

---

## Conversion Formulas

### RSHW signal position → TD/BD bit

```python
# signalData value v → character:
if v == 0:
    # frame delimiter
elif 1 <= v <= 150:
    # TD bit (v - 1) is ON in 0-based indexing
    td_bit_0indexed = v - 1
elif 151 <= v <= 300:
    # BD bit (v - 151) is ON in 0-based indexing
    bd_bit_0indexed = v - 151
```

### Internal frame number → time_ms

```python
time_ms = frame_number * (1000.0 / fps)         # fps = 50 for .cybershow.json
```

### time_ms → hardware BMC frame number

```python
hardware_frame = time_ms * (45.9375 / 1000.0)   # = time_ms * 4800 / 96000
```

### time_ms → RSHW frame number

```python
rshw_frame = time_ms * (60.0 / 1000.0)          # = time_ms * 0.06
```
