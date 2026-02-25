/**
 * Cyberstar Simulator - Main Application Logic
 * Works with Biphase Mark Code (BMC) encoded control signals
 */

let currentShowtapeId = null;
let currentBand = "munch"; // 'munch' or 'rock'

let currentPlaybackState = {
  isPlaying: false,
  isPaused: false,
  currentTime: 0,
  totalTime: 0,
  playbackSpeed: 1.0,
  volume: 0.7,
};

// Band and character configuration
const BAND_CONFIG = {
  munch: {
    title: "🎸 Munch's Make Believe Band",
    characters: {
      ch1: { name: "Chuck E. Cheese", monitorId: "monitor-chuck" },
      ch2: { name: "Munch", monitorId: "monitor-munch" },
      ch3: { name: "Helen Henny", monitorId: "monitor-helen" },
      ch4: { name: "Jasper T. Jowls", monitorId: "monitor-jasper" },
      ch5: { name: "Pasqually", monitorId: "monitor-pasqually" },
    },
  },
  rock: {
    title: "🔥 The Rock - Afire Explosion",
    characters: {
      ch1: { name: "Billy Bob", monitorId: "monitor-billy" },
      ch2: { name: "Mitzi", monitorId: "monitor-mitzi" },
      ch3: { name: "Fatz", monitorId: "monitor-fatz" },
      ch4: { name: "Beach Bear", monitorId: "monitor-beach" },
      ch5: { name: "Dook LaRue", monitorId: "monitor-dook" },
      ch6: { name: "Rolfe", monitorId: "monitor-rolfe" },
      ch7: { name: "Earl", monitorId: "monitor-earl" },
    },
  },
};

/**
 * Helper function to get monitor ID for a character name
 */
function getMonitorIdForCharacter(characterName) {
  // Search all bands for the character
  for (const band of Object.values(BAND_CONFIG)) {
    for (const ch of Object.values(band.characters)) {
      if (ch.name === characterName) {
        return ch.monitorId;
      }
    }
  }
  return null;
}

let playbackSchedule = [];
let playbackStartTime = null;

// WAV song sync
let songBuffer = null; // decoded AudioBuffer for the loaded WAV
let songSource = null; // current playing AudioBufferSourceNode
let songGainNode = null; // gain node for the song

// localStorage key for persisted custom showtapes
const CUSTOM_SHOWS_KEY = "cyberstar_custom_shows";

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
  loadCustomShowtapes(); // populates SHOWTAPES before the dropdown is built
  updateShowtapeList();

  // Set initial band title
  const bandConfig = BAND_CONFIG[currentBand];
  document.getElementById("band-title").textContent =
    `${bandConfig.title} - Signal Monitors`;

  // Configure the TDM stream slot assignments for the initial band
  setupCurrentBandSlots();

  updateSignalMonitor("System initialized. TDM stream ready.");
});

/**
 * Tell the signal generator which characters occupy which TDM slots
 * for the currently active band.
 */
function setupCurrentBandSlots() {
  const chars = Object.values(BAND_CONFIG[currentBand].characters).map(
    (c) => c.name,
  );
  signalGenerator.setupBandSlots(chars);
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Band selector
  document
    .getElementById("band-select")
    .addEventListener("change", onBandSelected);

  // Showtape player controls
  document.getElementById("play-btn").addEventListener("click", playShowtape);
  document.getElementById("pause-btn").addEventListener("click", pauseShowtape);
  document.getElementById("stop-btn").addEventListener("click", stopShowtape);
  document
    .getElementById("showtape-select")
    .addEventListener("change", onShowtapeSelected);

  // Playback controls
  document
    .getElementById("speed-control")
    .addEventListener("change", onSpeedChanged);
  document
    .getElementById("volume-control")
    .addEventListener("change", onVolumeChanged);
  document
    .getElementById("progress-bar")
    .addEventListener("change", onProgressChanged);

  // WAV file loader (song-sync panel)
  document.getElementById("wav-input").addEventListener("change", (e) => {
    if (e.target.files[0]) loadWAVFile(e.target.files[0]);
  });

  // Custom Show Builder
  const customWavInput = document.getElementById("custom-wav-input");
  const generateBtn = document.getElementById("generate-show-btn");

  customWavInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const nameEl = document.getElementById("custom-wav-name");
    if (file) {
      nameEl.textContent = file.name;
      generateBtn.disabled = false;
    } else {
      nameEl.textContent = "No file chosen";
      generateBtn.disabled = true;
    }
  });

  generateBtn.addEventListener("click", () => {
    const file = customWavInput.files[0];
    if (!file) return;
    const title =
      document.getElementById("custom-show-title").value.trim() ||
      file.name.replace(/\.[^.]+$/, "");
    const band = document.getElementById("custom-show-band").value;
    buildCustomShowtape(file, title, band);
  });
}

/**
 * Handle band selection
 */
function onBandSelected(event) {
  currentBand = event.target.value;
  const bandConfig = BAND_CONFIG[currentBand];

  // Update section title
  document.getElementById("band-title").textContent =
    `${bandConfig.title} - Signal Monitors`;

  // Switch band monitors
  document.getElementById("munch-band").style.display =
    currentBand === "munch" ? "grid" : "none";
  document.getElementById("rock-band").style.display =
    currentBand === "rock" ? "grid" : "none";

  // Clear all monitors
  clearAllMonitors();

  // Reassign TDM slot map for the new band
  setupCurrentBandSlots();

  updateSignalMonitor(`Switched to: ${bandConfig.title}`);
}

/**
 * Clear all character monitors
 */
function clearAllMonitors() {
  Object.values(BAND_CONFIG).forEach((bandConfig) => {
    Object.values(bandConfig.characters).forEach((character) => {
      const monitor = document.getElementById(character.monitorId);
      if (monitor) {
        monitor.innerHTML = "<p>Ready</p>";
      }
    });
  });
}

/**
 * Update a character-specific monitor
 */
function updateCharacterMonitor(channel, message) {
  const bandConfig = BAND_CONFIG[currentBand];
  const charKey = `ch${channel}`;

  if (!bandConfig.characters[charKey]) return;

  const character = bandConfig.characters[charKey];
  const monitor = document.getElementById(character.monitorId);

  if (!monitor) return;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement("p");
  logEntry.textContent = `[${timestamp}] ${message}`;

  // Keep only last 5 messages per character
  while (monitor.children.length >= 5) {
    monitor.removeChild(monitor.firstChild);
  }

  monitor.appendChild(logEntry);
}

/**
 * Update character monitor by monitor element ID
 */
function updateCharacterMonitorById(monitorId, message) {
  const monitor = document.getElementById(monitorId);
  if (!monitor) return;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement("p");
  logEntry.textContent = `[${timestamp}] ${message}`;

  // Keep only last 5 messages per character
  while (monitor.children.length >= 5) {
    monitor.removeChild(monitor.firstChild);
  }

  monitor.appendChild(logEntry);
}

/**
 * Update the showtape list dropdown
 */
function updateShowtapeList() {
  const select = document.getElementById("showtape-select");
  const tapes = getShowtapeList();

  // Clear existing options except the placeholder
  select.innerHTML = '<option value="">-- Choose a showtape --</option>';

  // Add showtapes
  tapes.forEach((tape) => {
    const option = document.createElement("option");
    option.value = tape.id;
    const isCustom = SHOWTAPES[tape.id]?.isCustom;
    option.textContent = isCustom ? `⭐ ${tape.title}` : tape.title;
    select.appendChild(option);
  });
}

/**
 * Handle showtape selection
 */
function onShowtapeSelected(event) {
  const selectedId = event.target.value;
  if (!selectedId) {
    currentShowtapeId = null;
    document.getElementById("tape-description").textContent =
      "Select a showtape to view its description";
    return;
  }

  currentShowtapeId = selectedId;
  const info = getShowtapeInfo(selectedId);

  if (info) {
    const tape = SHOWTAPES[selectedId];
    document.getElementById("tape-description").textContent = tape.description;
    currentPlaybackState.totalTime = tape.duration;
    updateTimeDisplay();
  }
}

/**
 * Play the selected showtape
 */
function playShowtape() {
  if (!currentShowtapeId) {
    updateSignalMonitor("Please select a showtape first.");
    return;
  }

  if (currentPlaybackState.isPlaying) {
    resumeShowtape();
    return;
  }

  const tape = SHOWTAPES[currentShowtapeId];
  currentPlaybackState.isPlaying = true;
  currentPlaybackState.isPaused = false;
  currentPlaybackState.currentTime = 0;
  currentPlaybackState.totalTime = tape.duration;

  updateSignalMonitor(`Playing: ${tape.title}`);
  updateButtonStates();

  // Build playback schedule
  playbackSchedule = buildPlaybackSchedule(tape);
  playbackStartTime = Date.now();

  // Start the continuous TDM BMC stream — returns the exact context time the stream begins
  const streamStart = signalGenerator.startStream();

  // Start the WAV from offset 0 at the same audio clock moment
  startSongPlayback(0, streamStart);

  // Start playback UI loop
  playbackLoop();
}

/**
 * Build the playback schedule from a showtape
 */
function buildPlaybackSchedule(tape) {
  const schedule = [];

  tape.sequences.forEach((sequence) => {
    schedule.push({
      time: sequence.time,
      data: sequence.data,
      character: sequence.character,
      movement: sequence.movement,
      movement_display: sequence.movement_display,
      executed: false,
    });
  });

  // Sort by time
  schedule.sort((a, b) => a.time - b.time);
  return schedule;
}

/**
 * Main playback loop
 */
function playbackLoop() {
  if (!currentPlaybackState.isPlaying) {
    return;
  }

  const elapsed =
    (Date.now() - playbackStartTime) * currentPlaybackState.playbackSpeed;
  currentPlaybackState.currentTime = elapsed;

  // Execute scheduled commands
  playbackSchedule.forEach((cmd) => {
    if (!cmd.executed && elapsed >= cmd.time) {
      // Update this character's slot in the TDM frame — picked up on the next frame
      if (cmd.character && cmd.character !== "All") {
        signalGenerator.setCharacterState(cmd.character, cmd.data);
      }
      cmd.executed = true;

      // Show what's playing
      const byteStr = Array.from(cmd.data)
        .map((b) => "0x" + b.toString(16).toUpperCase())
        .join(" ");

      // Display character movement information
      if (cmd.character && cmd.movement_display) {
        const displayText = `[${cmd.character}] ${cmd.movement_display}`;

        // Route to appropriate character monitor if not "All"
        if (cmd.character !== "All") {
          const monitorId = getMonitorIdForCharacter(cmd.character);
          if (monitorId) {
            updateCharacterMonitorById(monitorId, displayText);
          }
        }

        updateSignalMonitor(displayText);
      } else {
        // Fallback for raw bytes
        if (cmd.data.length > 1) {
          const secondByte = cmd.data[1];
          const channel = (secondByte >> 6) & 0x03; // Upper 2 bits are channel
          if (channel > 0 && channel <= 4) {
            updateCharacterMonitor(channel, `Signal: ${byteStr}`);
          }
        }
        updateSignalMonitor(`Bytes: ${byteStr}`);
      }
    }
  });

  // Update progress bar
  const progress =
    (currentPlaybackState.currentTime / currentPlaybackState.totalTime) * 100;
  document.getElementById("progress-bar").value = Math.min(progress, 100);
  updateTimeDisplay();

  // Check for end of playback
  if (currentPlaybackState.currentTime >= currentPlaybackState.totalTime) {
    stopShowtape();
    return;
  }

  requestAnimationFrame(playbackLoop);
}

/**
 * Pause the showtape
 */
function pauseShowtape() {
  if (!currentPlaybackState.isPlaying) return;

  currentPlaybackState.isPlaying = false;
  currentPlaybackState.isPaused = true;

  // Halt the TDM stream and song together
  signalGenerator.stopStream();
  stopSongPlayback();

  updateSignalMonitor("Paused");
  updateButtonStates();
}

/**
 * Resume the showtape
 */
function resumeShowtape() {
  if (!currentPlaybackState.isPaused) return;

  const tape = SHOWTAPES[currentShowtapeId];
  currentPlaybackState.isPlaying = true;
  currentPlaybackState.isPaused = false;

  // Adjust start time to account for pause
  playbackStartTime =
    Date.now() -
    currentPlaybackState.currentTime / currentPlaybackState.playbackSpeed;

  // Restart TDM stream and song from the same offset
  const streamStart = signalGenerator.startStream();
  startSongPlayback(currentPlaybackState.currentTime, streamStart);

  updateSignalMonitor(`Resumed: ${tape.title}`);
  updateButtonStates();
  playbackLoop();
}

/**
 * Stop the showtape
 */
function stopShowtape() {
  currentPlaybackState.isPlaying = false;
  currentPlaybackState.isPaused = false;
  currentPlaybackState.currentTime = 0;

  // Stop TDM stream, song, and clear all channel slots to idle
  signalGenerator.stopStream();
  signalGenerator.clearAllCharacterStates();
  stopSongPlayback();

  document.getElementById("progress-bar").value = 0;
  updateTimeDisplay();
  updateSignalMonitor("Stopped — TDM stream idle");
  updateButtonStates();
}

/**
 * Handle speed control change
 */
function onSpeedChanged(event) {
  currentPlaybackState.playbackSpeed = parseFloat(event.target.value);

  if (currentPlaybackState.isPaused) {
    // Adjust for speed change while paused
    playbackStartTime =
      Date.now() -
      currentPlaybackState.currentTime / currentPlaybackState.playbackSpeed;
  }
}

/**
 * Handle volume control change
 */
function onVolumeChanged(event) {
  const volume = parseInt(event.target.value) / 100;
  currentPlaybackState.volume = volume;
  signalGenerator.setVolume(volume);

  document.getElementById("volume-display").textContent =
    event.target.value + "%";
}

/**
 * Handle progress bar changes
 */
function onProgressChanged(event) {
  if (!currentPlaybackState.isPaused && !currentPlaybackState.isPlaying) return;

  const newProgress = parseInt(event.target.value);
  currentPlaybackState.currentTime =
    (newProgress / 100) * currentPlaybackState.totalTime;

  // Reset schedule execution flags
  playbackSchedule.forEach((cmd) => {
    cmd.executed = currentPlaybackState.currentTime > cmd.time;
  });

  // Seek both the TDM stream and the song to the new position
  signalGenerator.stopStream();
  stopSongPlayback();

  if (currentPlaybackState.isPlaying || currentPlaybackState.isPaused) {
    playbackStartTime =
      Date.now() -
      currentPlaybackState.currentTime / currentPlaybackState.playbackSpeed;
  }

  if (currentPlaybackState.isPlaying) {
    const streamStart = signalGenerator.startStream();
    startSongPlayback(currentPlaybackState.currentTime, streamStart);
  }

  updateTimeDisplay();
}

// ─────────────────────────────────────────────────────────────────────────
// WAV Song Sync
// ─────────────────────────────────────────────────────────────────────────

/**
 * Decode and store the user's WAV file.
 * The AudioContext from signalGenerator is shared so both the BMC stream
 * and the song are driven by the same audio clock.
 */
async function loadWAVFile(file) {
  const statusEl = document.getElementById("song-status");
  statusEl.textContent = "Loading…";
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ac = signalGenerator.audioContext;
    if (ac.state === "suspended") await ac.resume();
    songBuffer = await ac.decodeAudioData(arrayBuffer);
    const dur = formatTime(songBuffer.duration * 1000);
    statusEl.textContent = `✓ ${file.name}  (${dur})`;
    // If this is the RFE Come Together show, snap the total time to the song length
    if (currentShowtapeId === "come-together-rfe") {
      currentPlaybackState.totalTime = Math.round(songBuffer.duration * 1000);
      updateTimeDisplay();
    }
  } catch (err) {
    statusEl.textContent = `✗ Failed to decode: ${err.message}`;
  }
}

/**
 * Start playing the loaded WAV, beginning at `offsetMs` into the song,
 * scheduled to fire at `atContextTime` in the AudioContext clock.
 * This guarantees the song and TDM BMC stream start at the identical sample.
 */
function startSongPlayback(offsetMs, atContextTime) {
  if (!songBuffer) return;
  stopSongPlayback(); // discard any previous source

  const ac = signalGenerator.audioContext;
  songGainNode = ac.createGain();
  songGainNode.gain.setValueAtTime(currentPlaybackState.volume, ac.currentTime);
  songGainNode.connect(ac.destination);

  songSource = ac.createBufferSource();
  songSource.buffer = songBuffer;
  songSource.connect(songGainNode);

  const offsetSec = Math.max(0, offsetMs / 1000);
  songSource.start(atContextTime, offsetSec);

  songSource.onended = () => {
    // Song finished naturally — stop the show
    if (currentPlaybackState.isPlaying) stopShowtape();
  };
}

/** Stop (and discard) the current song AudioBufferSourceNode. */
function stopSongPlayback() {
  if (songSource) {
    try {
      songSource.stop(0);
    } catch (_) {}
    songSource.disconnect();
    songSource = null;
  }
  if (songGainNode) {
    songGainNode.disconnect();
    songGainNode = null;
  }
}

/**
 * Play a manual signal from the signal generator
 */
function playManualSignal(channel) {
  const selectId = `ch${channel}-select`;
  const select = document.getElementById(selectId);
  const commandType = select.value;

  if (commandType === "none") {
    updateSignalMonitor("Select a command first");
    return;
  }

  // Generate different byte patterns for different command types
  let dataBytes;
  const speed =
    parseInt(document.getElementById("signal-duration").value) & 0xff;

  switch (commandType) {
    case "move":
      dataBytes = new Uint8Array([0x00, (channel << 6) | 0x20 | (speed >> 3)]);
      break;
    case "rotate":
      dataBytes = new Uint8Array([0x00, (channel << 6) | 0x10 | (speed >> 3)]);
      break;
    case "pulse":
      dataBytes = new Uint8Array([0xaa, 0x55, (channel << 6) | (speed >> 3)]);
      break;
    case "sweep":
      dataBytes = new Uint8Array([0x55, 0xaa, (channel << 6) | (speed >> 3)]);
      break;
    default:
      dataBytes = new Uint8Array([0x00, 0x00]);
  }

  signalGenerator.playBMCSignal(dataBytes, currentPlaybackState.volume);

  const byteStr = Array.from(dataBytes)
    .map((b) => "0x" + b.toString(16).toUpperCase())
    .join(" ");

  // Update character-specific monitor
  updateCharacterMonitor(channel, `${commandType.toUpperCase()}: ${byteStr}`);

  updateSignalMonitor(`Manual Ch${channel} [${commandType}]: ${byteStr}`);
}

/**
 * Update the signal monitor display
 */
function updateSignalMonitor(message) {
  const monitor = document.getElementById("signal-monitor");
  const timestamp = new Date().toLocaleTimeString();

  const logEntry = document.createElement("p");
  logEntry.textContent = `[${timestamp}] ${message}`;

  // Keep only last 5 messages
  while (monitor.children.length >= 5) {
    monitor.removeChild(monitor.firstChild);
  }

  monitor.appendChild(logEntry);
}

/**
 * Update time display
 */
function updateTimeDisplay() {
  const current = formatTime(currentPlaybackState.currentTime);
  const total = formatTime(currentPlaybackState.totalTime);
  document.getElementById("time-display").textContent = `${current} / ${total}`;
}

/**
 * Format milliseconds to MM:SS
 */
function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 60000) % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Update button states based on playback state
 */
function updateButtonStates() {
  const playBtn = document.getElementById("play-btn");
  const pauseBtn = document.getElementById("pause-btn");

  if (currentPlaybackState.isPlaying) {
    playBtn.textContent = "⏸ Pause";
    playBtn.className = "btn btn-primary";
    pauseBtn.style.display = "none";
  } else {
    playBtn.textContent = "▶ Play";
    playBtn.className = "btn btn-primary";
    pauseBtn.style.display = "inline-block";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Custom Show Builder — localStorage persistence + beat detection + choreography
// ─────────────────────────────────────────────────────────────────────────

/**
 * On startup: inject any localStorage-persisted custom tapes into SHOWTAPES
 * so they appear in the player dropdown immediately.
 */
function loadCustomShowtapes() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(CUSTOM_SHOWS_KEY) || "[]");
  } catch (_) {
    stored = [];
  }
  stored.forEach((tape) => {
    const sequences = tape.sequences.map((s) => ({
      ...s,
      data: new Uint8Array(s.data),
    }));
    SHOWTAPES[tape.id] = { ...tape, sequences };
  });
  renderCustomShowList();
}

/**
 * Serialize a tape and write it to localStorage, then refresh the UI.
 * Uint8Arrays are converted to plain arrays for JSON compatibility.
 */
function saveCustomShowtape(tape) {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(CUSTOM_SHOWS_KEY) || "[]");
  } catch (_) {
    stored = [];
  }
  const serializable = {
    ...tape,
    sequences: tape.sequences.map((s) => ({ ...s, data: Array.from(s.data) })),
  };
  stored.push(serializable);
  try {
    localStorage.setItem(CUSTOM_SHOWS_KEY, JSON.stringify(stored));
  } catch (e) {
    // Quota exceeded — tape lives in-memory for this session only
    console.warn("localStorage quota exceeded:", e.message);
  }
  SHOWTAPES[tape.id] = tape;
  updateShowtapeList();
  renderCustomShowList();
}

/**
 * Remove a custom tape from localStorage, SHOWTAPES, and the player dropdown.
 */
function deleteCustomShowtape(id) {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(CUSTOM_SHOWS_KEY) || "[]");
  } catch (_) {
    stored = [];
  }
  stored = stored.filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_SHOWS_KEY, JSON.stringify(stored));
  delete SHOWTAPES[id];

  if (currentShowtapeId === id) {
    stopShowtape();
    currentShowtapeId = null;
    document.getElementById("showtape-select").value = "";
    document.getElementById("tape-description").textContent =
      "Select a showtape to view its description";
  }
  updateShowtapeList();
  renderCustomShowList();
}

/**
 * Re-render the saved shows list inside the builder panel.
 */
function renderCustomShowList() {
  const container = document.getElementById("custom-show-list");
  const header = document.getElementById("saved-shows-header");
  if (!container) return;

  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(CUSTOM_SHOWS_KEY) || "[]");
  } catch (_) {
    stored = [];
  }

  if (stored.length === 0) {
    if (header) header.style.display = "none";
    container.innerHTML = "";
    return;
  }

  if (header) header.style.display = "block";
  container.innerHTML = stored
    .map(
      (tape) => `
    <div class="custom-show-item" data-id="${tape.id}">
      <div class="custom-show-info">
        <span class="custom-show-title">${tape.title}</span>
        <span class="custom-show-meta">
          ${tape.band === "rock" ? "🔥 Rock Afire" : "🎸 MMBB"}
          &middot; ${formatTime(tape.duration)}
          &middot; ~${tape.bpm || "?"} BPM
          &middot; ${tape.sequences.length} cues
        </span>
      </div>
      <div class="custom-show-actions">
        <button class="btn btn-sm" onclick="selectAndPlayCustomShow('${tape.id}')">&#9654; Play</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCustomShowtape('${tape.id}')">&#10005; Delete</button>
      </div>
    </div>`,
    )
    .join("");
}

/**
 * Select a custom show in the player, switch band if needed, and play.
 */
function selectAndPlayCustomShow(id) {
  const tape = SHOWTAPES[id];
  if (!tape) return;

  if (tape.band !== currentBand) {
    currentBand = tape.band;
    const bandSelect = document.getElementById("band-select");
    if (bandSelect) bandSelect.value = currentBand;
    document.getElementById("band-title").textContent =
      `${BAND_CONFIG[currentBand].title} - Signal Monitors`;
    document.getElementById("munch-band").style.display =
      currentBand === "munch" ? "grid" : "none";
    document.getElementById("rock-band").style.display =
      currentBand === "rock" ? "grid" : "none";
    clearAllMonitors();
    setupCurrentBandSlots();
  }

  const select = document.getElementById("showtape-select");
  select.value = id;
  select.dispatchEvent(new Event("change"));
  playShowtape();
}

// ─── Beat Detection ───────────────────────────────────────────────────────────────────

/**
 * Vocal-band onset detector.
 *
 * Strategy: separate the audio into two frequency bands using a simple
 * one-pole IIR filter pair, then run the same energy-comparative onset
 * detector on the HIGH band only (approx 800 Hz–8 kHz) — the range where
 * consonants, vowel formants, and voice attack transients live.  The LOW
 * band (kick, bass) is subtracted to avoid beat-hits masking vocal onsets.
 *
 * Returns onset times in ms.  These become jaw-open cues for the frontman.
 *
 * @param   {AudioBuffer} audioBuffer
 * @param   {number}      bpm   used to set the minimum gap (≤ half a beat)
 * @returns {number[]}          Vocal onset times in ms
 */
function analyzeVocalOnsets(audioBuffer, bpm) {
  const sr = audioBuffer.sampleRate;
  const numCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;

  // Mix to mono
  const mono = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const d = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / numCh;
  }

  // ── One-pole IIR high-pass (≈800 Hz) ──────────────────────────────────
  // y[n] = α * (y[n-1] + x[n] - x[n-1])  where α = RC/(RC+dt)
  const RC_HP = 1 / (2 * Math.PI * 800);
  const dt = 1 / sr;
  const alphaHP = RC_HP / (RC_HP + dt);
  const hi = new Float32Array(len);
  hi[0] = mono[0];
  for (let i = 1; i < len; i++)
    hi[i] = alphaHP * (hi[i - 1] + mono[i] - mono[i - 1]);

  // ── One-pole IIR low-pass (≈200 Hz) — the kick/bass band ──────────────
  const RC_LP = 1 / (2 * Math.PI * 200);
  const alphaLP = dt / (RC_LP + dt);
  const lo = new Float32Array(len);
  lo[0] = mono[0];
  for (let i = 1; i < len; i++)
    lo[i] = lo[i - 1] + alphaLP * (mono[i] - lo[i - 1]);

  // ── Short-time energy per frame (~10.7 ms) ─────────────────────────────
  const FRAME = 512;
  const nFrames = Math.floor(len / FRAME);
  const hiEnergy = new Float32Array(nFrames);
  const loEnergy = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let sh = 0,
      sl = 0;
    const off = f * FRAME;
    for (let i = 0; i < FRAME; i++) {
      sh += hi[off + i] ** 2;
      sl += lo[off + i] ** 2;
    }
    hiEnergy[f] = sh / FRAME;
    loEnergy[f] = sl / FRAME;
  }

  // ── Prefix sums for O(1) rolling average ──────────────────────────────
  const cumHi = new Float64Array(nFrames + 1);
  for (let f = 0; f < nFrames; f++) cumHi[f + 1] = cumHi[f] + hiEnergy[f];

  // Rolling window: ±120 ms each side
  const HALF = Math.round((0.12 * sr) / FRAME);
  // Minimum gap: half a beat (so we can catch every syllable)
  const beatMs = bpm > 0 ? 60000 / bpm : 500;
  const MIN_GAP = Math.max(
    Math.round((0.08 * sr) / FRAME), // never less than 80 ms
    Math.round((((beatMs * 0.45) / 1000) * sr) / FRAME),
  );
  // Vocal onsets need to exceed their local background by this factor.
  // Lower than the beat detector (1.5) — vocals are softer than transients.
  const THRESHOLD = 1.25;
  // How much louder lo must be vs hi for us to consider this a bass hit
  // and suppress it as a vocal onset
  const BASS_SUPPRESS = 3.0;

  const onsets = [];
  let lastOnset = -MIN_GAP;

  for (let f = 1; f < nFrames - 1; f++) {
    if (f - lastOnset < MIN_GAP) continue;

    // Skip frames dominated by bass/kick
    if (loEnergy[f] > hiEnergy[f] * BASS_SUPPRESS) continue;

    const lo2 = Math.max(0, f - HALF);
    const hi2 = Math.min(nFrames, f + HALF);
    const localAvg = (cumHi[hi2] - cumHi[lo2]) / (hi2 - lo2);

    if (
      hiEnergy[f] > THRESHOLD * localAvg &&
      hiEnergy[f] >= hiEnergy[f - 1] &&
      hiEnergy[f] >= hiEnergy[f + 1]
    ) {
      onsets.push(Math.round((f * FRAME * 1000) / sr));
      lastOnset = f;
    }
  }
  return onsets;
}

/**
 * Energy-comparative onset detector.
 * Mixes to mono → computes short-time RMS energy per frame →
 * marks beats where frame energy significantly exceeds its local average.
 *
 * @param   {AudioBuffer} audioBuffer
 * @returns {number[]}    Beat onset times in milliseconds
 */
function analyzeBeats(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const numCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;

  // Mix all channels to mono
  const mono = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += chData[i] / numCh;
  }

  // Short-time RMS energy per frame (~10.7 ms at 48 kHz)
  const FRAME = 512;
  const nFrames = Math.floor(len / FRAME);
  const energy = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let s = 0;
    const off = f * FRAME;
    for (let i = 0; i < FRAME; i++) s += mono[off + i] ** 2;
    energy[f] = s / FRAME;
  }

  // Prefix sums — enables O(1) rolling-average queries
  const cumsum = new Float64Array(nFrames + 1);
  for (let f = 0; f < nFrames; f++) cumsum[f + 1] = cumsum[f] + energy[f];

  // Rolling average window: ±HALF frames (≈200 ms each side → ≈400 ms total)
  const HALF = Math.round((0.2 * sr) / FRAME);
  // Minimum gap between beats: ≈280 ms (≈214 BPM maximum)
  const MIN_GAP = Math.round((0.28 * sr) / FRAME);
  // Energy must exceed this multiple of the local average to count as a beat
  const THRESHOLD = 1.5;

  const beats = [];
  let lastBeat = -MIN_GAP;

  for (let f = 1; f < nFrames - 1; f++) {
    if (f - lastBeat < MIN_GAP) continue;
    const lo = Math.max(0, f - HALF);
    const hi = Math.min(nFrames, f + HALF);
    const localAvg = (cumsum[hi] - cumsum[lo]) / (hi - lo);
    if (
      energy[f] > THRESHOLD * localAvg &&
      energy[f] >= energy[f - 1] &&
      energy[f] >= energy[f + 1]
    ) {
      beats.push(Math.round((f * FRAME * 1000) / sr));
      lastBeat = f;
    }
  }
  return beats;
}

/**
 * Estimate BPM from an array of beat onset times using median inter-beat interval.
 * Median is used instead of mean for robustness against detection outliers.
 */
function estimateBPM(beatTimes) {
  if (beatTimes.length < 2) return 120;
  const intervals = [];
  for (let i = 1; i < beatTimes.length; i++)
    intervals.push(beatTimes[i] - beatTimes[i - 1]);
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  return Math.min(240, Math.max(40, Math.round(60000 / median)));
}

/**
 * Generate character movement cues aligned to detected beat and vocal onsets.
 *
 * Beat-assignment rules (body movements):
 *   Every beat     — rotate through non-frontman characters
 *   Every 2nd beat — half-beat accent for the next character
 *   Every 4th beat — frontman body accent (not mouth — mouth is separate)
 *   Every 8th beat — percussionist phrase accent
 *
 * Jaw-assignment rules (mouth movements — frontman only):
 *   One mouth-OPEN  cue at each detected vocal onset
 *   One mouth-CLOSE cue ~80 ms later (simulates jaw returning)
 *   Cues are deduplicated and filtered so they don't collide with
 *   an existing mouth cue within 60 ms.
 */
function generateCustomSequences(beatTimes, band, vocalOnsets = []) {
  const characters = BAND_CHARACTERS[band] || [];
  if (characters.length === 0) return [];

  const frontman = band === "rock" ? "Rolfe" : "Chuck E. Cheese";
  const drummer = band === "rock" ? "Dook LaRue" : "Pasqually";
  // All characters except the frontman for body-movement rotation
  const backingChars = characters.filter((c) => c !== frontman);

  const sequences = [];

  // ── Body movements on beat grid ─────────────────────────────────────────
  beatTimes.forEach((beatMs, i) => {
    const charIdx = i % backingChars.length;
    const char = backingChars[charIdx] || characters[i % characters.length];
    const pattern = MOVEMENT_PATTERNS[char];
    if (!pattern || pattern.length === 0) return;

    // Primary movement on the beat — but never mouth (jaw is vocal-driven)
    const nonMouthPattern = pattern.filter((m) => m !== "mouth");
    const move =
      nonMouthPattern[i % nonMouthPattern.length] ||
      pattern[i % pattern.length];
    if (move !== "mouth") addMovement(sequences, beatMs, char, move);

    // Half-beat accent
    if (i % 2 === 1) {
      const nextBeat = beatTimes[i + 1];
      if (!nextBeat || nextBeat - beatMs > 200) {
        const aChar = backingChars[(charIdx + 1) % backingChars.length];
        const aPat = (MOVEMENT_PATTERNS[aChar] || []).filter(
          (m) => m !== "mouth",
        );
        if (aPat.length)
          addMovement(
            sequences,
            beatMs + 60,
            aChar,
            aPat[(i + 2) % aPat.length],
          );
      }
    }

    // Every 4th beat: frontman body accent (head / arm / body — not mouth)
    if (i % 4 === 0 && characters.includes(frontman)) {
      const fp = (MOVEMENT_PATTERNS[frontman] || []).filter(
        (m) => m !== "mouth",
      );
      if (fp.length)
        addMovement(
          sequences,
          beatMs + 20,
          frontman,
          fp[Math.floor(i / 4) % fp.length],
        );
    }

    // Every 8th beat: percussionist phrase accent
    if (i % 8 === 0 && characters.includes(drummer)) {
      const dp = MOVEMENT_PATTERNS[drummer] || [];
      if (dp.length)
        addMovement(
          sequences,
          beatMs,
          drummer,
          dp[Math.floor(i / 8) % dp.length],
        );
    }
  });

  // ── Jaw (mouth) cues driven by vocal onsets ─────────────────────────────
  // Each onset → open jaw; 80 ms later → close (if within song duration)
  const JAW_CLOSE_DELAY = 80; // ms — short syllable close
  const JAW_MIN_GAP = 60; // ms — don't stack two opens within this window
  const songEnd = beatTimes.length
    ? beatTimes[beatTimes.length - 1] + 2000
    : Infinity;

  // Build a quick lookup set of already-scheduled mouth times
  const mouthTimes = new Set();

  const addJaw = (t) => {
    // Skip if too close to a previous mouth cue
    for (const mt of mouthTimes) if (Math.abs(mt - t) < JAW_MIN_GAP) return;
    addMovement(sequences, t, frontman, "mouth");
    mouthTimes.add(t);
  };

  if (vocalOnsets.length > 0) {
    vocalOnsets.forEach((onsetMs) => {
      if (onsetMs > songEnd) return;
      addJaw(onsetMs); // open
      addJaw(Math.round(onsetMs + JAW_CLOSE_DELAY)); // close
    });
  } else {
    // Fallback when no vocal onsets detected: fire mouth every half-beat
    // for the frontman (same as old behaviour, but filtered to frontman only)
    if (beatTimes.length >= 2) {
      const avgBeat =
        (beatTimes[beatTimes.length - 1] - beatTimes[0]) /
        (beatTimes.length - 1);
      const halfBeat = avgBeat / 2;
      for (let t = beatTimes[0]; t <= songEnd; t += halfBeat) {
        addJaw(Math.round(t));
        addJaw(Math.round(t + JAW_CLOSE_DELAY));
      }
    }
  }

  sequences.sort((a, b) => a.time - b.time);
  return sequences;
}

/**
 * Full custom show build pipeline:
 *   1. Decode audio via Web Audio API
 *   2. Run beat detection + BPM estimation
 *   3. Generate choreography sequences
 *   4. Persist to localStorage
 *   5. Auto-select the tape in the main player and cache the decoded buffer
 *      so playback syncs the song immediately (no re-upload needed this session)
 */
async function buildCustomShowtape(file, title, band) {
  const statusEl = document.getElementById("generate-status");
  const btn = document.getElementById("generate-show-btn");
  btn.disabled = true;
  statusEl.style.color = "";
  statusEl.textContent = "Decoding audio…";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ac = signalGenerator.audioContext;
    if (ac.state === "suspended") await ac.resume();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    const durationMs = Math.round(audioBuffer.duration * 1000);

    statusEl.textContent = "Detecting beats…";
    await new Promise((r) => setTimeout(r, 20)); // yield to browser

    const beatTimes = analyzeBeats(audioBuffer);
    if (beatTimes.length < 4) {
      throw new Error(
        "Too few beats detected — try a more rhythmic track or check the file has audio content.",
      );
    }

    const bpm = estimateBPM(beatTimes);

    statusEl.textContent = `Found ${beatTimes.length} beats (~${bpm} BPM). Detecting vocals…`;
    await new Promise((r) => setTimeout(r, 20));

    const vocalOnsets = analyzeVocalOnsets(audioBuffer, bpm);

    statusEl.textContent = `Found ${vocalOnsets.length} vocal onsets. Building choreography…`;
    await new Promise((r) => setTimeout(r, 20));

    const sequences = generateCustomSequences(beatTimes, band, vocalOnsets);
    const id = `custom-${Date.now()}`;
    const bandLabel =
      band === "rock" ? "Rock Afire Explosion" : "Munch's Make Believe Band";

    const tape = {
      id,
      title,
      description: `Custom show generated from \u201c${file.name}\u201d. Detected ~${bpm} BPM, ${beatTimes.length} beats, ${vocalOnsets.length} vocal onsets. ${sequences.length} choreography cues for ${bandLabel}.`,
      duration: durationMs,
      bitrate: 600,
      band,
      bpm,
      isCustom: true,
      sequences,
    };

    saveCustomShowtape(tape);

    // Cache decoded audio so the player syncs it immediately this session
    songBuffer = audioBuffer;
    document.getElementById("song-status").textContent =
      `\u2713 ${file.name}  (${formatTime(durationMs)})`;

    // Auto-select the new tape in the player
    currentShowtapeId = id;
    const select = document.getElementById("showtape-select");
    select.value = id;
    currentPlaybackState.totalTime = durationMs;
    document.getElementById("tape-description").textContent = tape.description;
    updateTimeDisplay();

    statusEl.style.color = "#0f8";
    statusEl.textContent = `\u2713 \u201c${title}\u201d saved! ${sequences.length} cues \u00b7 ${formatTime(durationMs)} \u00b7 ~${bpm} BPM`;
  } catch (err) {
    statusEl.style.color = "#f44";
    statusEl.textContent = `\u2717 ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}
