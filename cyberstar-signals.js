/**
 * Cyberstar Analog Signal Generator
 * Implements Biphase Mark Code (BMC) encoding for digital control signals
 *
 * Cyberstar used a single-channel audio track to encode digital control data:
 * - Encoding: Biphase Mark Code (phase-based, self-clocking)
 * - Signal: Bipolar square wave with phase transitions
 * - Architecture: Time-Division Multiplexed (TDM) serial stream
 *
 * All character channels are serialized into ONE continuous bit stream —
 * exactly as the real hardware would output on its signal line.
 *
 * TDM Frame format (sent FRAME_RATE times per second):
 *   [0xFF][0x00][ch0][ch1][ch2][ch3][ch4][ch5][ch6][ch7][0xAA]
 *          sync header    8 channel bytes (one per character slot)  end
 *   = 11 bytes = 88 bits per frame
 *   At 2400 bps a frame takes ~36.7 ms — fits cleanly in a 50 ms slot (20 fps).
 *
 * This produces one coherent, rhythmic BMC signal for the whole band,
 * rather than scattered per-character audio bursts.
 */

class CyberstarSignalGenerator {
  constructor(options = {}) {
    this.audioContext = null;

    // BMC / stream parameters
    this.bitrate = 2400; // bps — fast enough for multi-channel TDM
    this.frameRate = 20; // TDM frames per second (50 ms per frame)
    this.amplitude = options.amplitude || 0.85;
    this.noiseLevel = options.noiseLevel || 0.015; // light tape hiss
    this.lowpassCutoff = 5000; // Hz — preserves crisp transitions

    this.volume = options.volume || 0.7;

    // 8 channel slots — one byte each, written into every TDM frame.
    // Slot 0 = character 1, slot 1 = character 2, etc.
    this.NUM_SLOTS = 8;
    this.channelSlots = new Uint8Array(this.NUM_SLOTS); // 0x00 = idle

    // Map: characterName → slot index
    this.characterSlotMap = new Map();

    // Stream scheduling state
    this.isStreaming = false;
    this.nextFrameTime = 0; // audioContext time when the next frame should start
    this.schedulerTimer = null;
    this.SCHEDULE_AHEAD = 0.15; // seconds ahead to pre-queue (keeps audio gap-free)

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
        sampleRate: 48000,
      });
    }
  }

  get sampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 48000;
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
        bits.push((byte >> b) & 1);
      }
    }
    return bits;
  }

  /**
   * Render a BMC bit stream into a Float32Array waveform.
   * Produces a bipolar square wave (+1 / −1) with BMC phase transitions.
   */
  generateBMCWaveform(bits) {
    const samplesPerBit = this.sampleRate / this.bitrate;
    const samplesPerHalf = samplesPerBit / 2;
    const totalSamples = Math.ceil(bits.length * samplesPerBit);
    const waveform = new Float32Array(totalSamples);
    let level = 1; // start at +1

    for (let bi = 0; bi < bits.length; bi++) {
      const bit = bits[bi];
      const start = Math.floor(bi * samplesPerBit);
      const end = Math.floor((bi + 1) * samplesPerBit);
      const midpoint = Math.floor(start + samplesPerHalf);

      if (bit === 1) {
        // First half at current level
        for (let i = start; i < midpoint; i++) waveform[i] = level;
        level *= -1; // mid-bit transition
        for (let i = midpoint; i < end; i++) waveform[i] = level;
        level *= -1; // boundary transition
      } else {
        // Both halves at current level (no mid-bit transition)
        for (let i = start; i < end; i++) waveform[i] = level;
        level *= -1; // boundary transition only
      }
    }

    // Light noise for analog tape character
    if (this.noiseLevel > 0) {
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
   * Encode one TDM frame and schedule its AudioBuffer at the given context time.
   * This is the heart of the multiplexed signal: one continuous BMC stream.
   *
   * Idle frames (all channel slots 0x00) are scheduled as silence so the
   * sync-byte pattern doesn't produce constant background beeping between
   * character movements.
   */
  _scheduleFrame(atTime) {
    // Determine how many samples this frame occupies so we can schedule
    // silence for idle frames without leaving a gap in the timeline.
    const samplesPerBit = this.sampleRate / this.bitrate;
    const bitsPerFrame = 11 * 8; // 11 bytes × 8 bits
    const frameSamples = Math.ceil(bitsPerFrame * samplesPerBit);

    // If every channel slot is idle, emit silence for this frame slot.
    const hasActivity = this.channelSlots.some((b) => b !== 0x00);
    if (!hasActivity) {
      const silentBuf = this.audioContext.createBuffer(
        1,
        frameSamples,
        this.sampleRate,
      );
      // AudioContext buffer is zero-filled by default — pure silence.
      const src = this.audioContext.createBufferSource();
      src.buffer = silentBuf;
      src.connect(this.audioContext.destination);
      src.start(atTime);
      return;
    }

    const frameBytes = this.buildTDMFrame();
    const bits = this.encodeBMC(frameBytes);
    let waveform = this.generateBMCWaveform(bits);
    waveform = this.applyLowpassFilter(waveform);

    const scale = this.amplitude * this.volume;
    for (let i = 0; i < waveform.length; i++) waveform[i] *= scale;

    const buffer = this.audioContext.createBuffer(
      1,
      waveform.length,
      this.sampleRate,
    );
    buffer.getChannelData(0).set(waveform);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(atTime); // sample-accurate — no audible gaps between frames
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Character state API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Map an ordered array of character names to slot indices 0–7.
   * Call this whenever the active band changes.
   * @param {string[]} orderedNames  e.g. ["Billy Bob", "Mitzi", "Fatz", ...]
   */
  setupBandSlots(orderedNames) {
    this.characterSlotMap.clear();
    this.clearAllCharacterStates();
    orderedNames.forEach((name, i) => {
      if (i < this.NUM_SLOTS) this.characterSlotMap.set(name, i);
    });
  }

  /**
   * Update the control byte for a named character.
   * The value is held for one TDM frame duration then automatically cleared
   * back to idle (0x00), so each movement fires as a discrete pulse rather
   * than a sustained state that drones on through every subsequent frame.
   * @param {string}     characterName
   * @param {Uint8Array} dataBytes — last byte used as the slot control value
   */
  setCharacterState(characterName, dataBytes) {
    const slot = this.characterSlotMap.get(characterName);
    if (slot === undefined) return;
    this.channelSlots[slot] = dataBytes[dataBytes.length - 1];

    // Auto-clear after one frame duration (1000ms / frameRate).
    // This ensures each command is a brief trigger pulse, not a sticky state.
    const holdMs = Math.ceil(1000 / this.frameRate); // 50 ms at 20 fps
    setTimeout(() => {
      if (this.channelSlots[slot] === dataBytes[dataBytes.length - 1]) {
        this.channelSlots[slot] = 0x00;
      }
    }, holdMs);
  }

  /** Reset a single character's slot to idle (0x00). */
  clearCharacterState(characterName) {
    const slot = this.characterSlotMap.get(characterName);
    if (slot !== undefined) this.channelSlots[slot] = 0x00;
  }

  /** Reset all slots to idle. */
  clearAllCharacterStates() {
    this.channelSlots.fill(0x00);
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
    waveform = this.applyLowpassFilter(waveform);

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
}

// Global instance
const signalGenerator = new CyberstarSignalGenerator();
