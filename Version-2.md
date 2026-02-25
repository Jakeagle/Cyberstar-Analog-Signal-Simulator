This proposal outlines a technical roadmap to evolve the **Cyberstar Analog Signal Simulator** from a signal generator into a full-featured animatronic restoration and show-authoring suite.

---

# 🚀 Roadmap: Cyberstar Simulator v2.0 Improvements

## 1. Advanced Signal Processing: The "Jaw Gap" Fix

Current automated show generation relies on raw amplitude. To eliminate "unnatural" gaps in character movements (especially mouth movements), the detection engine needs **Hysteresis** and **State Management.**

### Technical Implementation:

- **Dual-Threshold Triggering (Hysteresis):**
  - Instead of a single "On/Off" volume threshold, use two:
    - **Upper Threshold (T1):** The volume required to _open_ the jaw.
    - **Lower Threshold (T2):** The volume below which the jaw _closes_.
  - _Result:_ This prevents "stuttering" during quiet consonants or micro-pauses in vocals.
- **Minimum Pulse Width (Sustain):**
  - Implement a `minMovementDuration` (approx. 60-100ms). If a movement is triggered, it cannot be turned off until the timer expires, even if the audio drops.
- **Anti-Lock Logic:**
  - If the system detects "Singing Mode" is active but no jaw bits have flipped in >400ms, the system should force a small "re-open" pulse to simulate natural mouth movement during held notes.

## 2. The "Virtual Stage" (Visualizer)

To bridge the gap between "hearing the data" and "seeing the show," a canvas-based visualizer should be added to the UI.

### Technical Implementation:

- **Sprite Mapping:**
  - Map bits from `character-movements.js` to specific DOM elements or Canvas sprites.
  - _Example:_ `Bit 0 (Munch Mouth)` toggles a CSS class `.mouth-open { transform: translateY(10px); }`.
- **Real-Time State Mirroring:**
  - Create a `CurrentState` object that updates every time a BMC packet is generated. The UI observes this object and moves the character parts in 60fps real-time.
- **Debug Mode:**
  - A grid of "LEDs" representing every bit on the virtual stage controller. When a packet sends a `1` to Bit 4, the LED for Bit 4 lights up.

## 3. The "Ambience Engine" (Idle Movement)

Characters currently appear "dead" during data gaps. We can fill these gaps with procedurally generated idle movements that don't interfere with the main show data.

### Technical Implementation:

- **Probability-Based Triggers:**
  - While a show is playing, run a background loop that has a % chance to trigger non-essential bits (Eyelid Blink, Ear Twitch, Slight Head Tilt).
- **Beat-Sync Integration:**
  - Use the `AudioContext` to detect the "Kick" drum frequency (~60Hz). When a peak is detected, trigger a "Body Lean" or "Head Bob" command automatically.
- **Conflict Resolution:**
  - The engine must prioritize "Show Data" over "Idle Data." If the WAV file says `Mouth=Open`, the Ambience Engine is blocked from touching that bit.

## 4. Signal Accuracy & Forensics

Improve the "Approximation" to be more functionally identical to the 1980s hardware output.

### Technical Implementation:

- **Waveform Shaping:**
  - Add a **BiquadFilterNode** (Low-Pass) at 8kHz to the output. Original LaserDisc audio had a natural roll-off; a perfectly square digital wave might be "too sharp" for some vintage decoders.
- **DC Offset Simulation:**
  - Add a toggle to simulate the slight DC bias or tape hiss found on original showtapes to test the robustness of your decoder logic.
- **Multi-Channel Support:**
  - Allow the user to select which channel (Left/Right) contains the data. This is essential for decoding "Split-Track" tapes where Audio is on Left and Data is on Right.

## 5. Show Editor & Data Export

Turn the simulator into a tool for creators to build _new_ shows.

### Technical Implementation:

- **JSON Show Export:**
  - Allow users to download the generated show as a JSON file containing timestamps and bit-states.
- **WAV "Burner":**
  - A function to take a JSON show-file and render it into a high-quality 44.1kHz WAV file containing nothing but the BMC data chirps. This file could then be played into real animatronic hardware.
- **Manual "Punch-In":**
  - Allow users to tap keys (1-8) during playback to manually record movements into the stream, essentially "performing" the character in real-time.

---

### Implementation Priority:

1.  **Priority 1:** Hysteresis/Jaw logic (improves immediate show quality).
2.  **Priority 2:** Digital "LED" grid (essential for debugging without hardware).
3.  **Priority 3:** 2D Virtual Character (makes the app "shareable" and fun).
4.  **Priority 4:** Export to WAV (makes the app a professional tool).
