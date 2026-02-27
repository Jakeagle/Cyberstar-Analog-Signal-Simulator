/**
 * Cyberstar Analog Signal Generator v2.0
 * Implements Biphase Mark Code (BMC) encoding for digital control signals
 *
 * Pianocorder / CEI Showtape Standard (STPE-compatible):
 * - Encoding: Biphase Mark Code (phase-based, self-clocking)
 * - Baud Rate: 4500 bps
 * - Frame Rate: ~35.15625 fps (4500 ÷ 128 bits)
 * - Track TD (Treble Data): WAV Channel 0
 * - Track BD (Bass Data): WAV Channel 1
 * - Music L/R: WAV Channels 2/3
 * - Frame Length: 16 Bytes (128 Bits) per track — Pianocorder standard
 * - Bit Order: MSB-first
 *
 * Every frame starts with 0xFF sync byte.
 * Logic '1' has an additional mid-bit transition.
 */

class CyberstarSignalGenerator {
  constructor(options = {}) {
    this.audioContext = null;

    // Pianocorder / RAE standard — 4500 bps, 16-byte (128-bit) frames, ~35fps
    this.bitrate = 4500;
    this.frameRate = 35.15625; // 4500 bps / 128 bits per frame
    this.amplitude = options.amplitude || 0.6;
    this.noiseLevel = options.noiseLevel || 0.015;
    this.lowpassCutoff = 8000; // preserving the "screech" high harmonics

    this.volume = options.volume || 0.7;
    this.FRAME_BYTES = 16;

    // Dual-track frame buffers (16 bytes — Pianocorder standard)
    this.trackTD = new Uint8Array(this.FRAME_BYTES);
    this.trackBD = new Uint8Array(this.FRAME_BYTES);

    // State Comparison Buffer
    this.trackTD_last = new Uint8Array(this.FRAME_BYTES);
    this.trackBD_last = new Uint8Array(this.FRAME_BYTES);

    // Stream scheduling state
    this.isStreaming = false;
    this.nextFrameTime = 0;
    this.lastSyncUIAt = 0; // throttle sync LED calls
    this.schedulerTimer = null;
    this.SCHEDULE_AHEAD = 0.08; // pre-queue 80ms

    // Callback for UI updates (e.g. Sync LED)
    this.onFrameSync = null;

    // Broadcast/export mode flag — when true, bypasses filter and noise
    // so digital decoders receive a clean square wave (§2 STPE Patch)
    this.isExporting = false;

    this.initAudioContext();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Audio context
  // ─────────────────────────────────────────────────────────────────────────

  initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )({
        sampleRate: 44100,
      });
    }
  }

  get sampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  resumeContext() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BMC encoding core
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert a Uint8Array into a BMC bit stream.
   * BMC rules:
   *   Bit 1 → transition at mid-bit AND at bit boundary
   *   Bit 0 → NO mid-bit transition, transition at bit boundary only
   */
  encodeBMC(dataBytes) {
    const bits = [];
    for (let i = 0; i < dataBytes.length; i++) {
      const byte = dataBytes[i];
      for (let b = 7; b >= 0; b--) {
        bits.push((byte >> b) & 1); // MSB-first — Pianocorder / RAE standard
      }
    }
    return bits;
  }

  /**
   * Render a BMC bit stream into a Float32Array waveform.
   * Produces a bipolar square wave (+1 / −1) with BMC phase transitions.
   *
   * Float-accumulator timing: at 44.1kHz / 4500bps = 9.8 samples per bit.
   * Floating-point samplePos accumulator eliminates rounding drift across frames.
   * When isExporting is true, noise is suppressed for clean digital decoder output.
   */
  generateBMCWaveform(bits) {
    const samplesPerBit = this.sampleRate / this.bitrate; // 9.8 at 44.1kHz/4500bps
    const totalSamples = Math.ceil(bits.length * samplesPerBit);
    const waveform = new Float32Array(totalSamples);
    let level = 1.0; // start at +1
    let samplePos = 0.0;

    for (let bi = 0; bi < bits.length; bi++) {
      const nextPos = samplePos + samplesPerBit;
      const midPos = samplePos + samplesPerBit / 2.0;
      const start = Math.floor(samplePos);
      const mid = Math.floor(midPos);
      const end = Math.floor(nextPos);

      if (bits[bi] === 1) {
        // First half at current level, then mid-bit transition
        for (let i = start; i < mid; i++) waveform[i] = level;
        level *= -1.0; // mid-bit transition
        for (let i = mid; i < end; i++) waveform[i] = level;
        level *= -1.0; // boundary transition
      } else {
        // Both halves at current level (no mid-bit transition)
        for (let i = start; i < end; i++) waveform[i] = level;
        level *= -1.0; // boundary transition only
      }
      samplePos = nextPos;
    }

    // Light noise for analog tape simulation — bypassed in broadcast/export mode
    if (this.noiseLevel > 0 && !this.isExporting) {
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] += (Math.random() - 0.5) * 2 * this.noiseLevel;
        waveform[i] = Math.max(-1, Math.min(1, waveform[i]));
      }
    }

    return waveform;
  }

  /**
   * One-pole IIR low-pass filter — softens transition edges for tape warmth.
   */
  applyLowpassFilter(waveform) {
    const rc = 1.0 / (2 * Math.PI * this.lowpassCutoff);
    const dt = 1.0 / this.sampleRate;
    const alpha = dt / (rc + dt);
    const filtered = new Float32Array(waveform.length);
    filtered[0] = waveform[0];
    for (let i = 1; i < waveform.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (waveform[i] - filtered[i - 1]);
    }
    return filtered;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TDM frame builder
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build one complete TDM serial frame from the current channel slot states.
   *
   *   Byte 0:   0xFF  — sync high
   *   Byte 1:   0x00  — sync low
   *   Bytes 2–9: slot0…slot7 — one control byte per character channel
   *   Byte 10:  0xAA  — end-of-frame marker
   *
   * = 11 bytes = 88 bits per frame.
   * At 2400 bps: 88 / 2400 = 36.7 ms — fits safely inside a 50 ms (20 fps) slot.
   * Every frame is the same size → perfectly uniform, rhythmic output.
   */
  buildTDMFrame() {
    const frame = new Uint8Array(11);
    frame[0] = 0xff; // sync high
    frame[1] = 0x00; // sync low
    for (let i = 0; i < this.NUM_SLOTS; i++) {
      frame[2 + i] = this.channelSlots[i];
    }
    frame[10] = 0xaa; // end-of-frame
    return frame;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Continuous TDM stream engine
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the continuous multiplexed BMC stream.
   *
   * Uses audioContext.currentTime for sample-accurate, gap-free scheduling.
   * The scheduler pre-queues SCHEDULE_AHEAD seconds of audio at a time,
   * re-checking every half-frame via setTimeout.
   * When character states change mid-stream, those values are picked up
   * naturally on the next scheduled frame — no restarts needed.
   */
  startStream() {
    if (this.isStreaming) return this.nextFrameTime; // already running — return current frame time
    this.resumeContext();
    this.isStreaming = true;
    this.nextFrameTime = this.audioContext.currentTime + 0.02; // small startup buffer
    this._pump();
    return this.nextFrameTime; // caller can start song AudioBuffer at this exact context time
  }

  /**
   * Stop the stream. In-flight audio drains naturally; new frames stop queuing.
   */
  stopStream() {
    this.isStreaming = false;
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Internal scheduler — keeps the audio queue full without blocking the UI thread.
   */
  _pump() {
    if (!this.isStreaming) return;

    const frameDurationSec = 1 / this.frameRate; // 0.05 s
    const scheduleUntil = this.audioContext.currentTime + this.SCHEDULE_AHEAD;

    while (this.nextFrameTime < scheduleUntil) {
      this._scheduleFrame(this.nextFrameTime);
      this.nextFrameTime += frameDurationSec;
    }

    // Re-run at ~half-frame interval to catch slot updates promptly
    this.schedulerTimer = setTimeout(
      () => this._pump(),
      (frameDurationSec * 500) | 0,
    );
  }

  /**
   * Encode both TD and BD tracks and schedule them as a stereo AudioBuffer.
   * TD = Left channel, BD = Right channel.
   */
  _scheduleFrame(atTime) {
    const samplesPerBit = this.sampleRate / this.bitrate;
    const bitsPerFrame = 16 * 8; // 128 bits — Pianocorder 16-byte frame
    const frameSamples = Math.ceil(bitsPerFrame * samplesPerBit);

    // Call sync hook for UI (Safe throttling to ~50Hz visual pulse)
    const now = performance.now();
    if (this.onFrameSync && now - this.lastSyncUIAt > 15) {
      this.onFrameSync();
      this.lastSyncUIAt = now;
    }

    // Left Channel (TD)
    const bitsTD = this.encodeBMC(this.trackTD);
    let waveL = this.generateBMCWaveform(bitsTD);
    if (!this.isExporting) waveL = this.applyLowpassFilter(waveL);

    // Right Channel (BD)
    const bitsBD = this.encodeBMC(this.trackBD);
    let waveR = this.generateBMCWaveform(bitsBD);
    if (!this.isExporting) waveR = this.applyLowpassFilter(waveR);

    const scale = this.amplitude * this.volume;

    const buffer = this.audioContext.createBuffer(
      2,
      frameSamples,
      this.sampleRate,
    );
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);

    for (let i = 0; i < frameSamples; i++) {
      leftData[i] = (waveL[i] || 0) * scale;
      rightData[i] = (waveR[i] || 0) * scale;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(atTime);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bitwise Character State API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set or clear a specific bit in the data tracks.
   */
  setBit(track, bitIndex, value) {
    const buffer = track === "TD" ? this.trackTD : this.trackBD;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPos = 7 - (bitIndex % 8); // MSB-first — Pianocorder standard

    if (value) {
      buffer[byteIndex] |= 1 << bitPos;
    } else {
      buffer[byteIndex] &= ~(1 << bitPos);
    }
  }

  /**
   * Toggles a bit state. Useful for legacy showtape logic where
   * a single command represents "Activate/Deactivate" in sequence.
   */
  toggleBit(track, bitIndex) {
    const buffer = track === "TD" ? this.trackTD : this.trackBD;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPos = 7 - (bitIndex % 8); // MSB-first
    const current = (buffer[byteIndex] >> bitPos) & 1;
    this.setBit(track, bitIndex, !current);
  }

  /**
   * Legacy method redirected to the bit-based system.
   */
  setCharacterState(characterName, dataBytes) {
    // Redirect logic to bitwise systems if we have a mapping
    // But better to use bitwise API directly now.
  }

  clearAllCharacterStates() {
    this.trackTD.fill(0x00);
    this.trackBD.fill(0x00);
  }

  // Legacy setup — no longer used in bit-direct RFE spec
  setupBandSlots() {
    this.clearAllCharacterStates();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manual / legacy one-shot API (used by the manual signal generator panel)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a one-shot BMC signal immediately, outside the TDM stream.
   * Used by the manual generator panel for testing individual signals.
   */
  playBMCSignal(dataBytes, volume = 0.7) {
    this.resumeContext();
    const bits = this.encodeBMC(dataBytes);
    let waveform = this.generateBMCWaveform(bits);
    if (!this.isExporting) waveform = this.applyLowpassFilter(waveform);

    const scale = this.amplitude * volume;
    for (let i = 0; i < waveform.length; i++) waveform[i] *= scale;

    const buffer = this.audioContext.createBuffer(
      1,
      waveform.length,
      this.sampleRate,
    );
    buffer.getChannelData(0).set(waveform);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);
  }

  /**
   * Generate movement-specific bytes and play as a one-shot signal.
   * Returns the encoded bytes for display purposes.
   */
  generateMovementSignal(characterName, movementKey, channel, duration = 500) {
    const hash = characterName.charCodeAt(0) + movementKey.charCodeAt(0);
    const basePattern = hash % 64;
    const movementByte = ((channel & 0x03) << 6) | (basePattern & 0x3f);

    let dataBytes;
    switch (movementKey.split("_")[0]) {
      case "mouth":
        dataBytes = new Uint8Array([0xaa, 0x55, movementByte]);
        break;
      case "blink":
        dataBytes = new Uint8Array([0x55, 0xaa, movementByte]);
        break;
      case "eye":
        dataBytes = new Uint8Array([0x33, 0xcc, movementByte]);
        break;
      case "head":
      case "neck":
        dataBytes = new Uint8Array([0x0f, 0xf0, movementByte]);
        break;
      case "arm":
      case "shoulder":
      case "hand":
      case "elbow":
        dataBytes = new Uint8Array([0xff, 0x00, movementByte]);
        break;
      case "torso":
      case "body":
      case "hip":
      case "waist":
        dataBytes = new Uint8Array([0xc3, 0x3c, movementByte]);
        break;
      case "foot":
      case "leg":
        dataBytes = new Uint8Array([0x5a, 0xa5, movementByte]);
        break;
      case "guitar":
      case "strum":
      case "keyboard":
        dataBytes = new Uint8Array([0x66, 0x99, movementByte]);
        break;
      default:
        dataBytes = new Uint8Array([0x00, movementByte]);
    }

    this.playBMCSignal(dataBytes, this.volume);
    return dataBytes;
  }

  generateMoveCommand(channel, speed = 128) {
    const commandByte = (channel << 6) | (speed & 0x3f);
    return new Uint8Array([0x00, commandByte]);
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
  }

  getAudioContextState() {
    return this.audioContext?.state || "not initialized";
  }

  /**
   * Helper to check if a specific bit is ON in the current TDM frame.
   * bitIndex: 0-95 (12-byte buffer)
   * track: "TD" (Treble/Left) or "BD" (Bass/Right)
   */
  getBit(track, bitIndex) {
    const buffer = track === "TD" ? this.trackTD : this.trackBD;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitInByte = 7 - (bitIndex % 8); // MSB-first — Pianocorder standard
    if (byteIndex < 0 || byteIndex >= this.FRAME_BYTES) return false;
    return (buffer[byteIndex] >> bitInByte) & 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Broadcast Export (Pro-Grade / STPE-Compatible)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Encode a 4-channel broadcast WAV ready for ProgramBlue / STPE import.
   *
   * Channel layout — RAE original 4-track tape order:
   *   Ch 0 — Track TD (Treble Data BMC signal) ← SPTE data decoder input
   *   Ch 1 — Track BD (Bass Data BMC signal)   ← SPTE data decoder input
   *   Ch 2 — Music Left                         ← SPTE audio output
   *   Ch 3 — Music Right                        ← SPTE audio output
   *
   * SPTE reads Ch0/Ch1 through its BMC decoder for animatronic control
   * and routes Ch2/Ch3 to the speaker output.
   *
   * @param {Float32Array} tdData   TD BMC signal (pilot + show frames)
   * @param {Float32Array} bdData   BD BMC signal (pilot + show frames)
   * @param {Float32Array} [musicL] Music left  (optional; silence if omitted)
   * @param {Float32Array} [musicR] Music right (optional; silence if omitted)
   * @returns {Blob} 4-channel 44.1kHz 16-bit PCM WAV Blob (Format 1 — STPE compatible)
   */
  exportBroadcastWav(tdData, bdData, musicL, musicR) {
    const SAMPLE_RATE = 44100; // STPE requires 44.1 kHz
    const NUM_CHANNELS = 4;
    const BITS = 16;
    // 0.75 keeps the BMC signal well within SPTE's detection range without
    // overdriving the decoder input — Pro-Grade spec targets ±0.8; 0.75 gives headroom.
    const SIGNAL_PEAK = 0.75;

    const len = tdData.length;
    const mL = musicL || new Float32Array(len);
    const mR = musicR || new Float32Array(len);

    const blockAlign = NUM_CHANNELS * (BITS / 8); // 8 bytes per sample-frame
    const byteRate = SAMPLE_RATE * blockAlign; // 352800 @ 44.1 kHz
    const dataBytes = len * blockAlign;

    // ── Standard PCM WAV header (44 bytes) ──────────────────────────────────
    // AudioFormat = 1 (PCM). No cbSize, no ChannelMask, no SubFormat GUID.
    // This is the exact format STPE/Unity ByteArrayToAudioClip accepts.
    //
    // CHANNEL ORDER — critical for SPTE:
    //   SPTE routes Ch0 and Ch1 to the audio output (speakers).
    //   SPTE's BMC decoder reads Ch2 and Ch3 as the data/signal tracks.
    //   Matches the original RAE 4-track tape layout (Pro-Grade-Specs.md):
    //     Track 1 (Ch0) = Music L
    //     Track 2 (Ch1) = Music R
    //     Track 3 (Ch2) = TD  (Treble Data — animatronic control signal)
    //     Track 4 (Ch3) = BD  (Bass Data   — animatronic control signal)
    const buf = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buf);

    function writeStr(off, str) {
      for (let i = 0; i < str.length; i++)
        view.setUint8(off + i, str.charCodeAt(i));
    }
    function writeS16(off, f) {
      const s = Math.max(-1, Math.min(1, f));
      view.setInt16(off, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
    }

    // ── RIFF chunk ───────────────────────────────────────────────────────────
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true); // file size - 8
    writeStr(8, "WAVE");

    // ── fmt chunk (standard PCM, 16-byte payload) ────────────────────────────
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size = 16 (PCM)
    view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
    view.setUint16(22, NUM_CHANNELS, true); // nChannels = 4
    view.setUint32(24, SAMPLE_RATE, true); // nSamplesPerSec = 44100
    view.setUint32(28, byteRate, true); // nAvgBytesPerSec = 352800
    view.setUint16(32, blockAlign, true); // nBlockAlign = 8
    view.setUint16(34, BITS, true); // wBitsPerSample = 16

    // ── data chunk ───────────────────────────────────────────────────────────
    writeStr(36, "data");
    view.setUint32(40, dataBytes, true);

    // Interleave: [MusicL, MusicR, TD, BD] per sample-frame
    // Ch0=Music L, Ch1=Music R, Ch2=TD, Ch3=BD
    // SPTE uses Ch0/1 for audio output and Ch2/3 for BMC data decoding.
    let off = 44;
    for (let i = 0; i < len; i++) {
      writeS16(off, mL[i] || 0); // Ch0 Music L
      writeS16(off + 2, mR[i] || 0); // Ch1 Music R
      writeS16(
        off + 4,
        Math.max(-SIGNAL_PEAK, Math.min(SIGNAL_PEAK, tdData[i] || 0)),
      ); // Ch2 TD
      writeS16(
        off + 6,
        Math.max(-SIGNAL_PEAK, Math.min(SIGNAL_PEAK, bdData[i] || 0)),
      ); // Ch3 BD
      off += 8;
    }

    return new Blob([buf], { type: "audio/wav" });
  }
}

// Global instance
const signalGenerator = new CyberstarSignalGenerator();
