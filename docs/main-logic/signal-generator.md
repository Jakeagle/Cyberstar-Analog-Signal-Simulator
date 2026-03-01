# cyberstar-signals.js — Real-Time BMC Signal Generator

This module implements the `CyberstarSignalGenerator` class. It is responsible for generating the **live BMC control audio** stream during browser playback — the same signal that would appear on the control tracks of a real Cyberstar showtape.

This is entirely separate from the Python-side encoder. The JS generator renders audio in real-time for the browser preview. The Python encoder (`SCME/SGM/bmc_encoder.py`) is used for the final hardware-ready export.

---

## What is BMC?

**Biphase Mark Code (BMC)** is a self-clocking binary encoding scheme:

- There is **always** a transition at the **start** of every bit period.
- If the bit is `1`, there is an **additional** transition at the **midpoint**.
- If the bit is `0`, there is **no** midpoint transition.

This means a decoder can recover the clock purely from the transitions in the signal, without a separate clock track. This is the same encoding used in DAT tape, S/PDIF audio, and many other self-clocking protocols.

### Timing (RetroMation / KWS-confirmed)

| Parameter       | Value                             |
| --------------- | --------------------------------- |
| Sample rate     | 44,100 Hz                         |
| Baud rate       | 4,410 bps                         |
| Samples per bit | 10 (44100 ÷ 4410 — integer-exact) |
| Frame bits      | 96 (1 sync byte + 11 data bytes)  |
| Frame rate      | 45.9375 fps (4410 ÷ 96)           |
| Half-period A   | 5 samples                         |
| Half-period B   | 5 samples                         |

> **Note:** The JS generator uses 4,410 baud (10 samples/bit), while the Python encoder uses 4,800 baud (9 samples/bit). The JS side targets the RetroMation web standard for browser preview. Python targets the original Cyberstar hardware baud rate confirmed by KWS analysis. For hardware export, always use the Python pipeline.

---

## Frame Structure

Every frame is 12 bytes (96 bits):

```
Byte 0   : 0xFF  — sync byte (all bits high)
Bytes 1-6: TD data bytes (bits 1-48 of TD channels)
Bytes 7-11: TD data bytes (bits 49-94 of TD channels)
            (BD frame has its own parallel structure)
```

Two frames are generated per tick: one for **Track TD** (`trackTD`) and one for **Track BD** (`trackBD`). They are encoded and scheduled independently onto the Web Audio API.

---

## Class API

### Constructor

```js
const gen = new CyberstarSignalGenerator({
  amplitude: 0.6, // Signal amplitude (0.0–1.0)
  noiseLevel: 0.015, // Analog noise added for realism (0 in export mode)
  volume: 0.7, // Output volume
});
```

### Key Methods

| Method                               | Description                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `setBit(track, bitIndex, value)`     | Set a single actuator bit (0-indexed) in the current frame buffer      |
| `clearAllBits()`                     | Zero out both TD and BD frame buffers (all actuators off)              |
| `streamFrame()`                      | Encode current frame to PCM and schedule it for playback via Web Audio |
| `startStreaming()`                   | Begin continuous frame streaming at 45.9375 fps                        |
| `stopStreaming()`                    | Stop the streaming scheduler                                           |
| `encodeBMC(dataBytes)`               | Core encoder: converts `Uint8Array` → array of PCM sample values       |
| `scheduleAudioBuffer(samples, time)` | Push a pre-rendered PCM buffer to the Web Audio graph                  |

### Export Mode

When `isExporting = true`, the generator bypasses:

- The analog noise layer
- The lowpass filter (8 kHz cutoff)

This produces a **clean square wave** that digital decoders can read without error.

---

## Signal Chain (Browser Playback)

```
Frame buffer (TD + BD)
  ↓  encodeBMC()
PCM samples (Int16 array)
  ↓  AudioBuffer.copyToChannel()
AudioBufferSourceNode
  ↓  (optional) BiquadFilterNode (8kHz lowpass)
  ↓  GainNode
AudioContext.destination (speakers)
```

---

## Scheduling Ahead

The generator pre-schedules frames `SCHEDULE_AHEAD = 80ms` into the future using the Web Audio API clock (`AudioContext.currentTime`). This is standard Web Audio practice — it ensures glitch-free playback even if the JavaScript main thread is briefly blocked by the UI or Pyodide.

The scheduler runs via `setInterval` and calculates how many frames need to be queued before the next check.

---

## Dual-Track Output

The signal generator always operates on **both** tracks simultaneously:

- `trackTD` → WAV Channel 2 (left control track, high frequencies)
- `trackBD` → WAV Channel 3 (right control track, low frequencies)

During live preview, both are mixed into the stereo output for monitoring. During export, they are separated into discrete WAV channels.
