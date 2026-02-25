/**
 * Cyberstar Analog Signal Generator
 * Implements Biphase Mark Code (BMC) encoding for digital control signals
 *
 * Cyberstar used a single-channel audio track to encode digital control data:
 * - Encoding: Biphase Mark Code (phase-based, self-clocking)
 * - Bitrate: 300-1200 bps (typical ~600 bps)
 * - Signal: Bipolar square wave with phase transitions
 * - Storage: Analog audio track on tape/media
 */

class CyberstarSignalGenerator {
  constructor(options = {}) {
    this.audioContext = null;
    this.volume = options.volume || 0.7;

    // BMC encoding parameters
    this.bitrate = options.bitrate || 600; // bits per second
    this.sampleRate = options.sampleRate || 48000;
    this.amplitude = options.amplitude || 0.8;
    this.noiseLevel = options.noiseLevel || 0.02;
    this.lowpassCutoff = options.lowpassCutoff || 3000;

    this.initAudioContext();
  }

  initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
  }

  /**
   * Encode a byte array using Biphase Mark Code (BMC)
   * BMC Rule:
   * - Bit 1: transition at mid-bit AND at bit boundary
   * - Bit 0: NO transition at mid-bit, transition at bit boundary
   * @param {Uint8Array} dataBytes - Control data to encode
   * @returns {Array<number>} Encoded bit stream
   */
  encodeBMC(dataBytes) {
    const bits = [];

    // Convert bytes to individual bits
    for (let i = 0; i < dataBytes.length; i++) {
      const byte = dataBytes[i];
      for (let bit = 7; bit >= 0; bit--) {
        bits.push((byte >> bit) & 1);
      }
    }

    return bits;
  }

  /**
   * Generate waveform samples from BMC-encoded bits
   * @param {Array<number>} bits - BMC-encoded bit stream
   * @returns {Float32Array} Audio samples
   */
  generateBMCWaveform(bits) {
    const samplesPerBit = this.sampleRate / this.bitrate;
    const samplesPerHalfBit = samplesPerBit / 2;
    const totalSamples = Math.ceil(bits.length * samplesPerBit);

    const waveform = new Float32Array(totalSamples);
    let currentLevel = 1; // Start at +1

    for (let bitIndex = 0; bitIndex < bits.length; bitIndex++) {
      const bit = bits[bitIndex];
      const bitStart = Math.floor(bitIndex * samplesPerBit);
      const bitEnd = Math.floor((bitIndex + 1) * samplesPerBit);
      const halfBitPoint = Math.floor(bitStart + samplesPerHalfBit);

      // BMC encoding logic
      if (bit === 1) {
        // Bit 1: transition at mid-bit AND at boundary
        // First half: current level
        for (let i = bitStart; i < halfBitPoint; i++) {
          waveform[i] = currentLevel;
        }
        // Toggle at mid-bit
        currentLevel *= -1;
        // Second half: toggled level
        for (let i = halfBitPoint; i < bitEnd; i++) {
          waveform[i] = currentLevel;
        }
        // Toggle at boundary (will be applied in next iteration)
        currentLevel *= -1;
      } else {
        // Bit 0: NO transition at mid-bit, transition at boundary
        // First half: current level
        for (let i = bitStart; i < halfBitPoint; i++) {
          waveform[i] = currentLevel;
        }
        // Second half: same level (no mid-bit transition)
        for (let i = halfBitPoint; i < bitEnd; i++) {
          waveform[i] = currentLevel;
        }
        // Toggle only at boundary
        currentLevel *= -1;
      }
    }

    // Add light noise for analog character
    if (this.noiseLevel > 0) {
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] += (Math.random() - 0.5) * 2 * this.noiseLevel;
        // Clamp to prevent clipping
        waveform[i] = Math.max(-1, Math.min(1, waveform[i]));
      }
    }

    return waveform;
  }

  /**
   * Apply simple low-pass filter for tape-like response
   * @param {Float32Array} waveform - Audio samples
   * @returns {Float32Array} Filtered waveform
   */
  applyLowpassFilter(waveform) {
    // Simple one-pole IIR low-pass filter
    const cutoffFreq = this.lowpassCutoff;
    const rc = 1.0 / (2 * Math.PI * cutoffFreq);
    const dt = 1.0 / this.sampleRate;
    const alpha = dt / (rc + dt);

    const filtered = new Float32Array(waveform.length);
    filtered[0] = waveform[0];

    for (let i = 1; i < waveform.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (waveform[i] - filtered[i - 1]);
    }

    return filtered;
  }

  /**
   * Play a BMC-encoded control signal
   * @param {Uint8Array} dataBytes - Control data to encode and play
   * @param {number} volume - Volume (0-1)
   */
  playBMCSignal(dataBytes, volume = 0.7) {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    // Encode data using BMC
    const bits = this.encodeBMC(dataBytes);

    // Generate waveform from bits
    let waveform = this.generateBMCWaveform(bits);

    // Apply low-pass filtering for analog character
    waveform = this.applyLowpassFilter(waveform);

    // Scale amplitude
    for (let i = 0; i < waveform.length; i++) {
      waveform[i] *= this.amplitude;
    }

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      1,
      waveform.length,
      this.sampleRate,
    );
    audioBuffer.getChannelData(0).set(waveform);

    // Create and schedule playback
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);

    return {
      source: source,
      gainNode: gainNode,
      duration: waveform.length / this.sampleRate,
    };
  }

  /**
   * Generate BMC signal for a specific character movement
   * Maps movement name to control bytes
   */
  generateMovementSignal(characterName, movementKey, channel, duration = 500) {
    // Create a hash from character + movement to generate consistent but varying patterns
    const hash = characterName.charCodeAt(0) + movementKey.charCodeAt(0);
    const basePattern = hash % 8;

    // Generate different byte patterns based on movement type and character
    let dataBytes;
    const movementByte = (channel << 6) | (basePattern & 0x3f);

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
        dataBytes = new Uint8Array([0x0f, 0xf0, movementByte]);
        break;
      case "arm":
      case "shoulder":
      case "hand":
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

  /**
   * Generate command bytes for common Cyberstar operations
   */
  generateMoveCommand(channel, speed = 128) {
    // 0 byte = sync, next byte = command with channel + speed
    const commandByte = (channel << 6) | (speed & 0x3f);
    return new Uint8Array([0x00, commandByte]);
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
  }

  /**
   * Get current audio context state
   */
  getAudioContextState() {
    return this.audioContext?.state || "not initialized";
  }
}

// Create global instance
const signalGenerator = new CyberstarSignalGenerator();
