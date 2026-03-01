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

let playbackSchedule = [];
let playbackStartTime = null;

// WAV song sync
let songBuffer = null; // decoded AudioBuffer for the loaded WAV
let songSource = null; // current playing AudioBufferSourceNode
let songGainNode = null; // gain node for the song

// localStorage key for persisted custom showtapes
const CUSTOM_SHOWS_KEY = "cyberstar_custom_shows";

// ─────────────────────────────────────────────────────────────────────────
// Python Progress Modal controller
// Maps known progress-message substrings to bar percentages.
// Both buildCustomShowtape() and export4chWAV() call pyModal.open/update/close.
// ─────────────────────────────────────────────────────────────────────────
const pyModal = (() => {
  // First matching pattern wins; ordered by typical call sequence.
  const STEP_MAP = [
    // SAM — audio analysis + show generation
    ["Preparing audio", 8],
    ["Downsampled", 22],
    ["Loading Python", 32],
    ["Running Python analysis", 48],
    ["Analysis complete", 95],
    // SGM — 4-ch WAV export
    ["Loading Python export", 10],
    ["Generating BMC frames", 38],
    ["Mixing music channels", 72],
    ["Encoding 4-channel WAV", 88],
    ["Done", 100],
  ];

  let _closeTimer = null;

  function _bar() {
    return document.getElementById("py-modal-bar");
  }

  function _setBar(pct) {
    const b = _bar();
    if (b) b.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  function open(title) {
    clearTimeout(_closeTimer);
    const el = document.getElementById("py-modal");
    if (!el) return;
    const t = document.getElementById("py-modal-title");
    const m = document.getElementById("py-modal-msg");
    if (t) t.textContent = title || "Working\u2026";
    if (m) m.textContent = "";
    _setBar(0);
    el.hidden = false;
    void el.offsetWidth; // force reflow so the CSS transition fires
    el.classList.add("py-modal-visible");
  }

  function update(msg) {
    const m = document.getElementById("py-modal-msg");
    if (m) m.textContent = msg;

    for (const [pattern, pct] of STEP_MAP) {
      if (msg.includes(pattern)) {
        _setBar(pct);
        if (pct >= 100) close();
        return;
      }
    }
    // Unknown message — nudge bar so it looks alive
    const b = _bar();
    if (b) {
      const cur = parseFloat(b.style.width) || 0;
      if (cur < 90) _setBar(cur + 3);
    }
  }

  function close() {
    clearTimeout(_closeTimer);
    _closeTimer = setTimeout(() => {
      const el = document.getElementById("py-modal");
      if (!el) return;
      el.classList.remove("py-modal-visible");
      setTimeout(() => {
        el.hidden = true;
        _setBar(0);
      }, 300);
    }, 900); // linger briefly so the user sees the final state
  }

  return { open, update, close };
})();

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

  // Poll the stage view at ~25 fps
  setInterval(updateStageArena, 40);
});

/**
 * Set up all event listeners
 */
function setupEventListeners() {
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

  // Export buttons
  document
    .getElementById("export-4ch-btn")
    .addEventListener("click", export4chWAV);

  // Stage View Toggle
  document
    .getElementById("toggle-stage-btn")
    .addEventListener("click", openStageView);
  document
    .getElementById("close-stage-btn")
    .addEventListener("click", closeStageView);

  // Custom Show Builder
  const customWavInput = document.getElementById("custom-wav-input");
  // ── Import Show JSON wiring ────────────────────────────────────────────
  const importInput = document.getElementById("import-show-input");
  const importBtn = document.getElementById("import-show-btn");
  const importName = document.getElementById("import-show-name");
  if (importInput) {
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (file) {
        importName.textContent = file.name;
        importBtn.disabled = false;
        document.getElementById("import-show-status").textContent = "";
      } else {
        importName.textContent = "No file chosen";
        importBtn.disabled = true;
      }
    });
  }
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      const file = importInput && importInput.files[0];
      if (file) importShowJSON(file);
    });
  }

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

  // Clear TDM tracks for the new band
  signalGenerator.clearAllCharacterStates();

  // If stage is open, rebuild it
  if (document.getElementById("stage-modal").classList.contains("active")) {
    buildStageArena();
  }
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
      state: sequence.state,
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

      // Signal to stage view
      if (cmd.character && cmd.movement_display) {
        updateStageArena();
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
  } catch (err) {
    if (typeof statusEl !== "undefined") {
      statusEl.textContent = `Error: ${err.message || err}`;
    }
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
        <button class="btn btn-sm btn-export" onclick="exportShowJSON('${tape.id}')">&#8595; Export JSON</button>
      </div>
    </div>`,
    )
    .join("");
}

/**
 * Export a showtape as a human-editable .cybershow.json file.
 * The file preserves all sequence cues in a clean, documented format
 * so the user can refine timings, add notes, and re-import.
 */
function exportShowJSON(id) {
  const tape = SHOWTAPES[id];
  if (!tape) return;

  const FPS = 50;
  const MS_PER_FRAME = 1000 / FPS; // 20 ms

  /** Convert milliseconds to a human-readable MM:SS.mmm annotation. */
  function msToTimestamp(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.round(ms % 1000);
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0") +
      "." +
      String(millis).padStart(3, "0")
    );
  }

  // Group cues by character, sorted by frame
  const characterMap = {};
  const validCues = tape.sequences
    .filter((s) => s.character && s.movement && typeof s.state !== "undefined")
    .sort((a, b) => a.time - b.time);

  for (const s of validCues) {
    const charEntry = CHARACTER_MOVEMENTS[s.character];
    if (!charEntry || !charEntry.movements[s.movement]) continue;
    const moveInfo = charEntry.movements[s.movement];
    const frame = Math.round(s.time / MS_PER_FRAME);

    if (!characterMap[s.character]) {
      characterMap[s.character] = { track: moveInfo.track, signals: [] };
    }

    characterMap[s.character].signals.push({
      frame,
      timestamp: msToTimestamp(s.time), // read-only reference — import uses frame
      movement: s.movement,
      bit: moveInfo.bit, // BMC bit index on the track (0–95)
      state: s.state, // true = actuator ON, false = OFF
      note: s.note || "", // freeform annotation, ignored at import
    });
  }

  const totalFrames = Math.round(tape.duration / MS_PER_FRAME);
  const charCount = Object.keys(characterMap).length;

  const exportObj = {
    cyberstar_show: true,
    version: "3.0",
    title: tape.title,
    band: tape.band, // "rock" | "munch"
    duration_ms: tape.duration,
    duration_frames: totalFrames,
    fps: FPS, // frames per second (always 50 for BMC)
    bpm: tape.bpm || null,
    description: tape.description || "",
    // ── How to edit this file ───────────────────────────────────────────────
    // Each character has a "signals" array. Every entry is one actuator
    // state-change (ON or OFF) on a single movement.
    //
    // To add a cue:   copy any existing entry, set the frame + state you want,
    //                 and paste it in frame-number order.
    // To remove a cue: delete the entry (keep ON/OFF pairs balanced).
    // frame → ms:     frame × 20        (at 50 fps)
    // ms → frame:     Math.round(ms / 20)
    //
    // Fields:
    //   frame      (int)   frame number from show start — THIS drives timing
    //   timestamp  (str)   "MM:SS.mmm" annotation only — NOT read at import
    //   movement   (str)   movement key (must match CHARACTER_MOVEMENTS)
    //   bit        (int)   BMC bit index shown for reference; ignored at import
    //   state      (bool)  true = actuator ON, false = OFF
    //   note       (str)   freeform, ignored at import
    // ───────────────────────────────────────────────────────────────────────
    characters: characterMap,
  };

  const json = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tape.title.replace(/[^a-z0-9_\-]/gi, "_")}.cybershow.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * Validate and import a .cybershow.json file, adding it as a custom showtape.
 * Accepts v3.0 (character-centric) and legacy v2.1 (flat sequences) formats.
 */
function importShowJSON(file) {
  const statusEl = document.getElementById("import-show-status");
  const btn = document.getElementById("import-show-btn");
  btn.disabled = true;
  statusEl.style.color = "";
  statusEl.textContent = "Reading file…";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);

      // ── Basic validation ─────────────────────────────────────────────────
      if (!obj.cyberstar_show)
        throw new Error("Not a valid .cybershow.json file.");
      if (!obj.band || !["rock", "munch"].includes(obj.band))
        throw new Error(
          'Missing or invalid "band" field. Must be "rock" or "munch".',
        );

      const FPS = obj.fps || 50;
      const MS_PER_FRAME = 1000 / FPS;
      const sequences = [];
      let skipped = 0;

      // ── v3.0: character-centric format ───────────────────────────────────
      if (obj.characters && typeof obj.characters === "object") {
        for (const [charName, charData] of Object.entries(obj.characters)) {
          const charEntry = CHARACTER_MOVEMENTS[charName];
          if (!charEntry) {
            skipped += (charData.signals || []).length;
            continue;
          }
          for (const sig of charData.signals || []) {
            if (
              typeof sig.frame !== "number" ||
              !sig.movement ||
              typeof sig.state !== "boolean"
            ) {
              skipped++;
              continue;
            }
            if (!charEntry.movements[sig.movement]) {
              skipped++;
              continue;
            }
            sequences.push({
              time: Math.max(0, Math.round(sig.frame * MS_PER_FRAME)),
              character: charName,
              movement: sig.movement,
              state: sig.state,
              note: sig.note || "",
              executed: false,
            });
          }
        }

        // ── v2.1 legacy: flat sequences array ────────────────────────────────
      } else if (Array.isArray(obj.sequences) && obj.sequences.length > 0) {
        for (const s of obj.sequences) {
          if (
            typeof s.time !== "number" ||
            !s.character ||
            !s.movement ||
            typeof s.state !== "boolean"
          ) {
            skipped++;
            continue;
          }
          const charEntry = CHARACTER_MOVEMENTS[s.character];
          if (!charEntry || !charEntry.movements[s.movement]) {
            skipped++;
            continue;
          }
          sequences.push({
            time: Math.max(0, Math.round(s.time)),
            character: s.character,
            movement: s.movement,
            state: s.state,
            note: s.note || "",
            executed: false,
          });
        }
      } else {
        throw new Error('No "characters" or "sequences" data found in file.');
      }

      if (sequences.length === 0)
        throw new Error(
          "All cues were invalid or referenced unknown characters/movements.",
        );

      sequences.sort((a, b) => a.time - b.time);

      // Duration: prefer file value, fall back to last-cue + 2 s tail
      const lastCue = sequences[sequences.length - 1].time;
      const duration =
        obj.duration_ms && obj.duration_ms > lastCue
          ? obj.duration_ms
          : obj.duration && obj.duration > lastCue
            ? obj.duration
            : lastCue + 2000;

      const id = `imported-${Date.now()}`;
      const tape = {
        id,
        title: obj.title || file.name.replace(/\.cybershow\.json$/i, ""),
        description: obj.description || `Imported from ${file.name}`,
        band: obj.band,
        bpm: obj.bpm || null,
        duration,
        bitrate: 4410,
        isCustom: true,
        sequences,
      };

      SHOWTAPES[id] = tape;
      saveCustomShowtape(tape);

      const msg =
        skipped > 0
          ? `✓ Imported "${tape.title}" — ${sequences.length} cues loaded, ${skipped} invalid cues skipped.`
          : `✓ Imported "${tape.title}" — ${sequences.length} cues loaded.`;

      statusEl.style.color = "#0f8";
      statusEl.textContent = msg;

      // Reset file input
      document.getElementById("import-show-input").value = "";
      document.getElementById("import-show-name").textContent =
        "No file chosen";
      btn.disabled = true;
    } catch (err) {
      statusEl.style.color = "#f44";
      statusEl.textContent = `✗ ${err.message}`;
    } finally {
      btn.disabled = true;
    }
  };
  reader.onerror = () => {
    statusEl.style.color = "#f44";
    statusEl.textContent = "✗ Failed to read file.";
    btn.disabled = true;
  };
  reader.readAsText(file);
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
    signalGenerator.clearAllCharacterStates();
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
 *   1. Decode audio with Web Audio API (browser-native, no signal generation)
 *   2. Mix to mono + decimate to 11 025 Hz (done in show-builder.js)
 *   3. Pass samples to Python via Pyodide — SAM analyses beats, frequency
 *      bands, and builds choreography (see SCME/SAM/show_bridge.py)
 *   4. Convert returned v3.0 JSON to flat sequences + persist to localStorage
 *   5. Auto-select the tape and cache the decoded buffer for sync playback
 */

/**
 * Convert a parsed .cybershow.json v3.0 object into the flat sequences array
 * expected by the showtape player (same logic as the v3.0 branch of importShowJSON).
 *
 * @param {object} obj  Parsed JSON from Python bridge
 * @returns {{ sequences: Array, skipped: number }}
 */
function showObjToSequences(obj) {
  const FPS = obj.fps || 50;
  const MS_PER_FRAME = 1000.0 / FPS;
  const sequences = [];
  let skipped = 0;

  for (const [charName, charData] of Object.entries(obj.characters || {})) {
    const charEntry = CHARACTER_MOVEMENTS[charName];
    if (!charEntry) {
      skipped += (charData.signals || []).length;
      continue;
    }

    for (const sig of charData.signals || []) {
      if (
        typeof sig.frame !== "number" ||
        !sig.movement ||
        typeof sig.state !== "boolean"
      ) {
        skipped++;
        continue;
      }
      if (!charEntry.movements[sig.movement]) {
        skipped++;
        continue;
      }
      sequences.push({
        time: Math.max(0, Math.round(sig.frame * MS_PER_FRAME)),
        character: charName,
        movement: sig.movement,
        state: sig.state,
        note: sig.note || "",
        executed: false,
      });
    }
  }

  sequences.sort((a, b) => a.time - b.time);
  return { sequences, skipped };
}

async function buildCustomShowtape(file, title, band) {
  const statusEl = document.getElementById("generate-status");
  const btn = document.getElementById("generate-show-btn");
  btn.disabled = true;
  statusEl.style.color = "";
  statusEl.textContent = "Decoding audio…";

  pyModal.open("Analysing audio…");

  try {
    // 1. Decode the file with the Web Audio API (read-only — no generation)
    const arrayBuffer = await file.arrayBuffer();
    const ac = signalGenerator.audioContext;
    if (ac.state === "suspended") await ac.resume();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    const durationMs = Math.round(audioBuffer.duration * 1000);

    // 2. Hand off to Python (show-builder.js → SCME/SAM/show_bridge.py)
    if (typeof window.buildShowWithPython !== "function") {
      throw new Error(
        "show-builder.js not loaded — Python analysis unavailable.",
      );
    }
    const showObj = await window.buildShowWithPython(
      audioBuffer,
      band,
      title,
      durationMs,
      (msg) => {
        statusEl.textContent = msg;
        pyModal.update(msg);
      },
    );

    // 3. Convert v3.0 show JSON → flat sequences for the showtape player
    const { sequences, skipped } = showObjToSequences(showObj);
    if (sequences.length === 0) {
      throw new Error(
        "Python generated no valid cues — check the audio file has content.",
      );
    }

    const bpm = showObj.bpm || 120;
    const id = `custom-${Date.now()}`;
    const bandLabel =
      band === "rock"
        ? "Rock Afire Explosion"
        : "Munch\u2019s Make Believe Band";
    const skipNote = skipped > 0 ? ` (${skipped} unknown cues skipped)` : "";

    const tape = {
      id,
      title,
      description:
        showObj.description ||
        `Custom show from \u201c${file.name}\u201d \u2014 ~${bpm} BPM, ` +
          `${sequences.length} cues for ${bandLabel}.`,
      duration: durationMs,
      bitrate: 600,
      band,
      bpm,
      isCustom: true,
      sequences,
    };

    // 4. Save to localStorage + update UI
    saveCustomShowtape(tape);

    // Cache decoded audio so the player syncs immediately this session
    songBuffer = audioBuffer;

    // Auto-select the new tape in the player dropdown
    currentShowtapeId = id;
    const select = document.getElementById("showtape-select");
    select.value = id;
    currentPlaybackState.totalTime = durationMs;
    document.getElementById("tape-description").textContent = tape.description;
    updateTimeDisplay();

    statusEl.style.color = "#0f8";
    statusEl.textContent =
      `\u2713 \u201c${title}\u201d saved! ` +
      `${sequences.length} cues \u00b7 ${formatTime(durationMs)} \u00b7 ~${bpm} BPM${skipNote}`;
  } catch (err) {
    statusEl.style.color = "#f44";
    statusEl.textContent = `\u2717 ${err.message}`;
    console.error("[buildCustomShowtape]", err);
  } finally {
    pyModal.close();
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
/**
 * Encode N parallel Float32Array channel buffers into a multi-channel 16-bit PCM WAV Blob.
 * Channel order: [musicL, musicR, TD, BD] → 4-channel RetroMation-compatible file.
 * @param {Float32Array[]} channels  Array of per-channel sample buffers (must be same length)
 * @param {number}         sampleRate
 * @returns {Blob}
 */
function encodeMultiChWAV(channels, sampleRate) {
  const numChannels = channels.length;
  const numFrames = channels[0].length; // samples per channel
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataBytes = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Shared BMC render core — called by all three export functions
// ─────────────────────────────────────────────────────────────────────────────
async function _renderBMCFrames(tape, statusEl) {
  const bandKey = tape.band || currentBand;
  const bandCfg = BAND_CONFIG[bandKey] || BAND_CONFIG[currentBand];
  const bandChars = Object.values(bandCfg.characters).map((c) => c.name);
  const slotMap = new Map();
  bandChars.forEach((name, i) => {
    if (i < 8) slotMap.set(name, i);
  });

  // RetroMation/Transmutate true standard (proven from .shw forensics):
  // 44100 Hz / 4410 bps = exactly 10 samples per bit — edge gaps in reference .shw all = 5 samples
  // 12-byte (96-bit) frames — 0xFF sync at byte 0, 11 data bytes, verified by 0xFF every 12 bytes
  // Frame rate: 4410 bps / 96 bits = 45.9375 fps
  const SAMPLE_RATE = 44100;
  const BITRATE = 4410;
  const FRAME_RATE = 45.9375; // 4410 bps / 96 bits per frame
  // Export renders at full scale; exportBroadcastWav applies the final ±SIGNAL_PEAK clamp.
  const scale = 1.0;
  const FRAME_MS = 1000 / FRAME_RATE;
  const bitsPerFrame = 12 * 8; // 96 bits — 12-byte frame (1 sync + 11 data)
  const samplesPerBit = SAMPLE_RATE / BITRATE; // exactly 10.0
  const samplesPerFrame = Math.ceil(bitsPerFrame * samplesPerBit); // 960 samples
  const totalFrames = Math.ceil(tape.duration / FRAME_MS);

  // Pilot tone: 3.0 s of logical-1 bits at 4410 bps so Transmutate can lock its clock
  const PILOT_BITS = BITRATE * 3; // 13230 bits = 3 seconds of pilot
  const PILOT_SAMPLES = Math.round(PILOT_BITS * samplesPerBit); // 132300 samples = 3 s

  // MSB-first bit extraction — Pianocorder / RAE standard (MSB sent first)
  function encodeBMCBits(bytes) {
    const bits = [];
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
    }
    return bits;
  }

  // Float-accumulator BMC waveform — handles non-integer 9.8 samples/bit precisely.
  // No rounding artifacts. Digital decoders receive clean square-wave transitions.
  function makeBMCWave(bits) {
    const totalSamples = Math.ceil(bits.length * samplesPerBit);
    const w = new Float32Array(totalSamples);
    let level = 1.0;
    let pos = 0.0;
    for (let bi = 0; bi < bits.length; bi++) {
      const nextPos = pos + samplesPerBit;
      const midPos = pos + samplesPerBit / 2.0;
      const start = Math.floor(pos);
      const mid = Math.floor(midPos);
      const end = Math.floor(nextPos);
      if (bits[bi] === 1) {
        for (let i = start; i < mid; i++) w[i] = level;
        level *= -1.0; // mid-bit transition
        for (let i = mid; i < end; i++) w[i] = level;
        level *= -1.0; // boundary transition
      } else {
        for (let i = start; i < end; i++) w[i] = level;
        level *= -1.0; // boundary transition only
      }
      pos = nextPos;
    }
    return w;
  }

  // Pilot tone: PILOT_BITS of logical-1 BMC (4410 bps screech for decoder clock lock)
  function makePilotTone() {
    const w = new Float32Array(PILOT_SAMPLES);
    let level = 1.0;
    let pos = 0.0;
    for (let bi = 0; bi < PILOT_BITS; bi++) {
      const nextPos = pos + samplesPerBit;
      const midPos = pos + samplesPerBit / 2.0;
      const start = Math.floor(pos);
      const mid = Math.floor(midPos);
      const end = Math.floor(nextPos);
      for (let i = start; i < mid && i < PILOT_SAMPLES; i++) w[i] = level;
      level *= -1.0;
      for (let i = mid; i < end && i < PILOT_SAMPLES; i++) w[i] = level;
      level *= -1.0;
      pos = nextPos;
    }
    return w;
  }

  // RetroMation Framing: byte 0 of every 12-byte frame MUST be 0xFF as the
  // sync marker. The SPTE/Transmutate decoder uses this pattern to locate frame boundaries.
  // Character control data occupies bytes 1-11 (88 bits of animation data).
  // Byte 0 is never modified by character state — it is always 0xFF.
  const trackTD = new Uint8Array(12);
  const trackBD = new Uint8Array(12);
  trackTD[0] = 0xff;
  trackBD[0] = 0xff;

  const outL = new Float32Array(PILOT_SAMPLES + totalFrames * samplesPerFrame);
  const outR = new Float32Array(PILOT_SAMPLES + totalFrames * samplesPerFrame);

  // Prepend pilot tone to TD and BD channels.
  // Music L/R channels keep zeros (silence) for this region — the decoder
  // needs the pilot period to be data-only with no music overlay.
  const pilot = makePilotTone();
  for (let i = 0; i < pilot.length; i++) pilot[i] *= scale;
  outL.set(pilot);
  outR.set(pilot);
  let outOffset = PILOT_SAMPLES; // show frames start after the pilot

  const seqs = [...tape.sequences].sort((a, b) => a.time - b.time);
  let seqIdx = 0;

  for (let f = 0; f < totalFrames; f++) {
    if (f % 200 === 0 && f > 0) {
      statusEl.textContent = `Rendering… ${Math.round((f / totalFrames) * 100)}%`;
      await new Promise((r) => setTimeout(r, 0));
    }

    const frameStartMs = f * FRAME_MS;
    const frameEndMs = frameStartMs + FRAME_MS;

    while (seqIdx < seqs.length && seqs[seqIdx].time < frameEndMs) {
      const seq = seqs[seqIdx++];
      if (seq.time < frameStartMs) continue;

      if (seq.character && seq.movement && typeof seq.state !== "undefined") {
        const charEntry = CHARACTER_MOVEMENTS[seq.character];
        if (charEntry) {
          const m = charEntry.movements[seq.movement];
          if (m) {
            const buf = m.track === "TD" ? trackTD : trackBD;
            // +1 byte offset: byte 0 is the 0xFF RAE sync byte.
            // Character bit indices 0-87 map to bytes 1-11 of the frame.
            // Bits 88-95 (lighting specials only) exceed the 11 data bytes
            // available and are safely skipped.
            const byteIdx = Math.floor(m.bit / 8) + 1;
            if (byteIdx >= 12) continue; // out of frame bounds — skip (bytes 0–11 only)
            const bitPos = 7 - (m.bit % 8); // MSB-first — RetroMation/SPTE standard
            if (seq.state) buf[byteIdx] |= 1 << bitPos;
            else buf[byteIdx] &= ~(1 << bitPos);
          }
        }
      } else if (seq.data && seq.character && seq.character !== "All") {
        const slot = slotMap.get(seq.character);
        // +1 byte offset for RAE sync byte; keep byte 0 = 0xFF
        if (slot !== undefined && slot < 11)
          trackTD[slot + 1] = seq.data[seq.data.length - 1];
      }
    }

    // Emit one 12-byte RetroMation frame per show frame:
    //   byte 0 = 0xFF sync, bytes 1-11 = character data (88 animation bits)
    const waveL = makeBMCWave(encodeBMCBits(trackTD));
    const waveR = makeBMCWave(encodeBMCBits(trackBD));
    const len = Math.min(samplesPerFrame, outL.length - outOffset);
    for (let i = 0; i < len; i++) {
      outL[outOffset + i] = (waveL[i] || 0) * scale;
      outR[outOffset + i] = (waveR[i] || 0) * scale;
    }
    outOffset += samplesPerFrame;
  }

  return { outL, outR, outOffset, PILOT_SAMPLES, bandKey, tape, SAMPLE_RATE };
}

// Extract music L/R from the cached songBuffer, resampled to exportSampleRate.
// pilotSamples: number of export-rate samples to leave silent at the start —
// matching the pilot tone duration so STPE's clock-lock period has no music.
function _extractMusicChannels(len, pilotSamples, exportSampleRate) {
  const EXPORT_SR = exportSampleRate || 44100;
  const musicL = new Float32Array(len); // zero-filled = silence
  const musicR = new Float32Array(len);
  if (songBuffer) {
    const srcSR = songBuffer.sampleRate; // AudioContext rate (typically 44100)
    const srcL = songBuffer.getChannelData(0);
    const srcR =
      songBuffer.numberOfChannels > 1 ? songBuffer.getChannelData(1) : srcL;
    const ratio = srcSR / EXPORT_SR; // e.g. 44100/44100 = 1.0 (no resample needed)
    const offset = pilotSamples || 0; // leave pilot region silent
    // Linear-interpolation resample: for each output sample position i,
    // compute the corresponding fractional position in the source buffer,
    // then lerp between the two nearest source samples.
    for (let i = 0; i < len - offset; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;
      if (idx + 1 >= srcL.length) break; // past end of source — leave silence
      musicL[offset + i] = srcL[idx] + frac * (srcL[idx + 1] - srcL[idx]);
      musicR[offset + i] = srcR[idx] + frac * (srcR[idx + 1] - srcR[idx]);
    }
  }
  return { musicL, musicR };
}

// Shared guard: validate selection, grab btn + status el, disable button
function _exportGuard(btnId) {
  if (!currentShowtapeId) {
    alert("Please select a showtape first.");
    return null;
  }
  const tape = SHOWTAPES[currentShowtapeId];
  const btn = document.getElementById(btnId);
  const statusEl = document.getElementById("export-wav-status");
  btn.disabled = true;
  statusEl.style.color = "";
  statusEl.textContent = "Rendering…";
  return { tape, btn, statusEl };
}

// ── Button 1: Signal-only stereo WAV (TD = L, BD = R) ─────────────────────
async function exportSignalOnly() {
  const g = _exportGuard("export-signal-btn");
  if (!g) return;
  const { tape, btn, statusEl } = g;
  try {
    signalGenerator.isExporting = true; // suppress noise in waveform methods
    const {
      outL,
      outR,
      outOffset,
      tape: t,
      SAMPLE_RATE,
    } = await _renderBMCFrames(tape, statusEl);
    statusEl.textContent = "Encoding signal WAV…";
    await new Promise((r) => setTimeout(r, 0));

    const stereo = new Float32Array(outOffset * 2);
    for (let i = 0; i < outOffset; i++) {
      stereo[i * 2] = outL[i];
      stereo[i * 2 + 1] = outR[i];
    }
    const blob = encodeStereoWAV(stereo, SAMPLE_RATE);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.title.replace(/[^a-z0-9_\-]/gi, "_")}_signal.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);

    statusEl.style.color = "#0f8";
    statusEl.textContent = `\u2713 Downloaded: ${t.title} — signal-only stereo WAV`;
  } catch (err) {
    statusEl.style.color = "#f44";
    statusEl.textContent = `\u2717 ${err.message}`;
    console.error("Signal export error:", err);
  } finally {
    signalGenerator.isExporting = false;
    btn.disabled = false;
  }
}

// ── Button 2: 4-channel WAV (Music L, Music R, TD BMC, BD BMC) ────────────
// Signal generation runs entirely in Python via SCME/SGM/export_bridge.py.
async function export4chWAV() {
  const g = _exportGuard("export-4ch-btn");
  if (!g) return;
  const { tape, btn, statusEl } = g;

  pyModal.open("Exporting 4-ch WAV\u2026");

  try {
    // Normalise sequence entries to {time_ms, character, movement, state}
    const sequences = (tape.sequences || []).map((s) => ({
      time_ms: s.time_ms !== undefined ? s.time_ms : s.time,
      character: s.character,
      movement: s.movement,
      state: s.state,
    }));

    const blob = await window.export4chWAVWithPython(
      sequences,
      tape.duration,
      tape.title,
      (msg) => {
        statusEl.style.color = "";
        statusEl.textContent = msg;
        pyModal.update(msg);
      },
    );

    // Store blob so cso-exporter.js can read it for CSO export
    window._lastBroadcastWavBlob = blob;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tape.title.replace(/[^a-z0-9_\-]/gi, "_")}_4ch.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);

    const musicNote = songBuffer ? " + music" : " (data only)";
    statusEl.style.color = "#0f8";
    statusEl.textContent = `✓ Downloaded: ${tape.title} — 4-ch WAV${musicNote}`;
  } catch (err) {
    statusEl.style.color = "#f44";
    statusEl.textContent = `✗ ${err.message}`;
    console.error("4-ch WAV export error:", err);
  } finally {
    pyModal.close();
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
    charDiv.className = "stage-character reveal-enter";
    charDiv.dataset.name = charName;
    charDiv.style.animationDelay = `${index * 0.08}s`;

    // ── Header ──
    const header = document.createElement("div");
    header.className = "stage-char-header";
    const label = document.createElement("h3");
    label.innerText = charName;
    header.appendChild(label);
    charDiv.appendChild(header);

    // ── Movement indicator list ──
    const bodyBox = document.createElement("div");
    bodyBox.className = "character-body-box";

    const moveData = CHARACTER_MOVEMENTS[charName];
    if (moveData && moveData.movements) {
      Object.keys(moveData.movements).forEach((moveKey) => {
        const pill = document.createElement("div");
        pill.className = "stage-part";
        pill.dataset.move = moveKey;
        // Human-readable label, e.g. "arm_left_raise" → "arm left raise"
        pill.textContent = moveKey.replace(/_/g, " ");
        bodyBox.appendChild(pill);
      });
    }

    charDiv.appendChild(bodyBox);
    arena.appendChild(charDiv);
  });
}

function updateStageArena() {
  const modal = document.getElementById("stage-modal");
  if (!modal || !modal.classList.contains("active")) return;

  // SViz mode: use decoded channel timeline from the CSO File Previewer.
  // Live mode: read live BMC bits from signalGenerator.
  const sviz = window._svizActiveState || null;

  document.querySelectorAll(".stage-character").forEach((charDiv) => {
    const charName = charDiv.dataset.name;
    const moveData = CHARACTER_MOVEMENTS[charName];
    if (!moveData?.movements) return;

    Object.entries(moveData.movements).forEach(([moveKey, config]) => {
      const isBitOn = sviz
        ? (sviz.active.get(charName)?.has(moveKey) ?? false)
        : signalGenerator.getBit(config.track, config.bit);

      const part = charDiv.querySelector(`.stage-part[data-move="${moveKey}"]`);
      if (part) part.classList.toggle("active", !!isBitOn);
    });
  });
}
