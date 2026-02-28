/**
 * show-builder.js — Python-backed Audio Analysis + Show Generation
 * ================================================================
 * Exposes window.buildShowWithPython() which:
 *   1. Mixes the decoded AudioBuffer to mono and decimates to 11 025 Hz
 *      (4× cheaper than 44 100 Hz for the Python analysis loop).
 *   2. Loads Pyodide (reusing the SViz instance when available so the WASM
 *      runtime is only fetched once per page session).
 *   3. Runs SCME/SAM/show_bridge.py inside Pyodide.
 *   4. Calls analyze_and_choreograph_json() and returns the parsed JSON object.
 *
 * The Web Audio API is used ONLY for audio decoding and resampling.
 * All signal analysis and choreography generation happens in Python.
 */

(function () {
  "use strict";

  const PYODIDE_VERSION = "0.27.0";
  const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const BRIDGE_PATH = "SCME/SAM/show_bridge.py";

  /** Singleton promise that resolves to a ready Pyodide instance. */
  let _pyodideReady = null;

  /**
   * Load (or reuse) a Pyodide instance with the SAM bridge pre-loaded.
   * Strategy:
   *   • If the SViz module already loaded Pyodide (window._svizPyodide),
   *     attach the SAM bridge to that same instance — avoids a second WASM download.
   *   • Otherwise spin up a fresh Pyodide.
   * @returns {Promise<PyodideInterface>}
   */
  async function _ensureSAMPyodide() {
    if (_pyodideReady) return _pyodideReady;

    _pyodideReady = (async () => {
      let py;

      // --- Reuse SViz Pyodide if it already exists ----------------------
      if (window._svizPyodide) {
        py = window._svizPyodide;
      } else if (window._svizPyodidePromise) {
        // SViz is currently loading — wait for it
        py = await window._svizPyodidePromise;
      } else {
        // No SViz — load Pyodide ourselves
        if (!window.loadPyodide) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `${PYODIDE_CDN}pyodide.js`;
            s.crossOrigin = "anonymous";
            s.onload = resolve;
            s.onerror = () =>
              reject(new Error("Failed to load Pyodide script"));
            document.head.appendChild(s);
          });
        }
        py = await loadPyodide({ indexURL: PYODIDE_CDN });
      }

      // --- Inject the SAM bridge source --------------------------------
      if (!py._samBridgeLoaded) {
        const resp = await fetch(BRIDGE_PATH);
        if (!resp.ok)
          throw new Error(`Cannot fetch ${BRIDGE_PATH}: ${resp.status}`);
        const src = await resp.text();
        py.runPython(src);
        py._samBridgeLoaded = true;
      }

      return py;
    })();

    return _pyodideReady;
  }

  /**
   * Mix an AudioBuffer to mono and decimate to targetSr using a box-filter
   * averager (avoids aliasing better than simple skip-sampling).
   *
   * @param {AudioBuffer} audioBuffer  Decoded audio from Web Audio API
   * @param {number}      targetSr     Target sample rate in Hz (default 11025)
   * @returns {Int16Array}             Mono, downsampled, Int16 samples
   */
  function _mixAndDecimate(audioBuffer, targetSr) {
    const srcSr = audioBuffer.sampleRate;
    const srcLen = audioBuffer.length;
    const nCh = audioBuffer.numberOfChannels;

    // --- Mix all channels to mono Float32 ---
    const mono = new Float32Array(srcLen);
    for (let ch = 0; ch < nCh; ch++) {
      const d = audioBuffer.getChannelData(ch);
      for (let i = 0; i < srcLen; i++) mono[i] += d[i] / nCh;
    }

    // --- Box-filter downsample to targetSr ---
    // step  = number of source samples averaged into each output sample
    const step = Math.round(srcSr / targetSr);
    const outLen = Math.floor(srcLen / step);
    const out = new Int16Array(outLen);

    for (let i = 0; i < outLen; i++) {
      let sum = 0;
      const base = i * step;
      for (let j = 0; j < step; j++) sum += mono[base + j];
      const v = sum / step;
      out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    return out;
  }

  /**
   * Analyse audio and produce a choreographed .cybershow.json v3.0 object
   * using the Python SAM bridge.
   *
   * @param {AudioBuffer} audioBuffer  Decoded audio (any sample rate / channels)
   * @param {string}      band         "rock" | "munch"
   * @param {string}      title        Show title
   * @param {number}      durationMs   Duration in ms (from audioBuffer.duration)
   * @param {function}    [onProgress] Optional callback(message:string)
   * @returns {Promise<object>}        Parsed .cybershow.json object
   */
  async function buildShowWithPython(
    audioBuffer,
    band,
    title,
    durationMs,
    onProgress,
  ) {
    const report = typeof onProgress === "function" ? onProgress : () => {};

    // 1. Prepare audio -------------------------------------------------------
    report("Preparing audio for Python analysis…");
    const TARGET_SR = 11025;
    const int16 = _mixAndDecimate(audioBuffer, TARGET_SR);
    const sampleCount = int16.length;
    const durationSec = Math.round(durationMs / 1000);
    report(
      `Downsampled to ${TARGET_SR} Hz — ${sampleCount.toLocaleString()} samples` +
        ` (${durationSec}s). Loading Python…`,
    );

    // 2. Load Pyodide + SAM bridge ------------------------------------------
    const pyodide = await _ensureSAMPyodide();

    // 3. Convert to Python-compatible list -----------------------------------
    // Pyodide can accept typed arrays directly, but converting to a plain JS
    // array is the most reliable way across Pyodide versions.
    report(`Running Python analysis on ${durationSec}s of audio…`);
    const samplesArray = Array.from(int16);

    // 4. Call the Python bridge ----------------------------------------------
    const fn = pyodide.globals.get("analyze_and_choreograph_json");
    const jsonStr = fn(samplesArray, TARGET_SR, band, title, durationMs);

    // 5. Parse and validate --------------------------------------------------
    const result = JSON.parse(jsonStr);
    if (result.error) {
      console.error("[SAM] Python traceback:\n", result.traceback || "(none)");
      throw new Error(`Python analysis failed: ${result.error}`);
    }

    const beatCount = result.bpm ? `~${result.bpm} BPM` : "BPM unknown";
    const charCount = Object.keys(result.characters || {}).length;
    report(
      `Analysis complete — ${beatCount}, ${charCount} characters choreographed.`,
    );

    return result;
  }

  // ── Export bridge (SGM) ────────────────────────────────────────────────────

  const EXPORT_BRIDGE_PATH = "SCME/SGM/export_bridge.py";

  /**
   * Load (or reuse) the SGM export bridge into the shared Pyodide instance.
   * Reuses the exact same Pyodide runtime as the SAM bridge — WASM is only
   * ever downloaded once per page session.
   * @returns {Promise<PyodideInterface>}
   */
  async function _ensureExportBridge() {
    const py = await _ensureSAMPyodide(); // shares the SAM Pyodide instance
    if (!py._exportBridgeLoaded) {
      const resp = await fetch(EXPORT_BRIDGE_PATH);
      if (!resp.ok)
        throw new Error(`Cannot fetch ${EXPORT_BRIDGE_PATH}: ${resp.status}`);
      py.runPython(await resp.text());
      py._exportBridgeLoaded = true;
    }
    return py;
  }

  /**
   * Decode a base64-encoded little-endian Int16 PCM blob into a Float32Array.
   * @param {string} b64  Base64 string from export_bridge render_4ch_pcm_json
   * @returns {Float32Array}
   */
  function _b64ToFloat32(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const i16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
    return f32;
  }

  /**
   * Generate a 4-channel WAV using the Python SGM pipeline.
   *   Ch0 = Music L  (from window.songBuffer, resampled to 44100 Hz)
   *   Ch1 = Music R
   *   Ch2 = TD BMC signal  (hardware-correct, generated in Python)
   *   Ch3 = BD BMC signal
   *
   * @param {Array<{time_ms:number, character:string, movement:string, state:number}>} sequences
   * @param {number}   durationMs  Total show duration in ms
   * @param {string}   title       Show title (used for filename)
   * @param {Function} [onProgress] Optional progress callback(message:string)
   * @returns {Promise<Blob>}  WAV file blob ready for URL.createObjectURL()
   */
  async function export4chWAVWithPython(
    sequences,
    durationMs,
    title,
    onProgress,
  ) {
    const report = typeof onProgress === "function" ? onProgress : () => {};

    // 1. Load Python export engine ------------------------------------------
    report("Loading Python export engine…");
    const pyodide = await _ensureExportBridge();

    // 2. Normalise sequence field names (time → time_ms) --------------------
    const normSeqs = sequences.map((s) => ({
      time_ms: s.time_ms !== undefined ? s.time_ms : s.time,
      character: s.character,
      movement: s.movement,
      state: s.state,
    }));

    // 3. Call Python render --------------------------------------------------
    report("Generating BMC frames in Python…");
    const seqsJson = JSON.stringify(normSeqs);
    const fn = pyodide.globals.get("render_4ch_pcm_json");
    let result;
    try {
      result = JSON.parse(fn(seqsJson, durationMs));
    } catch (err) {
      throw new Error(`Python render_4ch_pcm_json threw: ${err.message}`);
    }
    if (result.error) {
      console.error("[SGM] Python traceback:\n", result.traceback || "(none)");
      throw new Error(`Python render failed: ${result.error}`);
    }

    // 4. Decode base64 PCM → Float32 ----------------------------------------
    const tdF32 = _b64ToFloat32(result.td_b64);
    const bdF32 = _b64ToFloat32(result.bd_b64);
    const nSamples = Math.max(result.n_samples_td, result.n_samples_bd);

    // Pad shorter track to common length
    const tdPad = new Float32Array(nSamples);
    tdPad.set(tdF32);
    const bdPad = new Float32Array(nSamples);
    bdPad.set(bdF32);

    // 5. Extract music channels from songBuffer (app.js global) -------------
    report("Mixing music channels…");
    // _extractMusicChannels and encodeMultiChWAV are top-level functions in
    // app.js; they are accessible as window globals by the time this async
    // function is invoked.
    const { musicL, musicR } = window._extractMusicChannels(
      nSamples,
      0,
      result.sample_rate,
    );

    // 6. Encode 4-ch WAV ----------------------------------------------------
    report("Encoding 4-channel WAV…");
    const blob = window.encodeMultiChWAV(
      [musicL, musicR, tdPad, bdPad],
      result.sample_rate,
    );
    if (!(blob instanceof Blob))
      throw new Error("encodeMultiChWAV did not return a Blob");

    const skipped = result.skipped || 0;
    report(
      `Done — ${tdF32.length.toLocaleString()} TD samples, ` +
        `${bdF32.length.toLocaleString()} BD samples` +
        (skipped ? `, ${skipped} cues skipped` : ""),
    );
    return blob;
  }

  // Expose on window so app.js can call it
  window.buildShowWithPython = buildShowWithPython;
  window.export4chWAVWithPython = export4chWAVWithPython;
})();
