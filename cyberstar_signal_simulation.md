# Cyberstar / Cyberamic Control Signal Reference for Simulation

## Overview
This document summarizes known information about the **Cyberstar Animatronic Control System** and **Cyberamic control signal format**, providing technical context for creating a JavaScript/Web Audio API simulation.

The goal is to enable an AI code agent (or developer) to emulate the **analog control track audio** used to drive animatronic movements via the Cyberstar controller. This signal was encoded on tape and decoded into actuator commands.

---

## 1. Nature of the Control Signal
Cyberstar did **not** use musical or separate tones for each movement. Instead, it encoded **digital control data** on one audio channel of the show tape. This data was decoded into actuator commands for characters, lights, and effects.

### Key facts:
- Signal Type: Digital data encoded as an **analog waveform**
- Encoding: **Biphase Mark Code (BMC)** — a phase-based encoding method
- Purpose: Transmission of digital movement/control commands
- Medium: One analog audio track on reel/S-VHS/DVD media

This means the tape’s control channel, while analog in storage, represented a **binary digital data stream**.

---

## 2. Encoding Format: Biphase Mark Code (BMC)
BMC is similar to **Manchester encoding**. Each bit period contains at least one transition, making it self-clocking and robust to speed variations.

### BMC Characteristics:
| Bit Type | Mid-bit Transition | Transition at Bit Boundary |
|-----------|-------------------|-----------------------------|
| `1` | Yes | Yes |
| `0` | No  | Yes |

In practice, the analog signal alternates between positive and negative voltages at these transition points. The result sounds like a dense series of clicks or modulated noise — not discrete musical tones.

**Why BMC was used:**
- Resistant to tape speed variations
- Simple decoding logic
- Synchronization included inherently

---

## 3. Signal Chain Summary
```
Tape (Analog BMC) → Decoder Board (Digital Conversion) → CPU → Output Drivers → MAC Valves, Lights, Motors
```

- **Tape track:** Analog representation of digital data (BMC waveform)
- **Decoder:** Converts BMC to binary bits
- **CPU:** Interprets bytes into movement or timing commands
- **Outputs:** Control pneumatic valves, servos, lights, etc.

---

## 4. Audible Characteristics
The analog control signal was **not meant for human hearing**, but if listened to, it would resemble:

- Rapid pulses and transitions
- No distinct tones or musical notes
- Similar in sound to dial-up modem or digital data on tape

For simulation purposes, you can treat it as a **bipolar square wave** (e.g. +1 and -1 values) with transitions corresponding to bit timing.

---

## 5. Simulation Requirements (for Web Audio API)
To emulate this signal, a Web Audio API simulation should:

1. **Generate a binary data stream** — e.g., an array of bytes or bits.
2. **Encode using BMC** — insert transitions according to encoding rules.
3. **Render waveform to AudioBuffer** — +1/-1 amplitude transitions at sample points.
4. **Play or visualize** — output to `AudioContext.destination` or draw waveform.

### Example of core algorithm logic
```text
for each bit in data:
    if bit == 1:
        toggle signal at start of bit period
        toggle again at midpoint
    else:
        keep signal same for first half
        toggle at midpoint
```

Each toggle represents a phase transition — the key feature of BMC.

---

## 6. Optional Enhancements for Realism
To make the simulation sound or behave more authentic:
- Add low-pass filtering (~3 kHz cutoff) to simulate tape bandwidth.
- Add light noise (~-30 dB) to simulate analog imperfections.
- Allow adjustable **bitrate** (100–1200 bits/sec typical).
- Add visualization: scope-style waveform to display bit transitions.

---

## 7. Key Differences from Tone-Based Systems
| System Type | Encoding | Audible? | Example |
|--------------|-----------|-----------|----------|
| Cyberstar / Cyberamic | Biphase Mark (phase transitions) | No | Control data stream |
| Early Disney / MAPO | Analog tone per movement | Yes | Multi-frequency tones |

Cyberstar’s method is **binary and serialized**, while earlier systems used direct frequency-to-motion mappings.

---

## 8. Simulation Design Targets
When implementing in JS/Web Audio:

- **Bitrate:** ~300–1200 bps
- **Sample rate:** 44100 or 48000 Hz
- **Amplitude:** ±1 (square wave)
- **Encoding:** BMC (phase mark transitions)

Optional parameters:
```js
const params = {
  bitrate: 600,
  sampleRate: 48000,
  amplitude: 0.8,
  noiseLevel: 0.02,
  lowpassCutoff: 3000
};
```

---

## 9. Future Extensions
Future simulations could include:
- Full decoding logic to recover binary data from simulated tape.
- Multi-channel output (music + control).
- Visual timeline of control bytes representing character movements.

---

## 10. Summary
The Cyberstar control system used a **single-channel, Biphase Mark encoded digital data stream** stored as analog audio. The system converted these transitions into actuator commands in real time. For a realistic emulation:

- Use BMC encoding logic
- Generate a bipolar square-wave signal with transitions per bit
- Optionally add filtering/noise for realism

The result will accurately approximate what the analog control line sounded like, and can serve as the foundation for a Web Audio API simulation or visualization.

