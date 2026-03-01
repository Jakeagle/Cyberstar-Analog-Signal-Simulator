# SPTE Integration — Overview

SPTE (Showbiz Pizza Time Experience) is a Unity 3D game for show creation and playback. It is a mod of **RR-Engine** — an open-source Unity 3D show creation and playback game. SPTE connects to physical Cyberstar animatronic hardware and sends pulses to the pneumatic valve solenoids that animate the figures.

This folder covers everything about the interface between the Cyberstar Simulator and SPTE.

---

## How the App Connects to SPTE

The simulator does not talk directly to SPTE at runtime. There is no network protocol, serial port, or live feed. Instead, SPTE integration happens **at export time** — the simulator produces files that SPTE can load and play.

```
Cyberstar Simulator (browser)
       │
       │  produces one or more of:
       ▼
┌──────────────────────────────────────────┐
│  4-channel WAV  (.wav)                   │  Raw broadcast tape format
│  .rshw          (NRBF binary)            │  RR-Engine legacy format
│  .cso           (CSO1 binary)            │  Cyberstar Online custom format (planned RR-Engine decoder — not yet built)
└────────────────────┬─────────────────────┘
                     │  copied to SPTE machine
                     ▼
              RR-Engine / SPTE
              loads and plays
```

---

## Which Format Should I Export?

| Situation                                              | Recommended Format                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Any version of RR-Engine                               | `.rshw` — the supported format for RR-Engine/SPTE                |
| Future: Cyberstar Online decoder (not yet built)       | `.cso` — custom format; decoder planned but not yet in RR-Engine |
| Testing the signal with external hardware/oscilloscope | `4-channel WAV` — raw BMC on channels 2 and 3                    |
| Archiving/sharing                                      | `.cybershow.json` — human-readable, re-exportable                |

---

## File Format Pages

- [rshw-format.md](rshw-format.md) — Complete spec for the `.rshw` NRBF binary format
- [cso-format.md](cso-format.md) — Complete spec for the `.cso` CSO1 binary format
- [export-pipeline.md](export-pipeline.md) — Step-by-step walkthrough of the export pipeline

---

## SPTE Hardware Requirements

For the exported signal to be accepted by physical Cyberstar hardware:

| Requirement         | Value                                     |
| ------------------- | ----------------------------------------- |
| WAV sample rate     | 44,100 Hz only                            |
| WAV bit depth       | 16-bit signed PCM                         |
| WAV channels        | 4 (Music L, Music R, TD, BD)              |
| BMC baud rate       | 4,800 bps (9 samples/bit at 44,100 Hz)    |
| Frame sync          | First byte of every frame must be `0xFF`  |
| Blank bit integrity | ≥ 98% of frames must have blank bits = 0  |
| Bit error rate      | ≤ 2% of bits outside PLL tolerance window |

Any file that fails these requirements will either be rejected by RR-Engine at load time or produce garbage output on the animatronics.

---

## SPTE / RR-Engine Playback Notes

RR-Engine loads `.rshw` files and plays them back. Its internal operation is separate from the BMC signal encoding done by the simulator:

- SPTE accepts only 44,100 Hz WAV input (confirmed)
- SPTE's internal frame rate when reading `.rshw` is 60 fps (confirmed from `UI_ShowtapeManager.dataStreamedFPS`)
- SPTE handles its own signal output to hardware internally — the simulator does not need to know or replicate that process
