This Technical Specification is a corrected version. As requested, **all movements listed in the provided document are to be treated as part of the "Classic" Rock-afire Explosion (RFE) show.** This includes the Body Twist and Body Lean movements.

This document provides the AI agent with the exact logic to reach **4800 Baud**, implement the **Dual-Track (TD/BD)** system, and map the bits according to your provided chart.

---

# 🤖 AI Implementation Guide: Cyberstar Simulator v2.0 (Official RFE)

## 1. High-Speed Signal Engine (4800 Baud BMC)

To achieve the authentic "screech" and timing of a real Cyberstar system, the generator must be updated to the following spec.

### The Math:

- **Baud Rate:** 4800 bits per second (bps).
- **Bit Period ($T$):** $1 / 4800 \approx 208.33\mu s$.
- **BMC Logic:**
  - Every bit starts with a polarity transition (Clock flip).
  - **Logic '0':** No further transitions during the bit period.
  - **Logic '1':** An additional polarity transition occurs exactly halfway ($T/2$) through the bit period.
- **Screech Factor:** This creates a signal that oscillates between 2400Hz and 4800Hz. Ensure square waves are used to maintain high-frequency harmonics.

### The Stereo Split:

- **Left Channel:** Treble Data (TD Track).
- **Right Channel:** Bass Data (BD Track).

---

## 2. Track TD Map (Treble Data / Left Channel)

**Frame Length:** 12 Bytes (96 Bits total).
_AI Note: Map these to the Left Audio Buffer. Indices are 1-based from PDF; subtract 1 for JS arrays._

| Character/Group    | Bits (1-based) | Movements                                                                                                                                                                                                                                           |
| :----------------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rolfe**          | 1-19           | 1:Mouth, 2:L-Eyelid, 3:R-Eyelid, 4:Eyes-L, 5:Eyes-R, 6:Head-L, 7:Head-R, 8:Head-Up, 9:L-Ear, 10:R-Ear, 11:L-Arm-Raise, 12:L-Arm-Twist, 13:L-Elbow, 14:Body-Twist-L, 15:Body-Twist-R, 16:Body-Lean, 17:R-Arm-Raise, 18:R-Arm-Twist, 19:R-Elbow-Twist |
| **Earl**           | 20, 36, 37     | 20:Head-Tilt, 36:Mouth, 37:Eyebrow                                                                                                                                                                                                                  |
| **Duke (Dook)**    | 21-35, 63, 64  | 21:Head-R, 22:Head-Up, 23:L-Ear, 24:R-Ear, 25:Head-L, 26:L-Eyelid, 27:R-Eyelid, 28:Eyes-L, 29:Eyes-R, 30:Mouth, 31:R-Elbow, 32:Hi-Hat, 33:L-Arm-Swing, 34:R-Arm-Swing, 35:L-Elbow, 63:Bass-Drum, 64:Body-Lean                                       |
| **Fats**           | 41-45, 51-62   | 41:L-Eyelid, 42:R-Eyelid, 43:Eyes-L, 44:Eyes-R, 45:Mouth, 51:Head-Tip-L, 52:Head-Tip-R, 53:Head-Up, 54:Head-L, 55:Head-R, 57:L-Arm-Swing, 58:R-Arm-Swing, 59:L-Elbow, 60:R-Elbow, 61:Foot-Tap, 62:Body-Lean                                         |
| **Props/Specials** | 38-40, 46-50   | 38:Sun-Mouth, 39:Sun-Raise, 40:Dual-Pressure, 46:Moon-Mouth, 47:Moon-Raise, 48:Looney-Bird-Hands, 49:Antioch-Down, 50:Baby-Bear-Raise                                                                                                               |
| **Organ Lights**   | 66-69, 71-75   | 66:Blue, 67:Red, 68:Amber, 69:Green, 71:Leg-Top, 72:Leg-Mid, 73:Leg-Bottom, 74:Cont-Strobe, 75:Flash-Strobe                                                                                                                                         |
| **Sign Lights**    | 76-80          | 76:Inner, 77:Mid, 78:Outer, 79:Cont-Strobe, 80:Flash-Strobe                                                                                                                                                                                         |
| **Spotlights**     | 81-88          | 81:Mitzi, 82:Beach, 83:Looney, 84:Bob, 85:Fats, 86:Duke, 87:Rolfe, 88:Earl                                                                                                                                                                          |
| **Curtains**       | 89-94          | 89:Stage-R-Open, 90:Stage-R-Close, 91:Center-Open, 92:Center-Close, 93:Stage-L-Open, 94:Stage-L-Close                                                                                                                                               |

---

## 3. Track BD Map (Bass Data / Right Channel)

**Frame Length:** 12 Bytes (96 Bits total).
_AI Note: Map these to the Right Audio Buffer._

| Character/Group  | Bits (1-based)      | Movements                                                                                                                                                                                                                                                                                              |
| :--------------- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Beach Bear**   | 1-16                | 1:L-Eyelid, 2:R-Eyelid, 3:Eye-Cross, 4:L-Hand-Slide, 5:Guitar-Raise, 6:Head-L, 7:Head-R, 8:Head-Up, 9:L-Leg-Kick, 10:R-Leg-Kick, 11:R-Arm-Raise, 12:R-Arm-Twist, 13:R-Elbow-Twist, 14:R-Wrist, 15:Body-Lean, 16:Mouth                                                                                  |
| **Looney Bird**  | 17, 21, 22, 41-43   | 17:Mouth, 21:Head-R, 22:Raise, 41:L-Eyelid, 42:R-Eyelid, 43:Eye-Cross                                                                                                                                                                                                                                  |
| **Mitzi**        | 18-20, 23-38        | 18:R-Arm-Raise, 19:R-Elbow, 20:R-Arm-Twist, 23:L-Arm-Raise, 24:L-Elbow, 25:L-Arm-Twist, 26:L-Ear, 27:R-Ear, 28:Head-L, 29:Head-R, 30:Head-Up, 31:L-Eyelid, 32:R-Eyelid, 33:Eyes-L, 34:Eyes-R, 35:Mouth, 36:Body-Twist-L, 37:Body-Twist-R, 38:Body-Lean                                                 |
| **Billy Bob**    | 39, 40, 44-63       | 39:L-Arm-Slide, 40:Guitar-Raise, 44:Foot-Tap, 46:Mouth, 47:L-Eyelid, 48:R-Eyelid, 49:Eyes-L, 50:Eyes-R, 51:Head-L, 52:Head-R, 53:Head-Tip-L, 54:Head-Tip-R, 55:Head-Up, 56:R-Arm-Raise, 57:R-Arm-Twist, 58:R-Elbow-Twist, 59:R-Wrist, 60:Dual-Pressure, 61:Body-Twist-L, 62:Body-Twist-R, 63:Body-Lean |
| **Specials**     | 64, 65              | 64:Tape-Stop, 65:Tape-Rewind                                                                                                                                                                                                                                                                           |
| **Flood Lights** | 66-69, 71-74, 76-79 | 66-69:Stage-R (B/G/A/R), 71-74:Center (B/G/A/R), 76-79:Stage-L (B/G/A/R)                                                                                                                                                                                                                               |
| **Prop Lights**  | 70, 75, 80          | 70:Applause, 75:Drums, 80:Fire/Still                                                                                                                                                                                                                                                                   |
| **Backgrounds**  | 81-87               | 81:Backdrop-Outside-Blue, 82:Backdrop-Inside-Amber, 83:Treeline-Blue, 84:Backdrop-Inside-Blue, 85:Treeline-Red, 86:Bushes-Green, 87:Bushes-Red/Amber                                                                                                                                                   |
| **Spots/Stage**  | 88-96               | 88:Sun-Spot, 89:Moon-Spot, 90:Spider-Spot, 91:Gas-Pump, 92:Service-Red, 93:Service-Blue, 94:Rainbow-1, 95:Rainbow-2, 96:Guitar-Spot                                                                                                                                                                    |

---

## 4. Coding Agent Instructions

1.  **Bitwise Integrity:** In `generateBMCSignal`, ensure you use bitwise masks. To trigger **Rolfe Mouth**, only flip bit 0 of Byte 0 in the TD track. **DO NOT** overwrite the entire byte; use `trackBuffer[byteIndex] |= (1 << bitIndex)`.
2.  **Clock Sync:** With 96 bits per frame at 4800 baud, each frame MUST be exactly **20ms** ($96/4800$).
3.  **Visualizer Update:** Rebuild the **TDM Frame Monitor** to show two distinct grids: one for **TD (Track D)** and one for **BD (Track B)**. Label every LED using the names in the tables above.
4.  **Audio Sync:** When "Play" is pressed, the TD and BD data streams must be perfectly sample-aligned in the Stereo output to prevent character sync drift.
5.  **State Logic:** Ensure the `systemLog` only logs a "movement" when the bit flips from 0 to 1, and "release" when it flips from 1 to 0.
