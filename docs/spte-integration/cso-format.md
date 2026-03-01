# .cso File Format — Cyberstar Online Format Specification

The `.cso` (Cyberstar Online) format is a **custom** binary file format for Cyberstar show data. It stores pre-decoded frame bitmasks and music PCM in a compact layout. A decoder for this format was planned to be built into RR-Engine, but has not been implemented yet. Currently, `.cso` files are produced by the Cyberstar Simulator as a future-ready format.

---

## Why CSO Exists

The `.rshw` format stores audio and an encoded signal. RR-Engine must decode that signal at load time. For long shows or lower-spec hardware, this takes meaningful time and introduces a possible failure point (decoding errors at load).

CSO was designed to solve this by pre-computing the decoded frame data offline (in the simulator) and storing it directly. Once a decoder is built into RR-Engine, it would be able to map the file into memory and play it frame-by-frame with zero processing overhead. **That decoder has not been built yet.** The `.cso` format exists now so the file structure is established and ready for when the decoder is eventually implemented.

---

## File Layout

```
Offset      Size    Type        Field
────────────────────────────────────────────────────────────
0           4       char[4]     Magic: "CSO1" = 0x43 0x53 0x4F 0x31
4           1       uint8       Version: 1
5           4       uint32 LE   Frame count
9           4       uint32 LE   Sample rate (44100)
13          4       uint32 LE   Music data size in bytes
17          47      bytes       Reserved (all zeros — padding to 64-byte header)
────────────────────────────────────────────────────────────
64          frameCount × 24     Frame data block
            (per frame: 12 bytes TD bitmask + 12 bytes BD bitmask)
────────────────────────────────────────────────────────────
64 + frames musicDataSize       Music data block
            Stereo 16-bit PCM, interleaved L R L R...
            Big enough for the full show duration
────────────────────────────────────────────────────────────
```

### Key Constants

| Constant      | Value                                 | Source                                    |
| ------------- | ------------------------------------- | ----------------------------------------- |
| Magic         | `CSO1`                                | Custom magic bytes chosen for this format |
| Header size   | 64 bytes                              | Fixed                                     |
| Frame bytes   | 24 bytes/frame                        | 12 TD + 12 BD                             |
| Frame rate    | 45.9375 fps                           | 4410 / 96                                 |
| Sample rate   | 44,100 Hz                             | Hardware confirmed                        |
| TD frame bits | 94 (blank bits excluded from bitmask) | RAE_Bit_Chart_2.pdf                       |
| BD frame bits | 96 (blank bit excluded)               | RAE_Bit_Chart_2.pdf                       |

---

## Frame Data Block Detail

Each frame's 24 bytes:

- Bytes 0–11: TD bitmask (96 bits, each bit = one actuator, bit 0 = TD bit 1)
- Bytes 12–23: BD bitmask (96 bits, each bit = one actuator, bit 0 = BD bit 1)

Within each 12-byte bitmask, bit ordering is:

- Most-significant bit of byte 0 = actuator bit 1
- Least-significant bit of byte 11 = actuator bit 96

Blank bits (TD: 56, 65, 70; BD: 45 — 1-based) must always be `0`.

---

## Music Data Block Detail

Stereo 16-bit signed PCM at 44,100 Hz, interleaved:

```
[L_0, R_0, L_1, R_1, ..., L_N, R_N]
```

where each sample is a 16-bit little-endian signed integer.

Total music data size = `sample_count × 2 channels × 2 bytes` = `sample_count × 4`.

The music block starts at byte `64 + frameCount × 24`.

---

## Validation at Export Time

Before writing the CSO, `cso-exporter.js` validates every frame:

1. **Sync check**: First byte of every decoded TD and BD frame (before bitmask packing) must be `0xFF`. This was established during BMC decode — a sync failure means the input WAV was malformed.

2. **Blank bit check**: Bits 56, 65, 70 in TD and bit 45 in BD must be `0`. A `1` in these positions indicates an encoder bug.

3. **Error rate**: If more than 2% of frames fail either check, the export report warns the user. The file is still written (it may still work partially) but the warning should be heeded.

---

## Planned Reader in RR-Engine (Not Yet Implemented)

A `CsoDecoder` for RR-Engine was planned but has **not been built yet**. The intended behavior when it is implemented:

1. Magic + version check
2. Header fields (frame count, sample rate, music size)
3. Memory-map the frame block
4. Stream frame bitmasks directly to the hardware output driver at 45.9375 fps
5. Simultaneously stream music PCM to the audio output

Until the decoder is built, `.cso` files cannot be loaded into RR-Engine. Use `.rshw` for actual playback in RR-Engine/SPTE.

---

## Differences from .rshw

| Aspect         | .rshw                       | .cso                                  |
| -------------- | --------------------------- | ------------------------------------- |
| Encoding       | NRBF (C# BinaryFormatter)   | Custom binary                         |
| Signal storage | Encoded signalData int[]    | Pre-decoded bitmasks                  |
| Frame rate     | 60 fps                      | 45.9375 fps                           |
| Music storage  | Full WAV bytes              | Raw PCM (no WAV header)               |
| Video support  | Yes (videoData field)       | No                                    |
| Load overhead  | BMC decode required         | None                                  |
| Format age     | Legacy (original RR-Engine) | Custom (decoder not yet in RR-Engine) |
