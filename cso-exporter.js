/**
 * cso-exporter.js  —  Cyberstar Show Object (.cso) Exporter
 * =============================================================================
 *
 * Converts a validated 4-channel Cyberstar broadcast WAV into a .cso file that
 * RR-Engine's CsoDecoder can load and play directly.
 *
 * PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 *  Input:  4-channel 44100 Hz 16-bit PCM WAV (produced by app.js exportBroadcastWav)
 *            Ch0 = Music L
 *            Ch1 = Music R
 *            Ch2 = TD  (Treble Data BMC signal)
 *            Ch3 = BD  (Bass Data BMC signal)
 *
 *  Step 1: Decode TD and BD BMC signals → raw bit arrays (uses stDirectDecode
 *          from app.js, already available globally).
 *  Step 2: Segment bit array into frames (96 bits / frame).
 *  Step 3: Validate every frame:
 *            • First byte must be 0xFF (sync)
 *            • Blank bits must be 0 (TD: 56, 65, 70 — BD: 45, 1-indexed)
 *  Step 4: Pack frame data (12 bytes TD + 12 bytes BD per frame → bitmasks).
 *  Step 5: Extract music PCM from Ch0/Ch1.
 *  Step 6: Write binary .cso file and trigger browser download.
 *
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *  // After generating a 4-channel WAV buffer via app.js:
 *  const result = await exportCso(fourChannelWavBuffer, { validate: true });
 *  if (result.ok) downloadBlob(result.blob, 'myshow.cso');
 *
 * DEPENDENCIES
 * ─────────────────────────────────────────────────────────────────────────────
 *  • stDirectDecode(channelFloat32, sampleRate)   — from app.js
 *  • app.js must be loaded first (it defines stDirectDecode in global scope)
 * =============================================================================
 */

// ─── Constants (must match CsoFile.cs and constants.py) ───────────────────────
const CSO_MAGIC = [0x43, 0x53, 0x4f, 0x31]; // "CSO1"
const CSO_VERSION = 1;
const CSO_HEADER_SIZE = 64;
const CSO_BYTES_PER_FRAME = 24; // 12 TD + 12 BD
const CSO_SAMPLE_RATE = 44100;
const CSO_FRAME_BITS = 96; // bits per BMC frame (including sync)
const CSO_TD_BIT_COUNT = 94;
const CSO_BD_BIT_COUNT = 96;

// Frame rate: 4410 bps ÷ 96 bits = 45.9375 fps
const CSO_FPS_NUM = 4410;
const CSO_FPS_DEN = 96;

// Blank bits (1-indexed, must be 0 in every frame)
const TD_BLANK_BITS = new Set([56, 65, 70]);
const BD_BLANK_BITS = new Set([45]);

// ─── Main export function ──────────────────────────────────────────────────────

/**
 * Export a 4-channel broadcast WAV as a .cso Blob.
 *
 * @param {ArrayBuffer} wavBuffer  The 4-channel 44100 Hz WAV ArrayBuffer
 * @param {object} [opts]
 * @param {boolean} [opts.validate=true]   Run SCME frame validation
 * @param {boolean} [opts.verbose=false]   Log per-frame validation results
 * @returns {{ ok: boolean, blob: Blob|null, report: string }}
 */
async function exportCso(wavBuffer, opts = {}) {
  const validate = opts.validate !== false;
  const verbose = opts.verbose === true;
  const report = [];

  // ── 1. Parse WAV ─────────────────────────────────────────────────────────
  const wav = parseWav(wavBuffer);
  if (!wav)
    return { ok: false, blob: null, report: ["Failed to parse WAV header."] };
  if (wav.channels < 4)
    return {
      ok: false,
      blob: null,
      report: [`Expected 4-channel WAV, got ${wav.channels}.`],
    };
  if (wav.sampleRate !== CSO_SAMPLE_RATE) {
    report.push(
      `Warning: WAV sample rate is ${wav.sampleRate}, expected ${CSO_SAMPLE_RATE}.`,
    );
  }

  const musicL = wav.getChannel(0); // Float32Array
  const musicR = wav.getChannel(1);
  const tdRaw = wav.getChannel(2); // TD BMC signal (Float32)
  const bdRaw = wav.getChannel(3); // BD BMC signal (Float32)

  // ── 2. BMC decode TD and BD ───────────────────────────────────────────────
  report.push("Decoding BMC signals…");
  const tdBits = stDirectDecode(tdRaw, wav.sampleRate); // Uint8Array of 0/1
  const bdBits = stDirectDecode(bdRaw, wav.sampleRate);

  if (!tdBits || !bdBits) {
    return { ok: false, blob: null, report: [...report, "BMC decode failed."] };
  }
  report.push(`TD: ${tdBits.length} bits decoded.`);
  report.push(`BD: ${bdBits.length} bits decoded.`);

  // ── 3. Segment into frames ────────────────────────────────────────────────
  const tdFrames = segmentFrames(tdBits);
  const bdFrames = segmentFrames(bdBits);

  const totalFrames = Math.min(tdFrames.length, bdFrames.length);
  report.push(
    `Total frames: ${totalFrames} (TD=${tdFrames.length}, BD=${bdFrames.length})`,
  );

  if (totalFrames === 0) {
    return {
      ok: false,
      blob: null,
      report: [...report, "No complete frames found."],
    };
  }

  // ── 4. Validate ────────────────────────────────────────────────────────────
  let validationPassed = true;
  let blankViolations = 0;
  let syncErrors = 0;

  if (validate) {
    report.push("Validating frames…");
    for (let f = 0; f < totalFrames; f++) {
      const td = tdFrames[f];
      const bd = bdFrames[f];

      // Sync byte check: first 8 bits of TD should be 0xFF, BD should be 0xFF
      const tdSync = readByte(td, 0);
      const bdSync = readByte(bd, 0);
      if (tdSync !== 0xff) {
        syncErrors++;
        if (verbose)
          report.push(
            `Frame ${f}: TD sync = 0x${tdSync.toString(16)} (expected 0xFF)`,
          );
      }
      if (bdSync !== 0xff) {
        syncErrors++;
        if (verbose)
          report.push(
            `Frame ${f}: BD sync = 0x${bdSync.toString(16)} (expected 0xFF)`,
          );
      }

      // Blank bits (1-indexed — bit 1 is the MSB of the first data byte post-sync)
      // The frame post-sync data starts at bit 8 (after the 0xFF sync byte).
      // But in the raw bit stream the sync byte is included at position 0.
      // PDF bit N (1-indexed, 1=first data bit after sync) = raw bit N+7 (skip the 8 sync bits).
      // Actually in the stDirectDecode output, the entire 96-bit frame is present including sync.
      // We check data-only bits: PDF bit N corresponds to raw bit index N + 7.
      for (const blankBit of TD_BLANK_BITS) {
        const rawIdx = 7 + blankBit; // +7 to skip sync byte (bits 0-7)
        if (rawIdx < td.length && td[rawIdx] !== 0) {
          blankViolations++;
          if (verbose)
            report.push(`Frame ${f}: TD blank bit ${blankBit} is SET.`);
        }
      }
      for (const blankBit of BD_BLANK_BITS) {
        const rawIdx = 7 + blankBit;
        if (rawIdx < bd.length && bd[rawIdx] !== 0) {
          blankViolations++;
          if (verbose)
            report.push(`Frame ${f}: BD blank bit ${blankBit} is SET.`);
        }
      }
    }

    if (syncErrors > 0) {
      report.push(
        `Warning: ${syncErrors} sync byte error(s) across ${totalFrames} frames.`,
      );
      validationPassed = false;
    } else {
      report.push("Sync byte validation passed.");
    }

    if (blankViolations > 0) {
      report.push(
        `Warning: ${blankViolations} blank-bit violation(s). Show may not match hardware specs.`,
      );
      validationPassed = false;
    } else {
      report.push("Blank-bit validation passed.");
    }

    report.push(
      validationPassed
        ? "SCME validation PASSED."
        : "SCME validation FAILED (see warnings above).",
    );
  }

  // ── 5. Pack frame table ────────────────────────────────────────────────────
  report.push("Packing frame table…");
  const frameTableBytes = totalFrames * CSO_BYTES_PER_FRAME;
  const frameTable = new Uint8Array(frameTableBytes);

  for (let f = 0; f < totalFrames; f++) {
    const td = tdFrames[f];
    const bd = bdFrames[f];
    const off = f * CSO_BYTES_PER_FRAME;

    // Pack TD bits 1-94 (PDF, 1-indexed) → bytes 0-11
    // PDF bit N is raw bit index N+7 (skipping the 8-bit sync header at bit 0).
    // In the output bitmask: bit N → byte (N-1)/8, shift 7-((N-1)%8)  (MSB-first)
    for (let n = 1; n <= CSO_TD_BIT_COUNT; n++) {
      const rawIdx = 7 + n; // skip 0xFF sync byte (bits 0-7)
      const bitVal = rawIdx < td.length ? td[rawIdx] : 0;
      const byteIdx = Math.floor((n - 1) / 8);
      const bitShift = 7 - ((n - 1) % 8);
      if (bitVal) frameTable[off + byteIdx] |= 1 << bitShift;
    }

    // Pack BD bits 1-96 → bytes 12-23
    for (let n = 1; n <= CSO_BD_BIT_COUNT; n++) {
      const rawIdx = 7 + n;
      const bitVal = rawIdx < bd.length ? bd[rawIdx] : 0;
      const byteIdx = 12 + Math.floor((n - 1) / 8);
      const bitShift = 7 - ((n - 1) % 8);
      if (bitVal) frameTable[off + byteIdx] |= 1 << bitShift;
    }
  }

  // ── 6. Pack music PCM ─────────────────────────────────────────────────────
  report.push("Packing music PCM…");
  const musicSamples = Math.min(musicL.length, musicR.length);
  const musicPCM = new Uint8Array(musicSamples * 4); // 2ch × 2 bytes
  const pcmView = new DataView(musicPCM.buffer);

  for (let i = 0; i < musicSamples; i++) {
    const l = Math.max(-1, Math.min(1, musicL[i]));
    const r = Math.max(-1, Math.min(1, musicR[i]));
    pcmView.setInt16(i * 4, Math.round(l < 0 ? l * 32768 : l * 32767), true);
    pcmView.setInt16(
      i * 4 + 2,
      Math.round(r < 0 ? r * 32768 : r * 32767),
      true,
    );
  }

  // ── 7. Compute frame table CRC-32 ─────────────────────────────────────────
  const crc32 = computeCRC32(frameTable);

  // ── 8. Assemble .cso binary ───────────────────────────────────────────────
  report.push("Writing .cso binary…");
  const totalSize = CSO_HEADER_SIZE + frameTableBytes + musicPCM.byteLength;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let off = 0;

  // Magic
  for (let i = 0; i < CSO_MAGIC.length; i++) u8[off++] = CSO_MAGIC[i];

  // Version, TdBitCount, BdBitCount, reserved
  u8[off++] = CSO_VERSION;
  u8[off++] = CSO_TD_BIT_COUNT;
  u8[off++] = CSO_BD_BIT_COUNT;
  u8[off++] = 0; // reserved

  // SampleRate (int32 LE)
  view.setInt32(off, wav.sampleRate, true);
  off += 4;

  // TotalFrames
  view.setInt32(off, totalFrames, true);
  off += 4;

  // MusicSamplesPerChannel
  view.setInt32(off, musicSamples, true);
  off += 4;

  // FrameRateNum / Den
  view.setInt32(off, CSO_FPS_NUM, true);
  off += 4;
  view.setInt32(off, CSO_FPS_DEN, true);
  off += 4;

  // ValidationFlags (bit 0 = SCME passed)
  view.setUint32(off, validationPassed ? 1 : 0, true);
  off += 4;

  // CRC32
  view.setUint32(off, crc32, true);
  off += 4;

  // Reserved (zeros — skip to HEADER_SIZE)
  off = CSO_HEADER_SIZE;

  // Frame table
  u8.set(frameTable, off);
  off += frameTableBytes;

  // Music PCM
  u8.set(musicPCM, off);

  const blob = new Blob([buf], { type: "application/octet-stream" });
  report.push(`Done. .cso size: ${(totalSize / 1024).toFixed(1)} KB`);

  return { ok: true, blob, report };
}

// ─── UI entry point ────────────────────────────────────────────────────────────

/**
 * Called from a "Export as CSO" button click in app.js.
 * Expects that the most recently exported 4-channel WAV blob is available
 * as window._lastBroadcastWavBlob (set by app.js after exportBroadcastWav).
 */
async function exportCsoFromCurrentShow() {
  const wavBlob = window._lastBroadcastWavBlob;
  if (!wavBlob) {
    alert(
      "No broadcast WAV available. Please export the 4-channel WAV first, then export as CSO.",
    );
    return;
  }

  const statusEl = document.getElementById("cso-export-status");
  if (statusEl) statusEl.textContent = "Exporting .cso…";

  const buffer = await wavBlob.arrayBuffer();
  const result = await exportCso(buffer, { validate: true, verbose: false });

  // Log the report to the console
  result.report.forEach((line) => console.log("[CSO Export]", line));

  if (result.ok) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(result.blob);
    a.href = url;
    a.download = "show.cso";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (statusEl) statusEl.textContent = "CSO exported successfully.";
  } else {
    if (statusEl)
      statusEl.textContent = "CSO export failed. See console for details.";
    alert("CSO export failed:\n" + result.report.join("\n"));
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Split a flat Uint8Array of bits into 96-bit frame arrays. */
function segmentFrames(bits) {
  const frames = [];
  const step = CSO_FRAME_BITS;
  for (let i = 0; i + step <= bits.length; i += step) {
    frames.push(bits.subarray(i, i + step));
  }
  return frames;
}

/** Read one byte's worth of bits (MSB-first) from a bit array at given bit offset. */
function readByte(bits, bitOffset) {
  let val = 0;
  for (let i = 0; i < 8; i++) {
    if (bitOffset + i < bits.length && bits[bitOffset + i]) val |= 1 << (7 - i);
  }
  return val;
}

/** Parse a WAV ArrayBuffer, returning channel accessor and metadata. */
function parseWav(buffer) {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (riff !== "RIFF") return null;
  const wave = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
  if (wave !== "WAVE") return null;

  let sampleRate = 0,
    channels = 0,
    bitsPerSample = 0,
    dataOffset = 0,
    dataLength = 0;
  let pos = 12;
  while (pos < buffer.byteLength - 8) {
    const id = String.fromCharCode(
      u8[pos],
      u8[pos + 1],
      u8[pos + 2],
      u8[pos + 3],
    );
    const size = view.getUint32(pos + 4, true);
    if (id === "fmt ") {
      channels = view.getUint16(pos + 10, true);
      sampleRate = view.getUint32(pos + 12, true);
      bitsPerSample = view.getUint16(pos + 22, true);
    } else if (id === "data") {
      dataOffset = pos + 8;
      dataLength = size;
      break;
    }
    pos += 8 + size;
  }
  if (!sampleRate || !dataOffset) return null;

  const bytesPerSample = bitsPerSample / 8;
  const samplesPerFrame = channels;
  const totalSamples = (dataLength / bytesPerSample / channels) | 0;

  function getChannel(ch) {
    const out = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const byteOff = dataOffset + (i * channels + ch) * bytesPerSample;
      let raw;
      if (bitsPerSample === 16) {
        raw = view.getInt16(byteOff, true) / 32768;
      } else if (bitsPerSample === 8) {
        raw = (view.getUint8(byteOff) - 128) / 128;
      } else {
        raw = view.getInt16(byteOff, true) / 32768; // fallback
      }
      out[i] = raw;
    }
    return out;
  }

  return { channels, sampleRate, bitsPerSample, totalSamples, getChannel };
}

/** Standard CRC-32 (same polynomial as CsoFile.cs). */
function computeCRC32(bytes) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
