# app.js — Central Application Coordinator

`app.js` is the largest single file (~2,000 lines) and acts as the glue between all other modules. It owns:

- Application startup and intro animation
- Band / character configuration
- Playback engine (scheduling, Web Audio API sync)
- Show import and export (`.cybershow.json`, 4-channel WAV, `.rshw`, `.cso`)
- Python progress modal
- UI event listeners

---

## Configuration Objects

### `BAND_CONFIG`

Defines the two supported animatronic bands and their characters:

```
"munch" → Chuck E. Cheese, Munch, Helen Henny, Jasper T. Jowls, Pasqually
"rock"  → Billy Bob, Mitzi, Fatz, Beach Bear, Dook LaRue, Rolfe, Earl
```

`currentBand` is a module-level string that tracks which band is active. Switching bands rebuilds the monitor panel and resets the signal generator state.

### `currentPlaybackState`

A plain object updated continuously during playback:

```js
{
  isPlaying: false,
  isPaused:  false,
  currentTime: 0,        // seconds into the show
  totalTime: 0,          // total show duration in seconds
  playbackSpeed: 1.0,    // 1.0 = real-time
  volume: 0.7,
}
```

---

## Playback Engine

### How it works (step by step)

1. **`buildCustomShowtape(file)`** — Called when the user uploads an audio file. It:
   - Decodes the WAV using `AudioContext.decodeAudioData()`
   - Passes the decoded `AudioBuffer` to `show-builder.js → buildShowWithPython()`
   - Receives a `.cybershow.json` object back
   - Converts the JSON timeline into `playbackSchedule` — an array of `{timeMs, character, movement, state}` events sorted by time

2. **`startPlayback()`** — Begins the show:
   - Resumes the Web Audio API context (needed after a user gesture)
   - Starts the audio via `playWAVFromBuffer()` using an `AudioBufferSourceNode` connected through a `GainNode`
   - Records `playbackStartTime = audioContext.currentTime`
   - Calls `schedulerTick()` on an interval

3. **`schedulerTick()`** — Runs every ~16ms (one animation frame or `setInterval`):
   - Computes `currentTime = audioContext.currentTime - playbackStartTime`
   - Drains `playbackSchedule` of all events whose `timeMs <= currentTime * 1000`
   - For each drained event, calls `applyMovement(character, movement, state)`
   - Updates progress bar and time display

4. **`applyMovement(character, movement, state)`** — Looks up the character+movement in `CHARACTER_MOVEMENTS` to get `{track, bit}`, then calls the `CyberstarSignalGenerator` instance to set that bit on or off in the current frame.

### WAV song sync

```
songBuffer    — decoded AudioBuffer for the loaded WAV
songSource    — current playing AudioBufferSourceNode
songGainNode  — gain node controlling volume
```

The song is played through the Web Audio API's clock, not `Date.now()`, so playback timing is sample-accurate and immune to JavaScript timer drift.

---

## Python Progress Modal (`pyModal`)

A small self-contained IIFE that controls a progress overlay shown while Pyodide is working:

```js
pyModal.open("Generating show...");
pyModal.update("Downsampled"); // advances the bar based on message content
pyModal.close();
```

The `STEP_MAP` array maps known log message substrings to percentage values so the UI progress bar advances predictably even though Python code is running asynchronously:

| Message substring         | Bar % |
| ------------------------- | ----- |
| "Preparing audio"         | 8     |
| "Downsampled"             | 22    |
| "Loading Python"          | 32    |
| "Running Python analysis" | 48    |
| "Analysis complete"       | 95    |
| "Generating BMC frames"   | 38    |
| "Mixing music channels"   | 72    |
| "Encoding 4-channel WAV"  | 88    |
| "Done"                    | 100   |

---

## Export Functions

### `exportBroadcastWav()`

The main export path. It:

1. Calls `pyModal.open("Exporting 4-channel WAV...")`
2. Loads Pyodide (or reuses the existing instance) and runs `SCME/SGM/export_bridge.py`
3. Calls the Python function `render_4ch_pcm_json(sequences_json, duration_ms)`
4. Receives back base64-encoded raw Int16 PCM for TD and BD tracks
5. Decodes the base64 to `Float32Array` (divides by 32768 to normalise)
6. Assembles a 4-channel WAV: `[MusicL, MusicR, TD, BD]` using `encodeMultiChWAV()`
7. Triggers a browser download of the resulting `.wav` file

### `encodeMultiChWAV(channels, sampleRate)`

A pure-JS WAV encoder. Takes an array of `Float32Array`s (one per channel) and produces a standard RIFF/WAVE binary `ArrayBuffer` with a 44-byte header. Always writes 16-bit PCM, little-endian.

### `stDirectDecode(channelFloat32, sampleRate)`

A minimal JavaScript BMC decoder used as a quick sanity-check after export. It detects zero-crossings in the signal and classifies each run as a half-bit or full-bit. Returns a `Uint8Array` of decoded `0`/`1` bits. This is also used by `cso-exporter.js`.

### `.rshw` Export

Handled by `SCME/SGM/rshw_builder.py` (called from Python side). Encodes the show as a .NET Binary Formatter (NRBF) stream. See [spte-integration/rshw-format.md](../spte-integration/rshw-format.md) for the full spec.

---

## Custom Shows (localStorage)

User-built shows are saved to `localStorage` under the key `"cyberstar_custom_shows"`. The format is an array of serialised `.cybershow.json` objects. The sidebar "My Shows" list reads from this on every page load.

---

## BMC Decoder (JavaScript side)

`stDirectDecode()` is a lightweight JS-only BMC decoder that exists for two purposes:

1. Spot-checking exported WAV channels immediately after generation
2. Providing decoded bits to `cso-exporter.js` for frame segmentation

It is **not** intended to replace the Python `SViz/visualizer_bridge.py` decoder — that version is more accurate, models hardware PLL tolerance, and produces the full annotated frame report.
