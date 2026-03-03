# Audio Pipeline — WAV Loading and Export Embedding

> **v2 Legacy Note:** In v2, this document described the `show-builder.js` pipeline
> that fed audio into the SAM (Show Analysis Module) for choreography auto-generation.
> SAM is **no longer invoked from the browser UI in v3**. The v2 pipeline is preserved
> at the bottom of this page for historical reference.

This page explains how audio files are handled in the Lychee Conductor v3.

---

## v3 Audio Handling

In v3, the user may optionally load a WAV file via the **"Load WAV"** toolbar button.
Audio serves two purposes only:

1. **Playback reference** — hear the music in sync with the piano roll timeline cursor
   while drawing choreography
2. **Export embedding** — music samples are interleaved into channels 1 and 2 of the
   4-channel output WAV; channels 3 and 4 carry the BMC control signals

Loading a WAV is entirely optional. A show can be authored, exported, and validated with
no audio file at all. Channels 1 and 2 of the export will be silent in that case.

---

### Step 1 — File Decode (Web Audio API)

The user clicks "Load WAV". JavaScript reads the file as an `ArrayBuffer` and passes it to:

```js
audioCtx = new AudioContext({ sampleRate: 44100 });
audioCtx.decodeAudioData(arrayBuffer);
```

Result is an `AudioBuffer` held in the global `audioBuffer` variable:

- **Sample rate: always 44,100 Hz** — the `AudioContext` is explicitly constructed
  with `{ sampleRate: 44100 }`. The browser's decoder resamples the source file to
  this rate unconditionally, regardless of the file's original encoding (e.g. 48,000 Hz).
- Channels: as encoded in the file (stereo expected; mono is buffered as is)
- Sample precision: Float32, range [-1.0, 1.0]

> **Why forced to 44,100 Hz?** Without `{ sampleRate: 44100 }`, `new AudioContext()`
> adopts the OS audio device rate, which is 48,000 Hz on most Windows systems. The BMC
> signal encoder uses an integer constant of 9 samples per bit at 44,100 Hz. Mixing an
> `audioBuffer` decoded at 48,000 Hz into a WAV whose header declares 44,100 Hz caused
> the music to play back at 44,100/48,000 ≈ 91.9% speed — audibly flat and slow.
> Forcing 44,100 Hz at context creation eliminates the mismatch entirely.

---

### Step 2 — Playback Reference

When the user presses Play in the toolbar, if `audioBuffer` is non-null:

```js
const src = audioCtx.createBufferSource();
src.buffer = audioBuffer;
src.connect(audioCtx.destination);
src.start(audioCtx.currentTime);
```

The decoded stereo buffer is played directly — no mixing, no resampling. The timeline
cursor advances using `performance.now()` (not the AudioContext clock) to remain immune
to AudioContext suspend.

---

### Step 3 — Export Embedding

When the user clicks "Export 4ch WAV", `export4chWAV()` calls the Python SGM via
Pyodide to render the BMC signal tracks at 44,100 Hz / 9 samples-per-bit, then
directly copies `audioBuffer` channel data into the assembled WAV:

```js
const musL = new Float32Array(n);
const musR = new Float32Array(n);
if (audioBuffer) {
  const s0 = audioBuffer.getChannelData(0);
  musL.set(s0.subarray(0, Math.min(s0.length, n)));
  const s1 =
    audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : s0;
  musR.set(s1.subarray(0, Math.min(s1.length, n)));
}
```

- Channel 0 of `audioBuffer` → Music Left (output WAV channel 1)
- Channel 1 of `audioBuffer` (or ch 0 if mono) → Music Right (output WAV channel 2)
- Channels 3–4 come from Python (`td_b64` / `bd_b64`, base64-decoded Int16 PCM)

Because the `AudioContext` is created at 44,100 Hz (Step 1), `audioBuffer.sampleRate`
always equals `result.sample_rate` (44,100). The copy is direct — no resampling step
is needed at export time. `_encodeMultiChWAV` then interleaves all four channels as
16-bit LE PCM into a standard RIFF/WAVE container.

---

### What Is NOT Done in v3

| v2 Step                                    | v3 Status                                                 |
| ------------------------------------------ | --------------------------------------------------------- |
| Mix to mono                                | Not performed — stereo channels passed directly to export |
| Decimate to 11,025 Hz                      | Not performed — SAM analysis not called from the UI       |
| Convert to Int16 on the JS side            | Not performed — Python handles this internally            |
| Pass samples to SAM via Pyodide            | Not performed — SAM not called from the browser UI in v3  |
| Frequency band splitting (bass/mid/treble) | Not performed — no auto-choreography in v3 UI             |
| Onset detection / BPM estimation           | Not performed — no auto-choreography in v3 UI             |

---

## v2 Legacy — SAM Audio Analysis Pipeline

The following describes the v2 audio pipeline used by `show-builder.js`. That module is
**not loaded** by `index.html` in v3 and the functions below are not called from the UI.
Preserved for developers using SAM as a standalone command-line tool.

---

### v2 Step 1: File Decode (Web Audio API)

The user drops a WAV file or clicks "Upload Audio". JavaScript reads the file as an
`ArrayBuffer` and passes it to:

```js
audioContext.decodeAudioData(arrayBuffer);
```

Only WAV files are accepted. `AudioBuffer` is always:

- Sample rate: whatever the file was encoded at (commonly 44,100 or 48,000 Hz)
- Channels: however many the file has (1–8 common)
- Sample precision: Float32, range [-1.0, 1.0]

The original format and bit depth are discarded after this step. From here on everything is Float32.

---

### v2 Step 2: Mix to Mono

`show-builder.js` calls `_mixAndDecimate(audioBuffer, 11025)`, which first mixes all channels:

```js
const mono = new Float32Array(srcLen);
for (let ch = 0; ch < nCh; ch++) {
  const d = audioBuffer.getChannelData(ch);
  for (let i = 0; i < srcLen; i++) mono[i] += d[i] / nCh;
}
```

Each sample is the average across all channels. This preserves overall loudness and catches
events on any channel — a guitar solo on the right channel should still trigger movement.

---

### v2 Step 3: Box-Filter Downsample to 11,025 Hz

The mono `Float32Array` at the original sample rate is decimated to 11,025 Hz. This is a
4× reduction when the source is 44,100 Hz (most common case).

A **box-filter averager** is used rather than simple skip-sampling:

```js
const step = Math.round(srcSr / targetSr);  // e.g. 4
for each output sample i:
    output[i] = average of src[i*step ... i*step + step - 1]
```

#### Why not skip-sample?

Skip-sampling (taking every Nth sample) is equivalent to sampling without anti-aliasing.
Frequencies above the Nyquist of the target rate (11025/2 = 5512 Hz) would alias into the
analysis band as phantom low-frequency energy, causing false onset detections. The box
filter acts as a simple low-pass before decimation.

#### Why 11,025 Hz?

- Sufficient for the frequency bands SAM analyses (bass 20–250 Hz, mid 250–4000 Hz,
  treble 4000–8000 Hz — all well below 5512 Hz Nyquist)
- Exactly 1/4 of 44,100 Hz — no fractional arithmetic needed for integer step size
- 4× fewer samples = 4× faster Python analysis with no loss of choreography accuracy

---

### v2 Step 4: Convert to Int16

The downsampled `Float32Array` is converted to `Int16Array` (range -32768 to 32767):

```js
const int16 = new Int16Array(outLen);
for (let i = 0; i < outLen; i++) {
  int16[i] = Math.max(-32768, Math.min(32767, Math.round(mono[i] * 32767)));
}
```

Int16 is used because:

- It is what NumPy's onset detector expects as input
- Smaller array = faster Pyodide data transfer (half the bytes)
- 16-bit resolution is more than sufficient for onset detection

---

### v2 Step 5: Pass to Python via Pyodide

The `Int16Array` is converted to a plain JavaScript `Array` (required for reliable Pyodide
transfer) and passed to `analyze_and_choreograph_json()` in `SCME/SAM/show_bridge.py`:

```js
const samplesArray = Array.from(int16Samples);
const fn = pyodide.globals.get("analyze_and_choreograph_json");
const jsonStr = fn(samplesArray, 11025, band, title, durationMs);
```

---

### v2 Step 6: Python Audio Analysis (show_bridge.py)

All of the following happens inside Python running in Pyodide. JavaScript waits for a JSON
string back.

#### 6a: Frequency Band Splitting

`_analyze_audio(samples, sr)` splits the audio into three frequency bands using **boxcar
(moving-average) filters on the absolute-value signal** — no FFT is used:

```python
w_slow = max(1, sr // 150)    # window covering ~1/150 Hz -> bass envelope
w_fast = max(1, sr // 2000)   # window covering ~1/2000 Hz -> separates treble

lp_slow = moving_mean(abs(x), w_slow)   # bass envelope
lp_fast = moving_mean(abs(x), w_fast)   # mid+treble envelope

bass_sig   = lp_slow
mid_sig    = clip(lp_fast - lp_slow, 0)   # energy between bass and treble
treble_sig = clip(abs(x) - lp_fast,  0)   # high-frequency energy above mid
```

Energy is computed in 50 ms chunks (`chunk = sr * 0.050`). NumPy is used when available
(Pyodide 0.27 always provides it); a pure Python fallback handles edge cases.

#### 6b: Onset Strength

`_onset_strength(energy_list)` converts per-chunk energy into an onset-strength curve:

```python
onset[i] = max(0, energy[i] - energy[i-1])
```

A combined onset curve is computed: `combined = bass + 0.6 × mid + 0.3 × treble`.

#### 6c: Peak Picking

`_find_peaks(onset_curve, threshold, min_gap_chunks)` finds local maxima above a threshold
with a minimum gap between peaks:

- Beat peaks: combined onset curve, threshold=0.25, min gap=150 ms
- Bass peaks: bass onset curve, threshold=0.30, min gap=150 ms
- Treble peaks: treble onset curve, threshold=0.25, min gap=80 ms

#### 6d: BPM Estimation

`_estimate_bpm(beat_times_s)` estimates tempo from the inter-onset intervals using the
**median interval**:

```python
intervals = [t[i+1] - t[i] for i in range(len(t)-1)]
median_interval = sorted(intervals)[len(intervals) // 2]
bpm = round(60.0 / median_interval)
```

Result is clamped to 60–210 BPM.

#### 6e: Choreography Generation

`_choreograph()` maps each detected beat to character movements using band-specific role
tables (`_ROCK` or `_MUNCH`). Each character has:

- **Role** (`drums`, `lead_vocalist`, `vocalist`, `keyboardist`, `guitarist`, `lights`, etc.)
- **Movement lists per band** (`bass`, `mid`, `treble`) — cycled through in order
- **Hold durations** per band class (in frames at 50 fps)

For each beat, the dominant frequency class is determined and the appropriate movement is
fired for the matching characters. Vocalists additionally receive **soft idle movements**
on treble-only onsets that aren't near a beat.

All cues are `{frame, movement, state: true/false}` pairs — one ON and one OFF per
activation.

#### 6f: Output

Returns a `.cybershow.json` v3.0 string:

```json
{
  "cyberstar_show": true,
  "version": "3.0",
  "title": "...",
  "band": "rock",
  "duration_ms": 256000,
  "duration_frames": 12800,
  "fps": 50,
  "bpm": 84,
  "description": "Auto-generated by Cyberstar Online SAM...",
  "characters": { "Rolfe": {"signals": [...]}, ... }
}
```

JavaScript parses this and stores it as the current show.

---

### What the v2 Audio Pipeline Was NOT Used For

The audio samples that go into Python were **only for analysis** (tempo detection, onset
detection, frequency splitting). They were **not** the music embedded in the final export.

The export music came from the **original `AudioBuffer`** (full stereo, 44,100 Hz), which
is held in memory throughout. The downsampled mono array was a cheaper analysis proxy.
