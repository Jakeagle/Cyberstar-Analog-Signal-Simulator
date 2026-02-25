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

// ── v2: LED grid visual-latch state ────────────────────────────────────────
const LED_LATCH_MS = 90; // ms to hold LED lit after slot clears
const ledLastActive = new Array(8).fill(0); // timestamp of last activation per slot
const ledLastByte = new Uint8Array(8); // last non-zero byte seen per slot

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  const introOverlay = document.getElementById("intro-overlay");
  const introVideo = document.getElementById("intro-video");
  const introPrompt = document.getElementById("intro-prompt");
  const skipIntro = document.getElementById("skip-intro");

  function startAppTransition() {
    if (introOverlay.classList.contains("intro-hidden")) return;

    introOverlay.classList.add("intro-hidden");
    document.body.classList.add("app-ready");

    // Pause video to ensure audio doesn't keep playing
    introVideo.pause();

    // Trigger staggered reveal of app sections
    const reveals = document.querySelectorAll(".reveal-stagger");
    reveals.forEach((el, index) => {
      setTimeout(
        () => {
          el.classList.add("reveal-visible");
        },
        150 + index * 120,
      ); // 120ms staggered delay
    });

    // Cleanup after transition
    setTimeout(() => {
      introOverlay.style.display = "none";
    }, 1000);
  }

  function startIntro() {
    if (introVideo.paused) {
      introVideo
        .play()
        .then(() => {
          introPrompt.style.opacity = "0";
          setTimeout(() => {
            introPrompt.style.display = "none";
            skipIntro.style.display = "block";
          }, 300);
          introVideo.classList.add("video-playing");
        })
        .catch((err) => {
          console.log("Video play blocked:", err);
        });
    } else {
      // If already playing, a click skips
      startAppTransition();
    }
  }

  // Auto-transition when video ends
  introVideo.addEventListener("ended", startAppTransition);

  // Initial interaction starts video (with audio), second interaction skips
  introOverlay.addEventListener("click", startIntro);

  setupEventListeners();
  loadCustomShowtapes(); // populates SHOWTAPES before the dropdown is built
  updateShowtapeList();

  // Set initial band title
  const bandConfig = BAND_CONFIG[currentBand];
  document.getElementById("band-title").textContent =
    `${bandConfig.title} - Signal Monitors`;

  // Configure the TDM stream slot assignments for the initial band
  setupCurrentBandSlots(); // also calls buildLEDGrid()

  // Frame Sync Indicator logic
  const syncLed = document.getElementById("sync-led");
  signalGenerator.onFrameSync = () => {
    if (!syncLed) return;
    syncLed.classList.add("active");
    setTimeout(() => syncLed.classList.remove("active"), 15);
  };

  // Poll the LED grid at ~25 fps even when no show is playing (covers manual sends)
  setInterval(updateLEDGrid, 40);

  updateSignalMonitor("System initialized. TDM stream ready.");
});

/**
 * Tell the signal generator which characters occupy which TDM slots
 * for the currently active band.
 */
function setupCurrentBandSlots() {
  // Clear the tracks before starting a new band's show
  signalGenerator.clearAllCharacterStates();
  buildLEDGrid(); // refresh labels with the new dual 96-bit tracks
}

// ─────────────────────────────────────────────────────────────────────────────
// v2 — TDM Frame Monitor: Dual 96-bit (12-byte) LED bit-grids
// Based on Official RFE Specification (TD and BD tracks)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build (or rebuild) the LED grid DOM. Now creates TWO grids for TD and BD.
 */
function buildLEDGrid() {
  const container = document.getElementById("led-grid");
  if (!container) return;
  container.innerHTML = "";

  // Create TD Grid
  const tdContainer = document.createElement("div");
  tdContainer.className = "track-monitor";
  tdContainer.innerHTML = "<h4>TRACK TD (Left / Treble)</h4>";
  const tdGrid = document.createElement("div");
  tdGrid.id = "led-grid-td";
  tdGrid.className = "led-grid-v2";
  tdContainer.appendChild(tdGrid);
  container.appendChild(tdContainer);

  // Create BD Grid
  const bdContainer = document.createElement("div");
  bdContainer.className = "track-monitor";
  bdContainer.innerHTML = "<h4>TRACK BD (Right / Bass)</h4>";
  const bdGrid = document.createElement("div");
  bdGrid.id = "led-grid-bd";
  bdGrid.className = "led-grid-v2";
  bdContainer.appendChild(bdGrid);
  container.appendChild(bdContainer);

  const createTrack = (grid, prefix) => {
    for (let s = 0; s < 12; s++) {
      const row = document.createElement("div");
      row.className = "led-row";
      const label = document.createElement("span");
      label.className = "led-label";
      label.textContent = `Byte ${s}`;
      row.appendChild(label);
      const bits = document.createElement("div");
      bits.className = "led-bits";
      for (let b = 7; b >= 0; b--) {
        const led = document.createElement("span");
        led.className = "led";
        led.id = `led-${prefix}-${s}-${b}`;
        bits.appendChild(led);
      }
      row.appendChild(bits);
      const hex = document.createElement("span");
      hex.className = "led-hex";
      hex.id = `led-hex-${prefix}-${s}`;
      hex.textContent = "0x00";
      row.appendChild(hex);
      grid.appendChild(row);
    }
  };

  createTrack(tdGrid, "td");
  createTrack(bdGrid, "bd");
}

/**
 * Update the dual LED grids from the signal generator's 12-byte buffers.
 */
function updateLEDGrid() {
  if (!signalGenerator) return;

  const update = (buf, prefix) => {
    for (let s = 0; s < 12; s++) {
      const val = buf[s];
      const hexEl = document.getElementById(`led-hex-${prefix}-${s}`);
      if (hexEl) {
        hexEl.textContent = `0x${val.toString(16).toUpperCase().padStart(2, "0")}`;
        hexEl.style.color = val ? "#00d4ff" : "#333";
      }
      for (let b = 7; b >= 0; b--) {
        const led = document.getElementById(`led-${prefix}-${s}-${b}`);
        if (led) {
          const on = (val >> b) & 1;
          led.className = on ? "led led-on" : "led";
        }
      }
    }
  };

  update(signalGenerator.trackTD, "td");
  update(signalGenerator.trackBD, "bd");

  // Update the stage if open
  if (document.getElementById("stage-modal").style.display === "block") {
    updateStageArena();
  }
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

  // Export BMC signal as WAV
  document
    .getElementById("export-wav-btn")
    .addEventListener("click", exportSignalWAV);

  // Stage View Toggle
  document
    .getElementById("toggle-stage-btn")
    .addEventListener("click", openStageView);
  document
    .getElementById("close-stage-btn")
    .addEventListener("click", closeStageView);

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

  // If stage is open, rebuild it
  if (document.getElementById("stage-modal").style.display === "block") {
    buildStageArena();
  }

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
      cmd.executed = true;

      // Official Bitmap v2.0 Bit Addressing - Improved with Explicit State
      if (cmd.character && cmd.movement) {
        const charEntry = CHARACTER_MOVEMENTS[cmd.character];
        if (charEntry) {
          const m = charEntry.movements[cmd.movement];
          if (m) {
            // Use setBit instead of toggleBit for stability (Emergency Patch #1)
            const newState =
              typeof cmd.state !== "undefined" ? cmd.state : true;
            signalGenerator.setBit(m.track, m.bit, newState);

            // Legacy backward compatibility:
            // If movement has no 'state' (legacy JSON), pulse it OFF after 120ms
            if (typeof cmd.state === "undefined") {
              setTimeout(() => {
                signalGenerator.setBit(m.track, m.bit, false);
              }, 120);
            }
          }
        }
      }

      // Display character movement information
      if (cmd.character && cmd.movement_display) {
        const displayText = `[${cmd.character}] ${cmd.movement_display}`;

        // Route to character monitor
        const monitorId = getMonitorIdForCharacter(cmd.character);
        if (monitorId) {
          updateCharacterMonitorById(monitorId, displayText);
        }

        updateSignalMonitor(displayText);
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

  // Custom uploaded tracks are typically quieter than mastered showtape music,
  // so boost them. Pre-made showtapes play at the configured volume unchanged.
  const isCustom = !!(
    SHOWTAPES[currentShowtapeId] && SHOWTAPES[currentShowtapeId].isCustom
  );
  const CUSTOM_BOOST = 2.5; // multiplier for uploaded WAV files
  const gain = isCustom
    ? Math.min(2.0, currentPlaybackState.volume * CUSTOM_BOOST)
    : currentPlaybackState.volume;

  songGainNode.gain.setValueAtTime(gain, ac.currentTime);
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
    const sequences = tape.sequences.map((s) => {
      const copy = { ...s };
      if (s.data) {
        copy.data = new Uint8Array(s.data);
      }
      return copy;
    });
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
    sequences: tape.sequences.map((s) => {
      const copy = { ...s };
      if (s.data instanceof Uint8Array) {
        copy.data = Array.from(s.data);
      }
      return copy;
    }),
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
 * Vocal-band onset detector — v2 Hysteresis Edition.
 *
 * Uses a TWO-threshold state machine instead of a single trigger level:
 *   T1 (1.4×) — upper threshold: jaw OPENS only when energy exceeds this
 *   T2 (0.85×) — lower threshold: jaw CLOSES only when energy drops below this
 * The gap between T1 and T2 provides hysteresis, preventing stutter on
 * soft consonants and micro-pauses between syllables.
 *
 * Additional features:
 *   • Minimum hold (MIN_HOLD_FRAMES ≈ 80 ms): once open, jaw cannot close
 *     sooner — simulates mechanical inertia.
 *   • Anti-lock (MAX_CLOSED_FRAMES ≈ 400 ms): if the jaw has been closed for
 *     too long while vocal energy is still present (held vowels, falsetto),
 *     a re-open pulse is forced to keep the character looking alive.
 *   • Bass suppression: frames dominated by kick/bass are ignored.
 *
 * Returns jaw-OPEN event times in ms (one entry per open transition).
 *
 * @param   {AudioBuffer} audioBuffer
 * @param   {number}      bpm   used to set minimum hold proportional to tempo
 * @returns {number[]}          Jaw-open onset times in ms
 */

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

/**
 * Frequency-specific onset analysis (Emergency Patch #3)
 * Splits audio into three bins for character mapping.
 */
function analyzeFrequencyBins(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const mono = new Float32Array(len);

  // Mixdown
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const d = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++)
      mono[i] += d[i] / audioBuffer.numberOfChannels;
  }

  // Filter creation helpers
  const createHP = (freq) => {
    const rc = 1 / (2 * Math.PI * freq);
    const alpha = rc / (rc + 1 / sr);
    const out = new Float32Array(len);
    for (let i = 1; i < len; i++)
      out[i] = alpha * (out[i - 1] + mono[i] - mono[i - 1]);
    return out;
  };

  const createLP = (freq) => {
    const rc = 1 / (2 * Math.PI * freq);
    const alpha = 1 / sr / (rc + 1 / sr);
    const out = new Float32Array(len);
    for (let i = 1; i < len; i++)
      out[i] = out[i - 1] + alpha * (mono[i] - out[i - 1]);
    return out;
  };

  // 1. Treble Bin (800Hz+) - Vocals
  const treble = createHP(800);
  // 2. Bass Bin (40-150Hz) - Kick
  const bass = createLP(150);
  // 3. Mid Bin (200-800Hz) - Snare/Instruments
  const midRaw = createHP(200);
  const mid = new Float32Array(len); // Logic for BP 200-800
  const rcMid = 1 / (2 * Math.PI * 800);
  const alphaMid = 1 / sr / (rcMid + 1 / sr);
  for (let i = 1; i < len; i++)
    mid[i] = mid[i - 1] + alphaMid * (midRaw[i] - mid[i - 1]);

  const extractOnsets = (buffer, thresholdMult = 2.5) => {
    const FRAME = 512;
    const nFrames = Math.floor(len / FRAME);
    const energy = new Float32Array(nFrames);
    for (let f = 0; f < nFrames; f++) {
      let sum = 0;
      for (let i = 0; i < FRAME; i++) sum += buffer[f * FRAME + i] ** 2;
      energy[f] = sum / FRAME;
    }

    // Simple onset detection
    const onsets = [];
    const avgEnergy = energy.reduce((a, b) => a + b) / nFrames;
    const thresh = avgEnergy * thresholdMult;

    for (let f = 1; f < nFrames; f++) {
      if (energy[f] > thresh && energy[f] > energy[f - 1]) {
        onsets.push(Math.round((f * FRAME * 1000) / sr));
      }
    }
    return onsets;
  };

  return {
    treble: extractOnsets(treble, 3.0),
    bass: extractOnsets(bass, 1.5),
    mid: extractOnsets(mid, 2.0),
  };
}

/**
 * Enhanced Sequence Generation (Emergency Patch #3)
 */
function generateEnhancedSequences(beatTimes, band, binnedOnsets) {
  const characters = BAND_CHARACTERS[band] || [];
  const frontman = band === "rock" ? "Rolfe" : "Chuck E. Cheese";
  const drummer = band === "rock" ? "Dook LaRue" : "Pasqually";
  const backing = characters.filter((c) => c !== frontman && c !== drummer);

  const sequences = [];
  const addMove = (t, char, move, state = true) => {
    sequences.push({
      time: Math.max(0, Math.round(t)),
      character: char,
      movement: move,
      state: state,
    });
  };

  // 1. Treble -> Frontman Mouth
  binnedOnsets.treble.forEach((t, i) => {
    addMove(t, frontman, "mouth", true);
    const next = binnedOnsets.treble[i + 1] || t + 400;
    const hold = Math.max(80, Math.min(300, (next - t) * 0.6));
    addMove(t + hold, frontman, "mouth", false);
  });

  // 2. Bass -> Drummer & General Body
  binnedOnsets.bass.forEach((t) => {
    // Drummer kick
    const drumMove = band === "rock" ? "bass_drum" : "foot_tap";
    addMove(t, drummer, drumMove, true);
    addMove(t + 100, drummer, drumMove, false);

    // Random body lean for everyone else
    const luckyChar = backing[Math.floor(Math.random() * backing.length)];
    if (luckyChar) {
      addMove(t, luckyChar, "body_lean", true);
      addMove(t + 250, luckyChar, "body_lean", false);
    }
  });

  // 3. Mid -> Instruments & Head
  binnedOnsets.mid.forEach((t, i) => {
    if (i % 2 === 0) {
      const perMove = band === "rock" ? "hi_hat" : "arm_left_raise";
      addMove(t, drummer, perMove, true);
      addMove(t + 80, drummer, perMove, false);
    }
    // Alternate head turns
    const char = characters[(i + Math.floor(t % 5)) % characters.length];
    const move = i % 4 === 0 ? "head_left" : i % 4 === 2 ? "head_right" : null;
    if (move && char !== frontman) {
      addMove(t, char, move, true);
      addMove(t + 300, char, move, false);
    }
  });

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

    statusEl.textContent = `Found ${beatTimes.length} beats (~${bpm} BPM). Analyzing frequency bins…`;
    await new Promise((r) => setTimeout(r, 20));

    const binnedOnsets = analyzeFrequencyBins(audioBuffer);

    statusEl.textContent = `Analyzed Treble, Mid, and Bass bins. Building choreography…`;
    await new Promise((r) => setTimeout(r, 20));

    const sequences = generateEnhancedSequences(beatTimes, band, binnedOnsets);
    const id = `custom-${Date.now()}`;
    const bandLabel =
      band === "rock" ? "Rock Afire Explosion" : "Munch's Make Believe Band";

    const tape = {
      id,
      title,
      description: `Custom show generated from \u201c${file.name}\u201d. Detected ~${bpm} BPM, ${beatTimes.length} beats, ${binnedOnsets.treble.length} vocal cues. ${sequences.length} choreography cues for ${bandLabel}.`,
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

// ─────────────────────────────────────────────────────────────────────────
// Offline BMC signal WAV export
// ─────────────────────────────────────────────────────────────────────────

/**
 * Encode a Float32Array of PCM samples into a 16-bit mono WAV Blob.
 */
function encodeWAV(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  function writeStr(off, str) {
    for (let i = 0; i < str.length; i++)
      view.setUint8(off + i, str.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Encode a stereo interleaved Float32Array (L,R,L,R,...) into a
 * 16-bit stereo WAV Blob. TD track = Left, BD track = Right.
 * This is the correct format for Cyberstar hardware playback.
 */
function encodeStereoWAV(interleavedSamples, sampleRate) {
  const numFrames = interleavedSamples.length / 2; // sample frames (L+R pairs)
  const numSamples = interleavedSamples.length; // total individual samples
  const numChannels = 2;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8); // 4 bytes
  const byteRate = sampleRate * blockAlign;
  const dataBytes = numSamples * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  function writeStr(off, str) {
    for (let i = 0; i < str.length; i++)
      view.setUint8(off + i, str.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true); // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, interleavedSamples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Offline-render the full BMC signal track for the currently selected
 * showtape and trigger a browser download of the resulting WAV file.
 *
 * Mirrors the real-time TDM stream engine exactly:
 *   - 20 fps, 11-byte TDM frames, 2400 bps BMC encoding
 *   - Each sequence fires for one frame (50 ms), then the slot auto-clears
 *   - Idle frames are rendered as silence (no background beep)
 */
async function exportSignalWAV() {
  if (!currentShowtapeId) {
    alert("Please select a showtape first.");
    return;
  }

  const tape = SHOWTAPES[currentShowtapeId];
  const btn = document.getElementById("export-wav-btn");
  const statusEl = document.getElementById("export-wav-status");
  btn.disabled = true;
  statusEl.style.color = "";
  statusEl.textContent = "Rendering…";

  try {
    // Build character → TDM slot map for this tape's band
    const bandKey = tape.band || currentBand;
    const bandCfg = BAND_CONFIG[bandKey] || BAND_CONFIG[currentBand];
    const bandChars = Object.values(bandCfg.characters).map((c) => c.name);
    const slotMap = new Map();
    bandChars.forEach((name, i) => {
      if (i < 8) slotMap.set(name, i);
    });

    // Signal constants (Match Official RFE 4800 Baud v2.0 spec)
    const SAMPLE_RATE = 48000;
    const BITRATE = 4800;
    const FRAME_RATE = 50;
    const AMPLITUDE = 0.85;
    const NOISE_LEVEL = 0.015;
    const LOWPASS_HZ = 8000;
    const VOLUME = currentPlaybackState.volume;
    const FRAME_MS = 1000 / FRAME_RATE; // 20 ms
    const bitsPerFrame = 12 * 8; // 96 bits spec
    const samplesPerBit = SAMPLE_RATE / BITRATE;
    const samplesPerFrame = Math.ceil(bitsPerFrame * samplesPerBit);
    const scale = AMPLITUDE * VOLUME;

    const durationMs = tape.duration;
    const totalFrames = Math.ceil(durationMs / FRAME_MS);

    // Inline BMC helpers (no AudioContext dependency)
    function encodeBMCBits(bytes) {
      const bits = [];
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
      }
      return bits;
    }

    function makeBMCWave(bits) {
      const w = new Float32Array(Math.ceil(bits.length * samplesPerBit));
      let level = 1;
      for (let bi = 0; bi < bits.length; bi++) {
        const start = Math.floor(bi * samplesPerBit);
        const end = Math.floor((bi + 1) * samplesPerBit);
        const mid = Math.floor(start + samplesPerBit / 2);
        if (bits[bi] === 1) {
          for (let i = start; i < mid; i++) w[i] = level;
          level *= -1;
          for (let i = mid; i < end; i++) w[i] = level;
          level *= -1;
        } else {
          for (let i = start; i < end; i++) w[i] = level;
          level *= -1;
        }
      }
      if (NOISE_LEVEL > 0) {
        for (let i = 0; i < w.length; i++) {
          w[i] += (Math.random() - 0.5) * 2 * NOISE_LEVEL;
          w[i] = Math.max(-1, Math.min(1, w[i]));
        }
      }
      return w;
    }

    function lowpass(w) {
      const rc = 1.0 / (2 * Math.PI * LOWPASS_HZ);
      const alpha = 1 / SAMPLE_RATE / (rc + 1 / SAMPLE_RATE);
      const f = new Float32Array(w.length);
      f[0] = w[0];
      for (let i = 1; i < w.length; i++)
        f[i] = f[i - 1] + alpha * (w[i] - f[i - 1]);
      return f;
    }

    // Pre-allocate dual-track bit buffers (12 bytes each = 96 bits per spec)
    const trackTD = new Uint8Array(12);
    const trackBD = new Uint8Array(12);

    // Pre-allocate output (stereo interleaved: L=TD, R=BD)
    const outL = new Float32Array(totalFrames * samplesPerFrame);
    const outR = new Float32Array(totalFrames * samplesPerFrame);
    let outOffset = 0;

    const seqs = [...tape.sequences].sort((a, b) => a.time - b.time);
    let seqIdx = 0;

    for (let f = 0; f < totalFrames; f++) {
      // Yield to browser every 200 frames to stay responsive
      if (f % 200 === 0 && f > 0) {
        statusEl.textContent = `Rendering… ${Math.round((f / totalFrames) * 100)}%`;
        await new Promise((r) => setTimeout(r, 0));
      }

      const frameStartMs = f * FRAME_MS;
      const frameEndMs = frameStartMs + FRAME_MS;

      // Apply all sequences whose time falls inside this frame window
      while (seqIdx < seqs.length && seqs[seqIdx].time < frameEndMs) {
        const seq = seqs[seqIdx++];
        if (seq.time < frameStartMs) continue;

        // NEW format: character + movement + state (bitwise)
        if (seq.character && seq.movement && typeof seq.state !== "undefined") {
          const charEntry = CHARACTER_MOVEMENTS[seq.character];
          if (charEntry) {
            const m = charEntry.movements[seq.movement];
            if (m) {
              const buf = m.track === "TD" ? trackTD : trackBD;
              const byteIdx = Math.floor(m.bit / 8);
              const bitPos = 7 - (m.bit % 8);
              if (seq.state) {
                buf[byteIdx] |= 1 << bitPos;
              } else {
                buf[byteIdx] &= ~(1 << bitPos);
              }
            }
          }
        }
        // LEGACY format: raw data bytes per slot
        else if (seq.data && seq.character && seq.character !== "All") {
          const slot = slotMap.get(seq.character);
          if (slot !== undefined && slot < 8) {
            // write data byte into the correct byte of trackTD
            const byteIdx = slot % 12;
            trackTD[byteIdx] = seq.data[seq.data.length - 1];
          }
        }
      }

      const hasActivity =
        trackTD.some((b) => b !== 0) || trackBD.some((b) => b !== 0);

      if (hasActivity) {
        const waveL = lowpass(makeBMCWave(encodeBMCBits(trackTD)));
        const waveR = lowpass(makeBMCWave(encodeBMCBits(trackBD)));
        const len = Math.min(samplesPerFrame, outL.length - outOffset);
        for (let i = 0; i < len; i++) {
          outL[outOffset + i] = Math.max(
            -1,
            Math.min(1, (waveL[i] || 0) * scale),
          );
          outR[outOffset + i] = Math.max(
            -1,
            Math.min(1, (waveR[i] || 0) * scale),
          );
        }
      }
      // idle frames remain 0.0 (silence)

      outOffset += samplesPerFrame;
    }

    statusEl.textContent = "Encoding WAV…";
    await new Promise((r) => setTimeout(r, 0));

    // Interleave L+R into a stereo WAV
    const stereo = new Float32Array(outOffset * 2);
    for (let i = 0; i < outOffset; i++) {
      stereo[i * 2] = outL[i];
      stereo[i * 2 + 1] = outR[i];
    }

    const wavBlob = encodeStereoWAV(stereo, SAMPLE_RATE);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tape.title.replace(/[^a-z0-9_\-]/gi, "_")}_BMC_signal.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);

    statusEl.style.color = "#0f8";
    statusEl.textContent = `\u2713 Downloaded: ${tape.title} BMC signal WAV`;
  } catch (err) {
    statusEl.style.color = "#f44";
    statusEl.textContent = `\u2717 ${err.message}`;
    console.error("WAV export error:", err);
  } finally {
    btn.disabled = false;
  }
}

/**
 * Stage View Logic
 */
function openStageView() {
  const modal = document.getElementById("stage-modal");
  modal.classList.add("active");
  buildStageArena();
}

function closeStageView() {
  const modal = document.getElementById("stage-modal");
  modal.classList.remove("active");
}

function buildStageArena() {
  const arena = document.getElementById("stage-arena");
  if (!arena) return;

  arena.innerHTML = "";

  const activeBand = typeof currentBand !== "undefined" ? currentBand : "rock";
  const charList = BAND_CHARACTERS[activeBand] || [];

  charList.forEach((charName, index) => {
    const charDiv = document.createElement("div");
    charDiv.className = "stage-character";
    charDiv.dataset.name = charName;
    charDiv.style.animationDelay = `${index * 0.1}s`;
    charDiv.classList.add("reveal-enter");

    const label = document.createElement("h3");
    label.innerText = charName;
    charDiv.appendChild(label);

    const bodyBox = document.createElement("div");
    bodyBox.className = "character-body-box";

    const moveData = CHARACTER_MOVEMENTS[charName];
    if (moveData && moveData.movements) {
      Object.keys(moveData.movements).forEach((moveKey) => {
        const part = document.createElement("div");
        const partClass = "part-" + moveKey.replace(/_/g, "-");
        part.className = `stage-part ${partClass}`;
        part.dataset.move = moveKey;
        // Text inside part if needed
        part.innerText = moveKey.split("_").pop().substring(0, 3);
        bodyBox.appendChild(part);
      });
    }

    charDiv.appendChild(bodyBox);
    arena.appendChild(charDiv);
  });
}

function updateStageArena() {
  const modal = document.getElementById("stage-modal");
  if (!modal || !modal.classList.contains("active")) return;

  const characters = document.querySelectorAll(".stage-character");
  characters.forEach((charDiv) => {
    const charName = charDiv.dataset.name;
    const moveData = CHARACTER_MOVEMENTS[charName];

    if (moveData && moveData.movements) {
      Object.entries(moveData.movements).forEach(([moveKey, config]) => {
        const isBitOn = signalGenerator.getBit(config.track, config.bit);
        const part = charDiv.querySelector(
          `.part-${moveKey.replace(/_/g, "-")}`,
        );
        if (part) {
          if (isBitOn) {
            part.classList.add("active");
          } else {
            part.classList.remove("active");
          }
        }
      });
    }
  });
}

// Intercept the poll to update stage
const originalUpdateLEDGrid = updateLEDGrid;
updateLEDGrid = function () {
  originalUpdateLEDGrid();
  updateStageArena();
};
