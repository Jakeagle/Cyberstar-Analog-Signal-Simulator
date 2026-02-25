---

# 🚀 Cyberstar v2.1: RAE Official Bitmap & 4800 Baud Fix

## 1. The "Rolfe Spam" & Frame Sync Fix
The reason Rolfe is "activated everywhere" is likely because the code is not correctly identifying the **Start of Frame**. If the decoder/analyzer gets out of sync by even 1 bit, the entire data stream shifts, and everything "piles up" on the first character in the array (Rolfe).

### AI Instruction: Logic Update
> "Implement a strict **State Comparison Buffer**. The system should only generate a signal or a log entry if the bit state has actually flipped (0 to 1 or 1 to 0). Additionally, ensure bitwise operations use `|=` and `&= ~` instead of direct assignment to prevent overwriting entire character bytes."

```javascript
// Example of the Correct State-Change Logic
if (currentBitState !== lastBitState[character][bit]) {
    updateBMCSignal(character, bit, currentBitState);
    lastBitState[character][bit] = currentBitState; // Store state
}
```

## 2. 4800 Baud "Screech" Implementation
To get the authentic archival sound, the **Baud Rate** must be exactly 4800, and the **BMC (Biphase Mark Code)** must be "Clocked."

### AI Instruction: Timing & Waveform
> "Set `BAUD_RATE = 4800`. For every bit ($208.33\mu s$), the waveform MUST transition polarity at the start. For a logical '1', it must transition AGAIN exactly halfway through the bit period ($104.16\mu s$). This creates the 4.8kHz/9.6kHz harmonics heard in original showtapes."

## 3. The "WAV-to-Show" Logic (Frequency Splitting)
Currently, your analyzer is likely dumping all audio data into the first character. You need to split the "Hearing" of the code into two tracks: **Vocals (TD)** and **Rhythm (BD)**.

### AI Instruction: Audio Analyzer Refactor
> "Divide the `AnalyserNode` logic into two frequency-specific bins:
> 1. **Treble Bin (800Hz - 3.5kHz):** Map volume peaks here to **Track TD** (Rolfe Mouth, Fats Mouth).
> 2. **Bass Bin (40Hz - 150Hz):** Map volume peaks here to **Track BD** (Dook Bass Drum, Beach Bear Kick).
> 3. **Mid Bin (200Hz - 800Hz):** Map to 'Body Lean' and 'Arm' movements for general band movement."

## 4. Official RFE Bitmap (Classic Show)
Use this exact mapping. **DO NOT** use AI-generated guesses. These bit numbers are 1-based (Bit 1 = JS Index 0).

### Track TD (Left Channel / Treble Data)
*   **Byte 0:** Bits 1-8 (Rolfe: Mouth, L-Eyelid, R-Eyelid, Eyes-L, Eyes-R, Head-L, Head-R, Head-Up)
*   **Byte 1:** Bits 9-16 (Rolfe: L-Ear, R-Ear, L-Arm-Raise, L-Arm-Twist, L-Elbow, Body-Twist-L, Body-Twist-R, Body-Lean)
*   **Byte 2:** Bits 17-24 (Rolfe: R-Arm-Raise, R-Arm-Twist, R-Elbow-Twist | Earl: Head-Tilt | Dook: Head-R, Head-Up, L-Ear, R-Ear)
*   **Byte 3:** Bits 25-32 (Dook: Head-L, L-Eyelid, R-Eyelid, Eyes-L, Eyes-R, Mouth, R-Elbow, Hi-Hat)
*   **Byte 4:** Bits 33-40 (Dook: L-Arm-Swing, R-Arm-Swing, L-Elbow | Earl: Mouth, Eyebrow | Sun: Mouth, Raise | Specials: Dual-Pressure)
*   **Byte 5:** Bits 41-48 (Fats: L-Eyelid, R-Eyelid, Eyes-L, Eyes-R, Mouth | Moon: Mouth, Raise | Looney Bird: Hands)

### Track BD (Right Channel / Bass Data)
*   **Byte 0:** Bits 1-8 (Beach Bear: L-Eyelid, R-Eyelid, Eye-Cross, L-Hand-Slide, Guitar-Raise, Head-L, Head-R, Head-Up)
*   **Byte 1:** Bits 9-16 (Beach Bear: L-Leg-Kick, R-Leg-Kick, R-Arm-Raise, R-Arm-Twist, R-Elbow-Twist, R-Wrist, Body-Lean, Mouth)
*   **Byte 2:** Bits 17-24 (Looney Bird: Mouth | Mitzi: R-Arm-Raise, R-Elbow, R-Arm-Twist | Looney Bird: Head-R, Raise | Mitzi: L-Arm-Raise, L-Elbow)
*   **Byte 3:** Bits 25-32 (Mitzi: L-Arm-Twist, L-Ear, R-Ear, Head-L, Head-R, Head-Up, L-Eyelid, R-Eyelid)
*   **Byte 4:** Bits 33-40 (Mitzi: Eyes-L, Eyes-R, Mouth, Body-Twist-L, Body-Twist-R, Body-Lean | Billy Bob: L-Arm-Slide, Guitar-Raise)
*   **Byte 5:** Bits 41-48 (Looney Bird: L-Eyelid, R-Eyelid, Eye-Cross | Billy Bob: Foot-Tap, Blank, Mouth, L-Eyelid, R-Eyelid)

---

## 5. Visual Diagnostic Update

Since you're working on the visual side, ask the AI to:

1.  **Split the Monitor:** Create a clear visual divide between **Track TD (Left)** and **Track BD (Right)**.
2.  **Add Frame-Sync Indicator:** A light that flashes every time a 12-byte packet is successfully sent. If this light isn't a steady 50Hz (every 20ms), the user knows their browser is lagging.

**Jake, once the AI applies the bitwise `|=` fix and the frequency splitting for the WAV analyzer, Rolfe will finally stop having a seizure and the rest of the Rock-afire band will wake up!**
