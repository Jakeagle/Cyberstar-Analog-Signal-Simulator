// =============================================================================
// signal-visualizer.js — CSO File Previewer (SViz)
// =============================================================================
//
// Loads a 4-channel Cyberstar Online WAV, runs it through the Python
// hardware emulator (SCME.SViz.visualizer_bridge via Pyodide), and if the
// file passes verification, visualises the control tracks and plays the
// music channels.
//
// IMPORTANT: Visualisation and audio playback are representations only.
// The browser resamples audio to its hardware rate (usually 48 kHz).
// Channel activity derived from Python BMC decode is accurate; audio
// fidelity to the original tape is not guaranteed.
//
// =============================================================================

(function () {
  "use strict";

  // ── DOM refs ────────────────────────────────────────────────────────────
  const uploadBtn = document.getElementById("sviz-upload-btn");
  const fileInput = document.getElementById("sviz-file-input");
  const fileNameEl = document.getElementById("sviz-file-name");
  const statusEl = document.getElementById("sviz-status");
  const verifyPanel = document.getElementById("sviz-verify-panel");
  const verdictEl = document.getElementById("sviz-verdict");
  const reasonsEl = document.getElementById("sviz-reasons");
  const disclaimerEl = document.getElementById("sviz-disclaimer");
  const playerPanel = document.getElementById("sviz-player-panel");
  const playBtn = document.getElementById("sviz-play-btn");
  const pauseBtn = document.getElementById("sviz-pause-btn");
  const stopBtn = document.getElementById("sviz-stop-btn");
  const progressBar = document.getElementById("sviz-progress");
  const timeDisplay = document.getElementById("sviz-time");
  const waveCanvas = document.getElementById("sviz-waveform");
  const stageBtn = document.getElementById("sviz-stage-btn");
  const statsEl = document.getElementById("sviz-stats");
  const exportWavBtn = document.getElementById("sviz-export-wav-btn");
  const exportCsoBtn = document.getElementById("sviz-export-cso-btn");

  // ── State ────────────────────────────────────────────────────────────────
  let audioCtx = null;
  let audioBuffer = null; // full decoded AudioBuffer
  let sourceNode = null;
  let startTime = 0;
  let pauseOffset = 0;
  let isPlaying = false;
  let animFrame = null;
  let channelTimeline = []; // [{channel, t_on, t_off, track}]
  let stageMap = null; // Map<channelName → {charName, moveKey}> — built once
  let waveformImageData = null; // cached static waveform
  let pyodideReady = false;
  let pyodideLoading = false;

  // ── Utility ──────────────────────────────────────────────────────────────
  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function setStatus(msg, type = "info") {
    statusEl.textContent = msg;
    statusEl.className = "sviz-status sviz-status-" + type;
  }

  function showPanel(el) {
    el.style.display = "block";
  }
  function hidePanel(el) {
    el.style.display = "none";
  }

  // ── Stage map: channelName → {charName, moveKey} ─────────────────────────
  // Built lazily once Pyodide + visualizer_bridge.py are loaded.
  // Uses get_channel_maps_json() (Python) + CHARACTER_MOVEMENTS (app.js global)
  // to produce the reverse lookup so updatePlayhead() can feed the stage view.
  // RAE characters only — prevents MMBB/CEC stub entries from overwriting
  // the same bit positions in bitToStage.
  const _RAE_CHARS = new Set([
    "Rolfe",
    "Earl",
    "Dook LaRue",
    "Fatz",
    "Beach Bear",
    "Looney Bird",
    "Mitzi",
    "Billy Bob",
    "Lights",
  ]);

  function buildStageMap(py) {
    if (stageMap && stageMap.size > 0) return; // retry if previously built empty
    try {
      const rawJson = py.runPython("get_channel_maps_json()");
      console.log("[SViz] get_channel_maps_json raw:", rawJson);
      const { td: tdBit1, bd: bdBit1 } = JSON.parse(rawJson);
      // channelName → {track, bit0}
      const chanToBit = {};
      Object.entries(tdBit1).forEach(
        ([b, n]) => (chanToBit[n] = { track: "TD", bit: parseInt(b) - 1 }),
      );
      Object.entries(bdBit1).forEach(
        ([b, n]) => (chanToBit[n] = { track: "BD", bit: parseInt(b) - 1 }),
      );
      console.log(
        "[SViz] chanToBit entries:",
        Object.keys(chanToBit).length,
        "CHARACTER_MOVEMENTS keys:",
        Object.keys(CHARACTER_MOVEMENTS || {}).length,
      );
      // CHARACTER_MOVEMENTS reverse: "TD-0" → {charName, moveKey}
      // Restricted to RAE characters so MMBB/CEC stubs don’t overwrite same bits.
      const bitToStage = new Map();
      for (const [charName, data] of Object.entries(
        CHARACTER_MOVEMENTS || {},
      )) {
        if (!_RAE_CHARS.has(charName)) continue;
        for (const [moveKey, cfg] of Object.entries(data.movements || {})) {
          bitToStage.set(`${cfg.track}-${cfg.bit}`, { charName, moveKey });
        }
      }
      stageMap = new Map();
      for (const [chanName, { track, bit }] of Object.entries(chanToBit)) {
        const entry = bitToStage.get(`${track}-${bit}`);
        if (entry) stageMap.set(chanName, entry);
      }
      console.log("[SViz] stageMap built:", stageMap.size, "entries");
      if (stageMap.size > 0) {
        const [firstKey, firstVal] = stageMap.entries().next().value;
        console.log("[SViz] stageMap sample:", firstKey, "→", firstVal);
      }
    } catch (e) {
      console.warn("[SViz] Could not build stage map:", e);
      stageMap = new Map(); // empty sentinel — prevents retry
    }
  }

  // ── Pyodide bootstrap ────────────────────────────────────────────────────
  async function ensurePyodide() {
    if (pyodideReady) return window._svizPyodide;
    if (pyodideLoading) {
      // Wait for existing load
      while (!pyodideReady) await new Promise((r) => setTimeout(r, 100));
      return window._svizPyodide;
    }
    pyodideLoading = true;
    setStatus("Loading Python runtime...", "info");

    if (!window._svizPyodide) {
      // Load Pyodide if not already loaded by another module
      if (typeof loadPyodide === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      window._svizPyodide = await loadPyodide();
    }

    // Load the bridge source
    const res = await fetch("SCME/SViz/visualizer_bridge.py");
    const src = await res.text();
    await window._svizPyodide.runPythonAsync(src);

    pyodideReady = true;
    pyodideLoading = false;
    return window._svizPyodide;
  }

  // ── Float32 → Int16 conversion ───────────────────────────────────────────
  function float32ToInt16Array(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = Math.max(-1, Math.min(1, f32[i]));
      out[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return out;
  }

  // ── File upload ──────────────────────────────────────────────────────────
  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    hidePanel(verifyPanel);
    hidePanel(playerPanel);
    hidePanel(disclaimerEl);
    statsEl.textContent = "";
    stopPlayback();
    waveformImageData = null;

    setStatus("Reading file...", "info");

    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (err) {
      setStatus("Failed to read file: " + err.message, "error");
      return;
    }

    // Decode via Web Audio API — handles all WAV formats including 4-ch
    // AudioContext is created on play (user gesture) to avoid auto-suspend;
    // here we just need a temporary one for decodeAudioData.
    const _decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    setStatus("Decoding audio...", "info");
    try {
      audioBuffer = await _decodeCtx.decodeAudioData(arrayBuffer.slice(0));
      await _decodeCtx.close();
    } catch (err) {
      setStatus(
        "Could not decode WAV: " +
          err.message +
          " — ensure it is a valid WAV file.",
        "error",
      );
      return;
    }

    const nCh = audioBuffer.numberOfChannels;
    if (nCh !== 4 && nCh !== 2) {
      setStatus(`Expected 4-channel CSO WAV, got ${nCh} channels.`, "error");
      return;
    }

    // Select TD and BD channel indices
    const tdIdx = nCh === 4 ? 2 : 0;
    const bdIdx = nCh === 4 ? 3 : 1;

    setStatus("Running hardware verification...", "info");
    drawWaveform(audioBuffer, tdIdx, bdIdx);

    // Pull Int16 samples for the control tracks
    const tdInt16 = float32ToInt16Array(audioBuffer.getChannelData(tdIdx));
    const bdInt16 = float32ToInt16Array(audioBuffer.getChannelData(bdIdx));
    const sr = audioBuffer.sampleRate;

    // Run Python verification
    let result;
    try {
      const py = await ensurePyodide();
      buildStageMap(py); // idempotent — no-op on second call
      // Transfer typed arrays to Python
      py.globals.set(
        "_td",
        tdInt16.tolist ? tdInt16.tolist() : Array.from(tdInt16),
      );
      py.globals.set(
        "_bd",
        bdInt16.tolist ? bdInt16.tolist() : Array.from(bdInt16),
      );
      py.globals.set("_sr", sr);
      const jsonStr = py.runPython(
        "verify_and_decode_json(list(_td), list(_bd), int(_sr))",
      );
      result = JSON.parse(jsonStr);
    } catch (err) {
      setStatus("Python verification failed: " + err.message, "error");
      return;
    }

    displayResult(result, file.name, nCh);
  });

  // ── Result display ───────────────────────────────────────────────────────
  function displayResult(result, fileName, nCh) {
    showPanel(verifyPanel);
    channelTimeline = result.channel_timeline || [];

    const dur = result.duration_seconds;
    const tdR = result.td;
    const bdR = result.bd;

    statsEl.innerHTML =
      `<span>Duration: <b>${fmt(dur)}</b></span> &nbsp;|&nbsp; ` +
      `<span>SR: <b>${result.sample_rate} Hz</b></span> &nbsp;|&nbsp; ` +
      `<span>TD frames: <b>${tdR.frame_count.toLocaleString()}</b></span> &nbsp;|&nbsp; ` +
      `<span>BD frames: <b>${bdR.frame_count.toLocaleString()}</b></span> &nbsp;|&nbsp; ` +
      `<span>Events decoded: <b>${channelTimeline.length.toLocaleString()}</b></span>`;

    if (result.verdict === "PASS") {
      verdictEl.textContent =
        "✅ HARDWARE VERIFIED — Signal will play on Cyberstar";
      verdictEl.className = "sviz-verdict sviz-verdict-pass";
      reasonsEl.innerHTML = "";

      console.log("[SViz] channelTimeline length:", channelTimeline.length);
      console.log("[SViz] stageMap size:", stageMap ? stageMap.size : "null");
      if (channelTimeline.length > 0) {
        console.log("[SViz] first timeline event:", channelTimeline[0]);
        console.log(
          "[SViz] stageMap.get(first channel):",
          stageMap?.get(channelTimeline[0].channel),
        );
      }

      // Show disclaimer
      showPanel(disclaimerEl);

      // Show player
      showPanel(playerPanel);
      progressBar.max = dur;
      progressBar.value = 0;
      timeDisplay.textContent = `00:00 / ${fmt(dur)}`;

      setStatus("Verified. Ready to play.", "success");
    } else {
      verdictEl.textContent =
        "❌ VERIFICATION FAILED — This file would be rejected by Cyberstar hardware";
      verdictEl.className = "sviz-verdict sviz-verdict-fail";
      reasonsEl.innerHTML = result.reasons.map((r) => `<li>${r}</li>`).join("");
      setStatus(
        "File failed hardware verification. See reasons above.",
        "error",
      );
    }
  }

  // ── Stage View button
  if (stageBtn) {
    stageBtn.addEventListener("click", () => {
      if (typeof openStageView === "function") openStageView();
    });
  }

  // ── WAV encoder ─────────────────────────────────────────────────────
  // Encodes an AudioBuffer (subset of channels) to 16-bit PCM WAV and
  // triggers a browser download with the given filename.
  function exportAudioBuffer(buf, channelIndices, filename) {
    const numCh = channelIndices.length;
    const sr = buf.sampleRate;
    const numSamps = buf.length; // samples per channel
    const bitsPerSample = 16;
    const byteRate = sr * numCh * (bitsPerSample / 8);
    const blockAlign = numCh * (bitsPerSample / 8);
    const dataBytes = numSamps * numCh * (bitsPerSample / 8);
    const totalBytes = 44 + dataBytes; // RIFF header (44) + PCM data

    const ab = new ArrayBuffer(totalBytes);
    const dv = new DataView(ab);
    let offset = 0;

    // Helper writers
    const w8 = (v) => {
      dv.setUint8(offset++, v);
    };
    const w16 = (v) => {
      dv.setUint16(offset, v, true);
      offset += 2;
    };
    const w32 = (v) => {
      dv.setUint32(offset, v, true);
      offset += 4;
    };
    const wStr = (s) => {
      for (let i = 0; i < s.length; i++) w8(s.charCodeAt(i));
    };

    // RIFF chunk
    wStr("RIFF");
    w32(totalBytes - 8); // file size minus first 8 bytes
    wStr("WAVE");

    // fmt sub-chunk
    wStr("fmt ");
    w32(16); // sub-chunk size (PCM)
    w16(1); // audio format: PCM
    w16(numCh);
    w32(sr);
    w32(byteRate);
    w16(blockAlign);
    w16(bitsPerSample);

    // data sub-chunk header
    wStr("data");
    w32(dataBytes);

    // Interleaved 16-bit samples
    // AudioBuffer stores planar Float32; we interleave and convert here.
    const channels = channelIndices.map((i) => buf.getChannelData(i));
    for (let s = 0; s < numSamps; s++) {
      for (let c = 0; c < numCh; c++) {
        const f = Math.max(-1, Math.min(1, channels[c][s]));
        const i16 = f < 0 ? f * 32768 : f * 32767;
        dv.setInt16(offset, Math.round(i16), true);
        offset += 2;
      }
    }

    // Trigger download
    const blob = new Blob([ab], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // ── Export buttons
  exportWavBtn.addEventListener("click", () => {
    if (!audioBuffer) return;
    // 4-channel WAV: music L, music R, TD BMC, BD BMC
    const baseName = (fileNameEl.textContent || "export").replace(
      /\.[^.]+$/,
      "",
    );
    const chIndices = audioBuffer.numberOfChannels >= 4 ? [0, 1, 2, 3] : [0, 1];
    exportAudioBuffer(audioBuffer, chIndices, `${baseName}.wav`);
  });

  exportCsoBtn.addEventListener("click", () => {
    if (!audioBuffer) return;
    // Full 4-channel CSO: music L, music R, TD BMC, BD BMC
    const baseName = (fileNameEl.textContent || "export").replace(
      /\.[^.]+$/,
      "",
    );
    const chIndices = audioBuffer.numberOfChannels >= 4 ? [0, 1, 2, 3] : [0, 1]; // graceful fallback for 2-ch files
    exportAudioBuffer(audioBuffer, chIndices, `${baseName}.cso`);
  });

  // ── Waveform canvas ──────────────────────────────────────────────────────
  function drawWaveform(buf, tdIdx, bdIdx) {
    const ctx = waveCanvas.getContext("2d");
    const W = waveCanvas.width;
    const H = waveCanvas.height;
    const half = H / 2;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    function drawTrack(chIdx, color, yOff, hRange) {
      const data = buf.getChannelData(chIdx);
      const step = Math.ceil(data.length / W);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        let min = 1,
          max = -1;
        for (let j = x * step; j < (x + 1) * step && j < data.length; j++) {
          if (data[j] < min) min = data[j];
          if (data[j] > max) max = data[j];
        }
        const yMin = yOff + (1 - max) * hRange * 0.5;
        const yMax = yOff + (1 - min) * hRange * 0.5;
        if (x === 0) ctx.moveTo(x, (yMin + yMax) / 2);
        else {
          ctx.moveTo(x, yMin);
          ctx.lineTo(x, yMax);
        }
      }
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = "rgba(0,200,255,0.6)";
    ctx.font = "11px monospace";
    ctx.fillText("TD (Ch3)", 6, 14);
    ctx.fillStyle = "rgba(255,180,0,0.6)";
    ctx.fillText("BD (Ch4)", 6, H / 2 + 14);

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    drawTrack(tdIdx, "rgba(0,220,255,0.85)", 0, H / 2);
    drawTrack(bdIdx, "rgba(255,180,0,0.85)", H / 2, H / 2);

    // Cache the static waveform so updatePlayhead can blit it cheaply
    waveformImageData = ctx.getImageData(0, 0, W, H);
  }

  // ── Playhead & channel update ────────────────────────────────────────────
  function currentPlaybackTime() {
    if (!isPlaying) return pauseOffset;
    return audioCtx.currentTime - startTime + pauseOffset;
  }

  function updatePlayhead() {
    if (!audioBuffer) return;
    const t = currentPlaybackTime();
    const dur = audioBuffer.duration;
    progressBar.value = Math.min(t, dur);
    timeDisplay.textContent = `${fmt(t)} / ${fmt(dur)}`;

    // Blit cached waveform, then draw playhead — never re-decode the whole buffer
    const ctx = waveCanvas.getContext("2d");
    const W = waveCanvas.width;
    const H = waveCanvas.height;
    if (waveformImageData) {
      ctx.putImageData(waveformImageData, 0, 0);
    } else {
      const tdIdx = audioBuffer.numberOfChannels === 4 ? 2 : 0;
      const bdIdx = audioBuffer.numberOfChannels === 4 ? 3 : 1;
      drawWaveform(audioBuffer, tdIdx, bdIdx);
    }

    const x = (t / dur) * W;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Publish active-channel state → stage view
    if (stageMap) {
      const activeByChar = new Map();
      channelTimeline.forEach((ev) => {
        if (t < ev.t_on || t >= ev.t_off) return;
        const entry = stageMap.get(ev.channel);
        if (!entry) return;
        let charSet = activeByChar.get(entry.charName);
        if (!charSet) {
          charSet = new Set();
          activeByChar.set(entry.charName, charSet);
        }
        charSet.add(entry.moveKey);
      });
      window._svizActiveState = { active: activeByChar, isPlaying };
      // Debug: log once per second
      if (Math.floor(t) !== Math.floor(t - 0.016)) {
        console.log(
          `[SViz] t=${t.toFixed(2)}s activeByChar size: ${activeByChar.size}`,
          activeByChar.size > 0
            ? [...activeByChar.entries()]
                .map(([k, v]) => `${k}:[${[...v].join(",")}]`)
                .join(" ")
            : "(none)",
        );
      }
    }

    if (t >= dur) {
      stopPlayback();
      return;
    }

    if (isPlaying) animFrame = requestAnimationFrame(updatePlayhead);
  }

  // ── Player controls ──────────────────────────────────────────────────────
  playBtn.addEventListener("click", async () => {
    if (!audioBuffer || isPlaying) return;
    // Create (or recreate) AudioContext on play — this IS a user gesture,
    // so the browser will never auto-suspend it.
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") await audioCtx.resume();

    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Only route music channels (Ch1+Ch2) to speakers via splitter/merger
    const splitter = audioCtx.createChannelSplitter(
      audioBuffer.numberOfChannels,
    );
    const merger = audioCtx.createChannelMerger(2);
    sourceNode.connect(splitter);

    if (audioBuffer.numberOfChannels >= 2) {
      // Music L → merger 0, Music R → merger 1
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);
    } else {
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
    }
    merger.connect(audioCtx.destination);

    sourceNode.start(0, pauseOffset);
    startTime = audioCtx.currentTime;
    isPlaying = true;

    playBtn.disabled = true;
    pauseBtn.disabled = false;

    animFrame = requestAnimationFrame(updatePlayhead);
  });

  pauseBtn.addEventListener("click", () => {
    if (!isPlaying) return;
    pauseOffset = currentPlaybackTime();
    sourceNode.stop();
    sourceNode = null;
    isPlaying = false;
    cancelAnimationFrame(animFrame);
    playBtn.disabled = false;
    pauseBtn.disabled = true;
  });

  stopBtn.addEventListener("click", () => stopPlayback());

  progressBar.addEventListener("input", () => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      sourceNode.stop();
      sourceNode = null;
      isPlaying = false;
      cancelAnimationFrame(animFrame);
    }
    pauseOffset = parseFloat(progressBar.value);
    updatePlayhead();
    if (wasPlaying) playBtn.click();
  });

  function stopPlayback() {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (_) {}
      sourceNode = null;
    }
    isPlaying = false;
    pauseOffset = 0;
    cancelAnimationFrame(animFrame);
    playBtn.disabled = false;
    pauseBtn.disabled = true;

    if (progressBar) progressBar.value = 0;
    if (audioBuffer && timeDisplay)
      timeDisplay.textContent = `00:00 / ${fmt(audioBuffer.duration)}`;

    // Clear stage state
    window._svizActiveState = null;
  }
})();
