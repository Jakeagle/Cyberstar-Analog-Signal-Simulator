# cso-exporter.js — CSO Binary File Exporter

This module converts a finished **4-channel broadcast WAV** (produced by `app.js`) into a `.cso` (Cyberstar Online) binary file. A decoder for this format was planned to be built into RR-Engine, but has not been implemented yet. The file is produced now so the format is established and ready for future use.

---

## Why CSO?

The `.cso` (Cyberstar Online) format was designed to be more compact and easier to ingest than the `.rshw` legacy format. Instead of re-encoding raw audio data, CSO stores:

- Pre-decoded frame bitmasks (no BMC decoding needed at playback time)
- Raw music PCM (stereo, 16-bit, 44100 Hz)
- A fixed 64-byte header with metadata

The intent is for a RR-Engine decoder to play this directly with zero signal-processing overhead at runtime. **That decoder has not been built yet.** Exporting `.cso` from the simulator is safe and produces a valid file, but the file cannot be loaded into RR-Engine/SPTE until the decoder is implemented.

---

## CSO File Layout

```
Offset    Size    Content
──────────────────────────────────────────────
0         4       Magic: "CSO1" (0x43 0x53 0x4F 0x31)
4         1       Version: 1
5         4       Number of frames (uint32 LE)
9         4       Sample rate: 44100 (uint32 LE)
13        4       Music data size in bytes (uint32 LE)
17        47      Reserved (zeros)
64        ...     Frame data block:
                    Per frame: 12 bytes TD + 12 bytes BD = 24 bytes
                    Total: frameCount × 24 bytes
64+frames ...     Music data block:
                    Stereo 16-bit PCM, interleaved L/R
                    Size = musicSamples × 2 × 2 bytes
```

**Key constants:**

- Frame rate: 4410 ÷ 96 = 45.9375 fps
- Frame size: 24 bytes (12 TD + 12 BD)
- Header size: 64 bytes (always)

---

## Export Pipeline

### Step 1: Parse WAV

The input 4-channel WAV is parsed to extract four `Float32Array` channels:

- Ch0 = Music L
- Ch1 = Music R
- Ch2 = TD BMC signal
- Ch3 = BD BMC signal

### Step 2: BMC Decode TD and BD

`stDirectDecode()` (from `app.js`, globally available) decodes each control track from its BMC signal waveform back into a flat `Uint8Array` of `0`/`1` bits.

### Step 3: Segment into Frames

The bit stream is sliced into 96-bit frames. Each frame starts at a multiple of 96 bits from the stream start.

### Step 4: Validate Frames (Optional)

Each frame is checked:

- **Byte 0 must be `0xFF`** (sync byte). If it isn't, the frame is flagged as a sync error.
- **Blank bits must be `0`**: TD bits 56, 65, 70 and BD bit 45 are reserved hardware slots that must never be `1`. A `1` in a blank bit means the encoder produced a malformed frame.

Validation failures are logged to the report. If more than 2% of frames fail, the export is marked with a warning but still proceeds (the user can inspect the report).

### Step 5: Pack Frame Bitmasks

Each 96-bit (12-byte) TD frame and each 96-bit BD frame are packed into raw `Uint8Array` buffers. These are the bitmasks that RR-Engine reads directly — one bit per actuator.

### Step 6: Extract Music PCM

Music channels (Ch0 and Ch1) are interleaved (L, R, L, R...) and converted to 16-bit signed integers.

### Step 7: Write Binary .cso

All sections are assembled into a single `ArrayBuffer` using `DataView`:

```
Header (64 bytes) + Frame data + Music data
```

A `Blob` is created and downloaded.

---

## Usage

```js
const result = await exportCso(fourChannelWavBuffer, {
  validate: true,
  verbose: false,
});
if (result.ok) {
  downloadBlob(result.blob, "myshow.cso");
} else {
  console.error(result.report.join("\n"));
}
```

---

## Dependencies

- `stDirectDecode()` must be defined globally (loaded from `app.js`)
- Input WAV must be 4-channel, 44100 Hz, 16-bit PCM

---

## Validation Report

The `result.report` array contains human-readable strings describing the export:

- How many frames were processed
- How many sync errors were found
- How many blank-bit violations were found
- Whether the export passed the 98% blank-bit integrity threshold (hardware requirement)

See [spte-integration/cso-format.md](../spte-integration/cso-format.md) for the full CSO specification.
