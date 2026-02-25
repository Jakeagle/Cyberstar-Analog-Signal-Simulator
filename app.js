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

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
  updateShowtapeList();

  // Set initial band title
  const bandConfig = BAND_CONFIG[currentBand];
  document.getElementById("band-title").textContent =
    `${bandConfig.title} - Signal Monitors`;

  updateSignalMonitor("System initialized. Ready for BMC playback.");
});

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
    option.textContent = tape.title;
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

  // Start playback
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
      // Play the BMC-encoded signal
      signalGenerator.playBMCSignal(cmd.data, currentPlaybackState.volume);
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

  document.getElementById("progress-bar").value = 0;
  updateTimeDisplay();
  updateSignalMonitor("Stopped");
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

  if (currentPlaybackState.isPaused) {
    playbackStartTime =
      Date.now() -
      currentPlaybackState.currentTime / currentPlaybackState.playbackSpeed;
  }

  updateTimeDisplay();
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
