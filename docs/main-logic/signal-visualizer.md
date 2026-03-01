# signal-visualizer.js — SViz Front-End Bridge

`signal-visualizer.js` connects the browser UI to the **Signal Visualization module (SViz)**, which lives in Python at `SCME/SViz/visualizer_bridge.py`. It is the diagnostic tool of the project — it lets you inspect a 4-channel WAV and see exactly what the hardware will interpret.

---

## What It Does

When the user drops a 4-channel WAV onto the visualizer panel:

1. The WAV is decoded by the Web Audio API into `AudioBuffer`
2. Channels 2 and 3 (TD and BD control tracks) are extracted as `Int16Array`
3. The arrays are passed to Pyodide, which runs `verify_and_decode()` in Python
4. The Python code decodes the BMC stream frame by frame and builds a report
5. The JavaScript side renders the decoded data as:
   - A frame-level signal chart (on/off state of every channel over time)
   - A per-frame hex dump (optional verbose mode)
   - A validation summary (sync lock, blank-bit integrity, error rate)

---

## Pyodide Sharing

Like `show-builder.js`, this module uses the shared Pyodide singleton. It stores its instance as `window._svizPyodide` so `show-builder.js` can reuse it:

```js
window._svizPyodide = py;
window._svizPyodidePromise = loadingPromise;
```

If `show-builder.js` loads first, SViz will reuse that instance instead. Either way, only one Pyodide instance exists per page session.

---

## Python Function Called

```python
result = verify_and_decode(
    td_samples,     # list[int]  — Int16 PCM, TD channel
    bd_samples,     # list[int]  — Int16 PCM, BD channel
    sample_rate,    # int        — e.g. 44100
)
# Returns a dict (Python) → Pyodide converts to JS object
```

### Return Object

```js
{
  ok: true | false,
  td: {
    locked: true,
    frames: [...],           // decoded frame data
    error_rate: 0.001,
    blank_integrity: 0.998,
  },
  bd: {
    locked: true,
    frames: [...],
    error_rate: 0.000,
    blank_integrity: 1.000,
  },
  summary: "TD: PASS  BD: PASS  — 2847 frames decoded"
}
```

---

## Validation Thresholds

The Python SViz code applies the same thresholds the real hardware uses:

| Metric              | Required | Meaning                                                     |
| ------------------- | -------- | ----------------------------------------------------------- |
| Sync lock           | Yes      | Decoder must establish frame lock within first 3 sync bytes |
| Blank-bit integrity | ≥ 98%    | Hardware-reserved bits must be `0` in 98%+ of frames        |
| Bit error rate      | ≤ 2%     | Max allowed fraction of bits outside PLL tolerance window   |

A WAV that fails these checks **will be rejected by physical Cyberstar hardware**. The old Web Audio API export pipeline failed these tests (see [research/sgm-validation-history.md](../research/sgm-validation-history.md)).

---

## Chart Rendering

The browser-side chart uses the HTML5 Canvas API. Each column of pixels is one frame; each row is one channel. A lit pixel means the actuator was on in that frame. This gives an instant visual impression of show density and pattern.

The chart is scrollable horizontally and zoomable. Hovering a pixel shows the character name, movement name, and frame number in a tooltip.
