# Data Flow — End-to-End Overview

This folder documents how data moves through the Cyberstar Simulator from an audio file to a hardware-ready export. Reading this first will help you understand why each module exists and what it transforms.

---

## The Full Pipeline

```
┌─────────────────────┐
│  User's audio file  │  (WAV only — MP3 and other formats are not valid)
└────────┬────────────┘
         │ Web Audio API: decodeAudioData()
         ▼
┌─────────────────────┐
│  AudioBuffer        │  44100 Hz, N-channel, Float32
└────────┬────────────┘
         │ show-builder.js: _mixAndDecimate()
         ▼
┌─────────────────────┐
│  Mono Int16Array    │  11025 Hz, single channel
└────────┬────────────┘
         │ Pyodide → SCME/SAM/show_bridge.py
         ▼
┌─────────────────────┐
│  .cybershow.json    │  50 fps timeline of character movements
└────────┬────────────┘
         │ app.js: buildPlaybackSchedule()
         ▼
┌─────────────────────┐
│  playbackSchedule   │  Sorted array of {timeMs, char, movement, state}
└────────┬────────────┘
         │ app.js: schedulerTick() → applyMovement()
    ┌────┴────┐
    │         │
    ▼         ▼
[Preview]    [Export]
    │         │
    │         │ app.js: exportBroadcastWav()
    │         │ Pyodide → SCME/SGM/export_bridge.py
    │         ▼
    │  ┌─────────────────────┐
    │  │  4-channel WAV      │  Ch0=MusicL, Ch1=MusicR, Ch2=TD BMC, Ch3=BD BMC
    │  └──────┬──────────────┘
    │         │
    │    ┌────┴────────────────────┐
    │    ▼                         ▼
    │  .rshw (NRBF)              .cso (CSO1 binary)
    │  for RR-Engine legacy      planned decoder (not yet in RR-Engine)
    │
    ▼
cyberstar-signals.js
CyberstarSignalGenerator
→ Web Audio API (speakers/monitor output)
```

---

## Data Formats at Each Stage

| Stage            | Format                       | Who produces it    | Who consumes it                           |
| ---------------- | ---------------------------- | ------------------ | ----------------------------------------- |
| Raw audio file   | WAV only                     | User               | Web Audio API                             |
| AudioBuffer      | Float32Array[], 44100Hz      | Web Audio API      | show-builder.js                           |
| Mono Int16Array  | 11025 Hz                     | show-builder.js    | SAM (Python)                              |
| .cybershow.json  | JSON v3.0, 50fps             | SAM (Python)       | app.js                                    |
| playbackSchedule | JS array                     | app.js             | Playback engine                           |
| Frame buffer     | Uint8Array[12] × 2           | app.js             | CyberstarSignalGenerator                  |
| BMC PCM          | Int16[], 44100Hz, 9 samp/bit | export_bridge.py   | WAV assembler                             |
| 4-channel WAV    | RIFF/WAVE 4ch 16-bit         | encodeMultiChWAV() | .rshw / .cso exporters                    |
| .rshw            | NRBF binary                  | rshw_builder.py    | RR-Engine                                 |
| .cso             | CSO1 binary                  | cso-exporter.js    | Planned RR-Engine decoder (not yet built) |

---

## Subpages

- [audio-pipeline.md](audio-pipeline.md) — Detailed explanation of the audio decode and downsampling steps
- [signal-encoding.md](signal-encoding.md) — How choreography events become BMC frames and PCM samples
- [cybershow-format.md](cybershow-format.md) — Full specification of the `.cybershow.json` internal format
