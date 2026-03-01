# BMC Encoding — Technical Specification

**Biphase Mark Code (BMC)** — also known as Differential Manchester Encoding — is the binary encoding scheme used on the Cyberstar animatronic control signal tracks. This page covers the encoding rules, why this format was chosen, and how it behaves at the sample level.

---

## Why BMC?

BMC is a **self-clocking** code. The receiver can recover the clock signal directly from the data transitions, without a separate clock track. This is important on a multi-track audio tape (or WAV file) where a dedicated clock track would waste precious channel space.

Additional properties that suit animatronic control:

- **DC-balanced** — over any long run of bits, transitions are equally distributed, preventing capacitive coupling issues on audio tape
- **Error-detectable** — a missing transition is immediately obvious to the decoder
- **Analogue-friendly** — can survive the low-pass filtering that audio tape imposes (as long as the carrier frequency is below the tape's frequency response)

---

## Encoding Rules

For every bit period:

1. **Always** transition at the **start** of the bit period (regardless of bit value).
2. If the bit = **1**: add an **additional** transition at the **midpoint** of the bit period.
3. If the bit = **0**: **no** midpoint transition.

### Visual Representation

```
        │ Bit 0 │ Bit 1 │ Bit 0 │ Bit 1 │
        │       │       │       │       │
HIGH ─┐ │       └───────┐       └───┐   │
       │ │               │           │   │
LOW    └─┘               └───────────┘   └...

Run lengths:
  Bit 0: one full-period run (9 samples at 4800 baud, 44100 Hz)
  Bit 1: two half-period runs (4 samples + 5 samples)
```

The bimodal distribution of run lengths (short = 4-5 samples, long = 9 samples) is the characteristic signature of BMC. This is exactly what was observed in KWS run-length analysis.

---

## Hardware Timing (KWS-Confirmed)

| Parameter       | Value       | Derivation                             |
| --------------- | ----------- | -------------------------------------- |
| Sample rate     | 44,100 Hz   | KWS WAV file header                    |
| Baud rate       | 4,800 bps   | Bimodal run-length peak at 9 samples   |
| Samples per bit | 9           | `floor(44100 / 4800)` = 9.1875 → 9     |
| Half-period A   | 4 samples   | `9 // 2`                               |
| Half-period B   | 5 samples   | `9 - 4`                                |
| Frame bits      | 96 bits     | 12 bytes × 8 bits                      |
| Frame duration  | 960 samples | Nominal: 96 × 10, actual: ~96 × 9.1875 |
| Frame rate      | 45.9375 fps | 4800 / 96                              |

### Critical Note on 9 vs 9.1875

The true ratio `44100 / 4800 = 9.1875`. The hardware uses a fixed 9-sample grid (integer division). This means each frame is 864 samples long (`96 × 9`) rather than 882 samples (`96 × 9.1875`). Over a long show this causes no meaningful drift because the hardware PLL re-locks to each sync byte.

**Never round to 9.1875 or 10.** The correct operation is integer floor division (`9`). Using 10 samples/bit (as the browser preview JS does) is the RetroMation web standard, not the hardware standard — those two must never be mixed.

---

## Frame Structure

Each frame is 12 bytes (96 bits):

```
Byte 0 (bits  0– 7): 0xFF — sync byte, always all-ones
Byte 1 (bits  8–15): TD bits 1–8
Byte 2 (bits 16–23): TD bits 9–16
...
Byte 11 (bits 88–95): TD bits 89–96
```

The sync byte `0xFF` is the hardware decoder's frame lock mechanism. When the decoder observes 8 consecutive transitions (all ones = 8 mid-period transitions within the byte period), it locks onto that as a frame boundary. Three consecutive valid sync bytes are required before a decoder is considered "locked".

---

## BMC Levels (PCM Encoding)

For digital storage in a WAV file, the BMC signal is encoded as raw 16-bit signed PCM:

| State | PCM value           | Meaning     |
| ----- | ------------------- | ----------- |
| HIGH  | +32767 (`BMC_HIGH`) | Signal high |
| LOW   | -32768 (`BMC_LOW`)  | Signal low  |

These are the maximum-amplitude values for 16-bit signed integers, giving the cleanest possible square wave and maximum noise margin when re-decoded.

---

## PLL Tolerance Model

The real hardware uses an **analog PLL** to recover the clock. We model this with a ±30% tolerance window:

- Nominal full-bit run: 9 samples
- Acceptable full-bit range: 6–12 samples (±3)
- Nominal half-bit run: 4.5 samples
- Acceptable half-bit range: 3–6 samples (±1.5 → clipped to integers)

This tolerance is conservative (wider than a tight digital PLL) and matches observed KWS run-length spread. Runs outside this window are logged as BIT_ERROR by `bmc_decoder.py`.

---

## Blank Bits

Certain bit positions within each frame are **hardware-reserved** and must always be `0`. A `1` in these positions would trigger undefined actuator behaviour on the physical boards.

| Track | Blank bits (1-based) | Physical meaning                                                |
| ----- | -------------------- | --------------------------------------------------------------- |
| TD    | 56, 65, 70           | Unused board traces; physically connected to nothing functional |
| BD    | 45                   | Unused board trace                                              |

These must be checked at export time. See [sgm-validation-history.md](sgm-validation-history.md) for what happens when they're violated.
