# Signal Encoding — From Choreography to BMC Frames

This page explains the path from a choreography timeline (character movements at millisecond timestamps) to the Biphase Mark Code PCM signal that SPTE decodes.

---

## Starting Point: The Choreography Sequence

After SAM analysis (or manual editing), the choreography is a list of events:

```json
[
  {"time_ms": 1000, "character": "Rolfe", "movement": "mouth", "state": true},
  {"time_ms": 1083, "character": "Rolfe", "movement": "mouth", "state": false},
  {"time_ms": 1125, "character": "Dook LaRue", "movement": "hi_hat", "state": true},
  ...
]
```

---

## Step 1: Map Movements to Hardware Channels

Each `(character, movement)` pair is looked up in the channel maps:

- JavaScript side: `CHARACTER_MOVEMENTS` in `character-movements.js`
- Python side: `TD_CHANNELS` / `BD_CHANNELS` in `SCME/SMM/constants.py`

Result: each event becomes a `(track, bit_number, state)` tuple.

```
("Rolfe", "mouth", true) → ("TD", bit=1, state=True)
("Beach Bear", "mouth", true) → ("BD", bit=16, state=True)
```

---

## Step 2: Build Frame-by-Frame State Timeline

The signal must be **continuous** — a new 96-bit frame is transmitted every 1/45.9375 seconds (~21.77 ms). Between events, the frame content is held from the previous frame (actuators stay in their last state) or cleared to the idle frame.

The Python `FrameBuilder` (`SCME/SGM/frame_builder.py`) converts the event list into a full timeline:

1. Sort all events by `time_ms`
2. Calculate which frame number each event falls on: `frame = int(time_ms / 1000 * frame_rate)`
3. Between event frames: repeat the last frame (hold state)
4. At each event frame: flip the specified bit on or off

The result is a list of `(td_frame_bytes, bd_frame_bytes)` tuples — one per output frame.

---

## Step 3: BMC Encode Each Frame

Each 12-byte frame (96 bits) is fed to the BMC encoder.

### Encoding Rules

For each bit position `i` (0–95):

1. **Always** transition the output level at the start of the bit period.
2. If `bit = 1`: add another transition at the midpoint (after 4 samples of the 9-sample period).
3. If `bit = 0`: no midpoint transition.

### Sample-Level Detail (9 samples per bit, 4800 baud)

```
Bit '0'  (one transition):
  prev_level = HIGH:    [LOW  LOW  LOW  LOW  LOW  LOW  LOW  LOW  LOW]
  prev_level = LOW:     [HIGH HIGH HIGH HIGH HIGH HIGH HIGH HIGH HIGH]

Bit '1'  (two transitions):
  prev_level = HIGH:    [LOW  LOW  LOW  LOW  HIGH HIGH HIGH HIGH HIGH]
  prev_level = LOW:     [HIGH HIGH HIGH HIGH LOW  LOW  LOW  LOW  LOW ]
```

The encoder is **stateful** — it remembers the output level after each bit so adjacent frames are phase-continuous. This is critical for the hardware PLL to maintain lock across frame boundaries.

---

## Step 4: Assemble the PCM Stream

Each frame's 96 bits produce `96 × 9 = 864 samples` per frame. At 4800 baud and 44,100 Hz, the frame occupies exactly `44100 / 45.9375 ≈ 960 samples` of time.

The `SGM export_bridge.py` builds two parallel arrays of Int16 samples:

- `td_pcm` — the complete TD signal from frame 1 to frame N
- `bd_pcm` — the complete BD signal from frame 1 to frame N

Both arrays have the same length: `N_frames × samples_per_frame_actual`.

---

## Step 5: Add Music and Assemble 4-Channel WAV

The music (original stereo AudioBuffer) is extracted as two `Float32Array`s and added as channels 0 and 1. The control signals become channels 2 and 3.

All four channels are interleaved into a standard multi-channel RIFF/WAVE file:

```
WAV channel layout:
  Ch 0 (L): Music left
  Ch 1 (R): Music right
  Ch 2:     TD control signal (Treble Data)
  Ch 3:     BD control signal (Bass Data)
```

SPTE hardware and RR-Engine both expect exactly this channel order at 44,100 Hz 16-bit.

---

## Step 6: Validate

After export, `SCME/SVM/validate.py` (or the browser-side `stDirectDecode`) verifies:

- The sync byte (`0xFF`) appears in the first byte of every decoded frame
- Blank bits (TD: 56, 65, 70; BD: 45 — 1-based) are `0` in ≥ 98% of frames
- Bit error rate (bits outside PLL tolerance) is ≤ 2%

If validation passes, the file is hardware-safe. If it fails, the validation report explains which check failed and why.

---

## Common Failure: Wrong Baud Rate

The most common encoding mistake observed in earlier versions was using 4,410 baud (10 samples/bit) instead of the hardware 4,800 baud (9 samples/bit). The browser preview generator uses 4,410 baud intentionally (integer-exact at 44,100 Hz). The Python export pipeline uses 4,800 baud to match physical hardware. **Never mix the two in the same signal.**
