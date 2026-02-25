/**
 * Cyberstar Showtapes with Character Movements
 * Each showtape now maps to specific character movements
 */

const SONG_TIMING = {
  comeTogether: {
    title: "Come Together - The Beatles",
    bpm: 84,
    durationMs: 256000,
  },
};

const BAND_CHARACTERS = {
  munch: [
    "Chuck E. Cheese",
    "Munch",
    "Helen Henny",
    "Jasper T. Jowls",
    "Pasqually",
  ],
  rock: [
    "Billy Bob",
    "Mitzi",
    "Fatz",
    "Beach Bear",
    "Dook LaRue",
    "Rolfe",
    "Earl",
  ],
};

const MOVEMENT_PATTERNS = {
  "Chuck E. Cheese": [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "arm_left_raise",
    "arm_right_raise",
    "wave",
    "body_lean",
    "hip_sway",
    "hand_gesture",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
  ],
  Munch: [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "arm_left_raise",
    "arm_right_raise",
    "strum_motion",
    "hip_sway",
    "foot_tap",
    "blink_left",
    "blink_right",
  ],
  "Helen Henny": [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "arm_left_raise",
    "arm_right_raise",
    "hand_gesture",
    "hip_sway",
    "torso_move",
    "foot_tap",
    "blink_left",
    "blink_right",
  ],
  "Jasper T. Jowls": [
    "mouth",
    "head_left",
    "head_right",
    "neck_sway",
    "arm_right_up",
    "arm_right_down",
    "arm_left_strum",
    "arm_side_to_side",
    "foot_stomp",
    "foot_tap",
    "torso_shift",
    "torso_sway",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
  ],
  Pasqually: [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "arm_left_raise",
    "arm_right_raise",
    "hand_gesture",
    "body_lean",
    "torso_move",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
  ],
  "Billy Bob": [
    "mouth",
    "head_left",
    "head_right",
    "head_up",
    "head_down",
    "arm_right_strum",
    "arm_right_up",
    "arm_right_down",
    "arm_left_up",
    "arm_left_down",
    "guitar_up",
    "guitar_down",
    "body_lean",
    "body_turn_left",
    "body_turn_right",
    "foot_tap",
    "leg_kick",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
    "eye_center",
  ],
  Fatz: [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "shoulder_left",
    "shoulder_right",
    "arm_left_raise",
    "arm_right_raise",
    "arm_twist",
    "hand_pose",
    "keyboard_lean",
    "foot_bounce",
    "torso_twist",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
    "eye_center",
  ],
  Mitzi: [
    "mouth",
    "head_left",
    "head_right",
    "head_tilt",
    "shoulder_left",
    "shoulder_right",
    "arm_swing",
    "wrist_rotate",
    "hip_sway",
    "waist_sway",
    "hand_wave",
    "hand_point",
    "foot_tap",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
  ],
  "Beach Bear": [
    "mouth",
    "blink",
    "eye_left",
    "eye_right",
    "head_turn",
    "head_tilt",
    "arm_raise",
    "guitar_strum",
    "hand_gesture",
    "torso_lean",
    "torso_sway",
    "foot_tap",
    "rhythm_bounce",
  ],
  "Dook LaRue": [
    "mouth",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
    "head_nod",
    "head_tilt",
    "torso_swivel",
    "arm_up",
    "arm_down",
    "wrist_flick",
    "cymbal_reach",
    "foot_kick",
    "foot_tap",
  ],
  Rolfe: [
    "mouth",
    "ear_left_flick",
    "ear_right_flick",
    "blink_left",
    "blink_right",
    "eye_left",
    "eye_right",
    "head_left",
    "head_right",
    "head_up",
    "arm_left_raise",
    "arm_right_raise",
    "elbow_left_bend",
    "elbow_right_bend",
    "arm_left_twist",
    "arm_right_twist",
    "body_twist_left",
    "body_twist_right",
    "body_lean",
    "hand_pose",
  ],
  Earl: ["head_tilt", "mouth", "eyebrow_raise", "eye_look"],
};

function getMovementDisplay(character, movement) {
  const entry = CHARACTER_MOVEMENTS[character];
  if (!entry || !entry.movements[movement]) return movement;
  return entry.movements[movement];
}

function getChannelForCharacter(character) {
  const allCharacters = [...BAND_CHARACTERS.munch, ...BAND_CHARACTERS.rock];
  const index = Math.max(0, allCharacters.indexOf(character));
  return (index % 4) + 1;
}

function buildMovementData(character, movement, channel) {
  const hash = character.charCodeAt(0) + movement.charCodeAt(0);
  const basePattern = hash % 64;
  const movementByte = ((channel & 0x03) << 6) | (basePattern & 0x3f);

  switch (movement.split("_")[0]) {
    case "mouth":
      return new Uint8Array([0xaa, 0x55, movementByte]);
    case "blink":
      return new Uint8Array([0x55, 0xaa, movementByte]);
    case "eye":
      return new Uint8Array([0x33, 0xcc, movementByte]);
    case "head":
    case "neck":
      return new Uint8Array([0x0f, 0xf0, movementByte]);
    case "arm":
    case "shoulder":
    case "hand":
    case "elbow":
      return new Uint8Array([0xff, 0x00, movementByte]);
    case "torso":
    case "body":
    case "hip":
    case "waist":
      return new Uint8Array([0xc3, 0x3c, movementByte]);
    case "foot":
    case "leg":
      return new Uint8Array([0x5a, 0xa5, movementByte]);
    case "guitar":
    case "strum":
    case "keyboard":
      return new Uint8Array([0x66, 0x99, movementByte]);
    default:
      return new Uint8Array([0x00, movementByte]);
  }
}

function addMovement(sequences, time, character, movement) {
  if (!character || !movement) return;
  const channel = getChannelForCharacter(character);
  sequences.push({
    time: Math.max(0, Math.round(time)),
    character: character,
    movement: movement,
    movement_display: getMovementDisplay(character, movement),
    data: buildMovementData(character, movement, channel),
  });
}

function buildBandSection(sequences, startMs, endMs, characters, bpm) {
  const beatMs = 60000 / bpm;
  const beatCount = Math.floor((endMs - startMs) / beatMs);

  characters.forEach((character, index) => {
    const pattern = MOVEMENT_PATTERNS[character];
    const introMove = pattern[index % pattern.length];
    addMovement(sequences, startMs + index * 80, character, introMove);
  });

  for (let beat = 0; beat <= beatCount; beat += 1) {
    const beatTime = startMs + beat * beatMs;
    if (beatTime >= endMs) break;

    characters.forEach((character, index) => {
      const pattern = MOVEMENT_PATTERNS[character];
      const move = pattern[(beat + index) % pattern.length];
      addMovement(sequences, beatTime + index * 40, character, move);

      if (beat % 4 === 0) {
        const accentMove = pattern[(beat + index + 3) % pattern.length] || move;
        const accentTime = beatTime + beatMs / 2 + index * 30;
        if (accentTime < endMs) {
          addMovement(sequences, accentTime, character, accentMove);
        }
      }
    });
  }

  characters.forEach((character, index) => {
    const pattern = MOVEMENT_PATTERNS[character];
    const outroMove = pattern[(index + 5) % pattern.length];
    addMovement(sequences, endMs - 600 + index * 60, character, outroMove);
  });
}

function buildComeTogetherFullShow(band) {
  const sequences = [];
  const timing = SONG_TIMING.comeTogether;
  const characters = BAND_CHARACTERS[band] || [];

  buildBandSection(sequences, 0, timing.durationMs, characters, timing.bpm);

  sequences.sort((a, b) => a.time - b.time);
  return sequences;
}

// ─────────────────────────────────────────────────────────────────────────────
// Song-mapped RFE choreography for Come Together – The Beatles  (~84 BPM)
// Load the WAV file for perfect sync.  All times in ms.
// ─────────────────────────────────────────────────────────────────────────────

function buildComeTogetherRFESongMapped() {
  const seq = [];
  const BEAT = 714; // ms at 84 BPM  (60000/84 ≈ 714)
  const BAR = BEAT * 4; // 2857 ms

  function mv(t, char, move) {
    addMovement(seq, Math.round(t), char, move);
  }

  // ── Section helpers ────────────────────────────────────────────────────────

  function drums(from, to) {
    for (let t = from; t < to; t += BEAT) {
      mv(t, "Dook LaRue", "arm_up");
      mv(t + BEAT / 2, "Dook LaRue", "arm_down");
    }
    for (let t = from + BAR - BEAT / 2; t < to; t += BAR) {
      mv(t, "Dook LaRue", "cymbal_reach");
    }
    for (let t = from; t < to; t += BAR) {
      mv(t + BEAT, "Dook LaRue", "foot_kick");
    }
  }

  function bassKeys(from, to) {
    for (let t = from; t < to; t += BAR) {
      mv(t, "Fatz", "keyboard_lean");
      mv(t + BEAT, "Fatz", "foot_bounce");
      mv(t + BEAT * 2, "Fatz", "torso_twist");
      mv(t + BEAT * 3, "Fatz", "foot_bounce");
    }
  }

  function riffBear(from, to) {
    // iconic three-note descending riff, roughly every two beats
    for (let t = from; t < to; t += BEAT * 2) {
      mv(t, "Beach Bear", "guitar_strum");
      mv(t + BEAT / 2, "Beach Bear", "torso_sway");
    }
  }

  function rhythmGuitar(from, to) {
    for (let t = from; t < to; t += BEAT) {
      mv(t, "Billy Bob", "arm_right_strum");
    }
    for (let t = from; t < to; t += BAR * 2) {
      mv(t + BEAT, "Billy Bob", "foot_tap");
    }
  }

  function rolfeSings(from, to) {
    for (let t = from; t < to; t += BEAT / 2) {
      mv(t, "Rolfe", "mouth");
    }
    for (let t = from; t < to; t += BAR) {
      mv(t + BEAT, "Rolfe", "head_left");
      mv(t + BEAT * 3, "Rolfe", "head_right");
    }
  }

  function mitziDances(from, to) {
    for (let t = from; t < to; t += BAR) {
      mv(t, "Mitzi", "hip_sway");
      mv(t + BEAT, "Mitzi", "waist_sway");
      mv(t + BEAT * 2, "Mitzi", "arm_swing");
      mv(t + BEAT * 3, "Mitzi", "hand_wave");
    }
  }

  function chorusAll(from, to) {
    for (let t = from; t < to; t += BAR) {
      mv(t, "Rolfe", "arm_right_raise");
      mv(t + BEAT / 2, "Rolfe", "arm_left_raise");
      mv(t + BEAT, "Rolfe", "mouth");
      mv(t, "Mitzi", "arm_swing");
      mv(t + BEAT / 2, "Mitzi", "waist_sway");
      mv(t, "Billy Bob", "guitar_up");
      mv(t + BEAT, "Billy Bob", "arm_right_up");
      mv(t, "Beach Bear", "arm_raise");
      mv(t + BEAT, "Beach Bear", "guitar_strum");
      mv(t, "Fatz", "arm_right_raise");
      mv(t + BEAT, "Fatz", "arm_left_raise");
      mv(t + BEAT * 3, "Dook LaRue", "cymbal_reach");
      mv(t + BEAT * 2, "Earl", "eyebrow_raise");
    }
    drums(from, to);
    bassKeys(from, to);
    riffBear(from, to);
  }

  // ── INTRO  0 – 7143 ───────────────────────────────────────────────────────
  // The iconic four-bar guitar intro — Beach Bear awakens first, drums join bar 2
  mv(0, "Beach Bear", "guitar_strum");
  mv(357, "Beach Bear", "torso_sway");
  mv(714, "Beach Bear", "guitar_strum");
  mv(1071, "Beach Bear", "guitar_strum");
  mv(1429, "Beach Bear", "guitar_strum");
  mv(1786, "Dook LaRue", "arm_up");
  mv(2143, "Beach Bear", "guitar_strum");
  mv(2143, "Dook LaRue", "wrist_flick");
  mv(2500, "Dook LaRue", "foot_kick");
  mv(2857, "Beach Bear", "guitar_strum");
  mv(2857, "Dook LaRue", "arm_up");
  mv(3214, "Fatz", "keyboard_lean");
  mv(3214, "Dook LaRue", "arm_down");
  mv(3571, "Beach Bear", "guitar_strum");
  mv(3571, "Billy Bob", "head_right");
  mv(4286, "Dook LaRue", "arm_up");
  mv(4286, "Billy Bob", "arm_right_strum");
  mv(5000, "Dook LaRue", "cymbal_reach");
  mv(5000, "Beach Bear", "guitar_strum");
  mv(5714, "Dook LaRue", "arm_down");
  mv(5714, "Mitzi", "head_left");
  mv(6429, "Earl", "eyebrow_raise"); // "Shoot me"
  mv(6429, "Beach Bear", "guitar_strum");
  mv(6429, "Dook LaRue", "arm_up");

  // ── VERSE 1  7143 – 41429 "Here come old flattop…" ───────────────────────
  const V1 = 7143;
  rolfeSings(V1, 41429);
  rhythmGuitar(V1, 41429);
  drums(V1, 41429);
  bassKeys(V1, 41429);
  riffBear(V1, 41429);
  mitziDances(V1, 41429);

  mv(V1, "Earl", "eyebrow_raise"); // "Here come old flattop"
  mv(V1 + BAR * 2, "Earl", "head_tilt"); // "joo joo eyeball"
  mv(V1 + BAR * 4, "Earl", "eyebrow_raise"); // "holy roller"
  mv(V1 + BAR * 6, "Earl", "head_tilt"); // "spinal cracker"
  mv(V1 + BAR * 8, "Earl", "eyebrow_raise"); // "got to be a joker"
  mv(V1 + BAR * 10, "Earl", "head_tilt");
  mv(V1 + BAR * 12, "Earl", "eyebrow_raise");

  // ── CHORUS 1  41429 – 51429 "Come together, right now…" ──────────────────
  const C1 = 41429;
  chorusAll(C1, 51429);
  mv(C1, "Rolfe", "body_lean");
  mv(C1 + BAR * 2, "Rolfe", "hand_pose");

  // ── VERSE 2  51429 – 86786 ────────────────────────────────────────────────
  const V2 = 51429;
  rolfeSings(V2, 86786);
  rhythmGuitar(V2, 86786);
  drums(V2, 86786);
  bassKeys(V2, 86786);
  riffBear(V2, 86786);
  mitziDances(V2, 86786);

  mv(V2, "Rolfe", "body_twist_left");
  mv(V2 + BAR, "Rolfe", "body_twist_right");
  mv(V2 + BAR * 2, "Earl", "eyebrow_raise"); // "Hold you in his armchair"
  mv(V2 + BAR * 4, "Earl", "head_tilt"); // "mudflat"
  mv(V2 + BAR * 6, "Earl", "eyebrow_raise"); // "bag production"
  mv(V2 + BAR * 8, "Earl", "head_tilt");
  mv(V2 + BAR * 10, "Earl", "eyebrow_raise");
  mv(V2 + BAR * 12, "Earl", "eye_look");

  // ── CHORUS 2  86786 – 97143 ───────────────────────────────────────────────
  const C2 = 86786;
  chorusAll(C2, 97143);
  mv(C2 + BAR, "Rolfe", "body_lean");

  // ── VERSE 3  97143 – 131429 "He wear no shoeshine / walrus gumboot…" ──────
  const V3 = 97143;
  rolfeSings(V3, 131429);
  rhythmGuitar(V3, 131429);
  drums(V3, 131429);
  bassKeys(V3, 131429);
  riffBear(V3, 131429);
  mitziDances(V3, 131429);

  // Earl especially bewildered by the surreal lyrics
  mv(V3, "Earl", "eyebrow_raise");
  mv(V3 + BAR, "Earl", "head_tilt"); // "walrus gumboot"
  mv(V3 + BAR * 2, "Earl", "eyebrow_raise"); // "Ono sideboard"
  mv(V3 + BAR * 3, "Earl", "head_tilt");
  mv(V3 + BAR * 4, "Earl", "eyebrow_raise");
  mv(V3 + BAR * 5, "Earl", "head_tilt");
  mv(V3 + BAR * 6, "Earl", "eyebrow_raise"); // "muddy water"
  mv(V3 + BAR * 8, "Earl", "head_tilt");
  mv(V3 + BAR * 10, "Earl", "eyebrow_raise");
  mv(V3 + BAR * 12, "Earl", "head_tilt");

  // ── CHORUS 3  131429 – 141786 ─────────────────────────────────────────────
  const C3 = 131429;
  chorusAll(C3, 141786);

  // ── BREAK  141786 – 173929 (guitar instrumental) ──────────────────────────
  const BRK = 141786;
  // Beach Bear gets the spotlight — plays on every beat
  for (let t = BRK; t < 173929; t += BEAT) {
    mv(t, "Beach Bear", "guitar_strum");
    mv(t + BEAT / 3, "Beach Bear", "torso_sway");
  }
  drums(BRK, 173929);
  bassKeys(BRK, 173929);

  // Others groove and watch
  for (let t = BRK; t < 173929; t += BAR) {
    mv(t, "Billy Bob", "head_right"); // turn to watch Beach Bear
    mv(t + BEAT, "Billy Bob", "foot_tap");
    mv(t, "Mitzi", "hip_sway");
    mv(t + BEAT, "Mitzi", "waist_sway");
    mv(t + BEAT * 2, "Mitzi", "hand_wave");
    mv(t, "Rolfe", "head_right");
    mv(t + BAR / 2, "Rolfe", "head_left");
    mv(t, "Earl", "eyebrow_raise"); // impressed
    mv(t + BAR / 2, "Fatz", "torso_twist");
  }

  // ── VERSE 4  173929 – 207143 "He roller-coaster…" ────────────────────────
  const V4 = 173929;
  rolfeSings(V4, 207143);
  rhythmGuitar(V4, 207143);
  drums(V4, 207143);
  bassKeys(V4, 207143);
  riffBear(V4, 207143);
  mitziDances(V4, 207143);

  mv(V4 + BAR * 2, "Earl", "eyebrow_raise"); // "He roller-coaster"
  mv(V4 + BAR * 4, "Earl", "head_tilt");
  mv(V4 + BAR * 5, "Earl", "eyebrow_raise"); // "He got early warning"
  mv(V4 + BAR * 6, "Earl", "head_tilt");
  mv(V4 + BAR * 7, "Earl", "eyebrow_raise");
  mv(V4 + BAR * 8, "Earl", "head_tilt");
  mv(V4 + BAR * 9, "Earl", "eyebrow_raise");
  mv(V4 + BAR * 10, "Earl", "head_tilt");

  // ── CHORUS 4  207143 – 218571 (grand finale) ──────────────────────────────
  const C4 = 207143;
  for (let t = C4; t < 218571; t += BAR) {
    mv(t, "Rolfe", "arm_right_raise");
    mv(t + BEAT / 2, "Rolfe", "arm_left_raise");
    mv(t + BEAT, "Rolfe", "mouth");
    mv(t + BEAT * 2, "Rolfe", "body_lean");
    mv(t, "Mitzi", "arm_swing");
    mv(t + BEAT * 2, "Mitzi", "waist_sway");
    mv(t, "Billy Bob", "guitar_up");
    mv(t + BEAT, "Billy Bob", "arm_right_up");
    mv(t + BEAT * 3, "Billy Bob", "arm_right_down");
    mv(t, "Beach Bear", "arm_raise");
    mv(t + BEAT, "Beach Bear", "guitar_strum");
    mv(t, "Fatz", "arm_right_raise");
    mv(t + BEAT, "Fatz", "arm_left_raise");
    mv(t + BEAT * 2, "Fatz", "torso_twist");
    mv(t, "Dook LaRue", "arm_up");
    mv(t + BEAT * 3, "Dook LaRue", "cymbal_reach");
    mv(t + BEAT, "Earl", "mouth");
    mv(t + BEAT * 2, "Earl", "eyebrow_raise");
  }
  drums(C4, 218571);
  bassKeys(C4, 218571);

  // ── OUTRO  218571 – 259000 ────────────────────────────────────────────────
  const OUTRO = 218571;
  rolfeSings(OUTRO, 248000); // vocals last until ~248s
  rhythmGuitar(OUTRO, 250000); // rhythm guitar fades ~250s
  drums(OUTRO, 252000); // drums fade ~252s
  bassKeys(OUTRO, 252000);
  mitziDances(OUTRO, 250000);

  // Repeated "Come together" outro vamp
  for (let t = OUTRO; t < 248000; t += BAR * 2) {
    mv(t, "Rolfe", "arm_right_raise");
    mv(t + BAR, "Rolfe", "arm_left_raise");
    mv(t + BEAT, "Earl", "eyebrow_raise");
    mv(t, "Beach Bear", "guitar_strum");
    mv(t + BEAT, "Beach Bear", "torso_sway");
    mv(t, "Mitzi", "arm_swing");
    mv(t + BEAT, "Mitzi", "hip_sway");
    mv(t, "Fatz", "arm_right_raise");
    mv(t + BAR / 2, "Fatz", "keyboard_lean");
  }

  // Final bow — wind down 252000 – 259000
  mv(252000, "Rolfe", "body_lean");
  mv(252500, "Billy Bob", "arm_right_down");
  mv(253000, "Mitzi", "hand_wave");
  mv(253500, "Fatz", "torso_twist");
  mv(254000, "Beach Bear", "torso_sway");
  mv(254500, "Dook LaRue", "arm_down");
  mv(255000, "Rolfe", "arm_left_raise");
  mv(255500, "Earl", "eyebrow_raise");
  mv(256000, "Rolfe", "hand_pose");
  mv(257000, "Billy Bob", "head_left");
  mv(258000, "Mitzi", "hip_sway");
  mv(258500, "Earl", "head_tilt");

  seq.sort((a, b) => a.time - b.time);
  return seq;
}

const SHOWTAPES = {
  "come-together-mmbb": {
    title: "Come Together - MMBB Full Show",
    description:
      "Full-length, beat-synced show for 'Come Together' (4:16). Entire show performed by Munch's Make Believe Band with dense per-character choreography.",
    duration: 256000,
    bitrate: 600,
    band: "munch",
    sequences: buildComeTogetherFullShow("munch"),
  },
  "come-together-rfe": {
    title: "Come Together - RFE Full Show",
    description:
      "Full-length show for 'Come Together' by The Beatles (~4:19). Rock Afire Explosion with song-mapped choreography — load the WAV file for perfect sync. Each section follows the real song structure.",
    duration: 259000,
    bitrate: 600,
    band: "rock",
    sequences: buildComeTogetherRFESongMapped(),
  },
  "munch-welcome": {
    title: "Munch's Band Welcome",
    description:
      "Warm welcome from Munch's Make Believe Band. Each character greets the audience with coordinated movements.",
    duration: 8000,
    bitrate: 600,
    band: "munch",
    sequences: [
      // Chuck E. opens with a wave
      {
        time: 0,
        character: "Chuck E. Cheese",
        movement: "mouth",
        movement_display: "Mouth open",
        data: new Uint8Array([0xaa, 0x55, 0x40]),
      },
      {
        time: 200,
        character: "Chuck E. Cheese",
        movement: "wave",
        movement_display: "Wave gesture",
        data: new Uint8Array([0xff, 0x00, 0x41]),
      },
      // Munch starts strumming
      {
        time: 400,
        character: "Munch",
        movement: "strum_motion",
        movement_display: "Strum motion",
        data: new Uint8Array([0x66, 0x99, 0x80]),
      },
      // Helen Henny sways
      {
        time: 600,
        character: "Helen Henny",
        movement: "hip_sway",
        movement_display: "Hip sway",
        data: new Uint8Array([0xc3, 0x3c, 0xc0]),
      },
      // Jasper head turn
      {
        time: 800,
        character: "Jasper T. Jowls",
        movement: "head_left",
        movement_display: "Head turn left",
        data: new Uint8Array([0x0f, 0xf0, 0x5f]),
      },
      // Pasqually gesture
      {
        time: 1000,
        character: "Pasqually",
        movement: "hand_gesture",
        movement_display: "Chef gesture",
        data: new Uint8Array([0xff, 0x00, 0x7f]),
      },
      // All characters eye blink
      {
        time: 1400,
        character: "All",
        movement: "synchronized_blink",
        movement_display: "Synchronized blink",
        data: new Uint8Array([0x55, 0xaa, 0xff]),
      },
      // Chorus movement - all sway together
      {
        time: 2000,
        character: "All",
        movement: "torso_sway",
        movement_display: "Body sway",
        data: new Uint8Array([0xc3, 0x3c, 0xa5]),
      },
      // More synchronized movements
      {
        time: 2800,
        character: "All",
        movement: "foot_tap",
        movement_display: "Foot tap",
        data: new Uint8Array([0x5a, 0xa5, 0x3f]),
      },
      // Final pose - all characters arms up
      {
        time: 3600,
        character: "All",
        movement: "arm_raise",
        movement_display: "Arms raised",
        data: new Uint8Array([0xff, 0x00, 0xcc]),
      },
    ],
  },

  "rfe-action-sequence": {
    title: "Rock Afire Action Show",
    description:
      "The Rock Afire Explosion performs an energetic action sequence with complex character movements.",
    duration: 12000,
    bitrate: 600,
    band: "rock",
    sequences: [
      // Billy Bob guitar intro
      {
        time: 0,
        character: "Billy Bob",
        movement: "arm_right_strum",
        movement_display: "Guitar strum",
        data: new Uint8Array([0x66, 0x99, 0x40]),
      },
      {
        time: 300,
        character: "Billy Bob",
        movement: "head_left",
        movement_display: "Head rock left",
        data: new Uint8Array([0x0f, 0xf0, 0x41]),
      },
      // Fatz keyboard leads
      {
        time: 600,
        character: "Fatz",
        movement: "keyboard_lean",
        movement_display: "Keyboard lean",
        data: new Uint8Array([0xc3, 0x3c, 0x80]),
      },
      {
        time: 900,
        character: "Fatz",
        movement: "foot_bounce",
        movement_display: "Foot bounce",
        data: new Uint8Array([0x5a, 0xa5, 0x81]),
      },
      // Mitzi joins with hip sway
      {
        time: 1200,
        character: "Mitzi",
        movement: "hip_sway",
        movement_display: "Hip sway",
        data: new Uint8Array([0xc3, 0x3c, 0xc0]),
      },
      {
        time: 1500,
        character: "Mitzi",
        movement: "arm_swing",
        movement_display: "Arm swing",
        data: new Uint8Array([0xff, 0x00, 0xc1]),
      },
      // Beach Bear guitar solo
      {
        time: 1800,
        character: "Beach Bear",
        movement: "guitar_strum",
        movement_display: "Guitar strum",
        data: new Uint8Array([0x66, 0x99, 0x5f]),
      },
      {
        time: 2100,
        character: "Beach Bear",
        movement: "torso_sway",
        movement_display: "Torso sway",
        data: new Uint8Array([0xc3, 0x3c, 0x5e]),
      },
      // Dook drum hits
      {
        time: 2400,
        character: "Dook LaRue",
        movement: "arm_up",
        movement_display: "Drum hit (up)",
        data: new Uint8Array([0xff, 0x00, 0x3f]),
      },
      {
        time: 2600,
        character: "Dook LaRue",
        movement: "arm_down",
        movement_display: "Drum hit (down)",
        data: new Uint8Array([0xff, 0x00, 0x3e]),
      },
      {
        time: 2800,
        character: "Dook LaRue",
        movement: "wrist_flick",
        movement_display: "Stick flick",
        data: new Uint8Array([0x66, 0x99, 0x3d]),
      },
      // Rolfe vocals
      {
        time: 3200,
        character: "Rolfe",
        movement: "mouth",
        movement_display: "Vocal jaw",
        data: new Uint8Array([0xaa, 0x55, 0x7f]),
      },
      {
        time: 3500,
        character: "Rolfe",
        movement: "head_left",
        movement_display: "Head left",
        data: new Uint8Array([0x0f, 0xf0, 0x7e]),
      },
      {
        time: 3800,
        character: "Rolfe",
        movement: "arm_left_raise",
        movement_display: "Arm raise",
        data: new Uint8Array([0xff, 0x00, 0x7d]),
      },
      // All characters - synchronized rhythm section
      {
        time: 4400,
        character: "All",
        movement: "synchronized_beat",
        movement_display: "Beat sync",
        data: new Uint8Array([0x5a, 0xa5, 0xff]),
      },
      {
        time: 5000,
        character: "All",
        movement: "foot_tap",
        movement_display: "Foot tap",
        data: new Uint8Array([0x5a, 0xa5, 0xaa]),
      },
      // Bridge - complex interplay
      {
        time: 5600,
        character: "Billy Bob",
        movement: "body_lean",
        movement_display: "Body lean",
        data: new Uint8Array([0xc3, 0x3c, 0x40]),
      },
      {
        time: 6000,
        character: "Mitzi",
        movement: "wrist_rotate",
        movement_display: "Wrist rotate",
        data: new Uint8Array([0x66, 0x99, 0xc1]),
      },
      {
        time: 6400,
        character: "Dook LaRue",
        movement: "cymbal_reach",
        movement_display: "Cymbal reach",
        data: new Uint8Array([0xff, 0x00, 0x3c]),
      },
      // Finale - all crescendo
      {
        time: 7000,
        character: "All",
        movement: "final_pose",
        movement_display: "Final pose",
        data: new Uint8Array([0xaa, 0x55, 0xff]),
      },
      {
        time: 7800,
        character: "All",
        movement: "bow",
        movement_display: "Bow",
        data: new Uint8Array([0x55, 0xaa, 0xee]),
      },
    ],
  },

  "character-spotlight": {
    title: "Character Spotlight",
    description:
      "Individual character spotlights showing off each animatronic's possible movements in sequence.",
    duration: 10000,
    bitrate: 600,
    band: "munch",
    sequences: [
      // Chuck E. spotlight
      {
        time: 0,
        character: "Chuck E. Cheese",
        movement: "blink_left",
        movement_display: "Left blink",
        data: new Uint8Array([0x55, 0xaa, 0x40]),
      },
      {
        time: 300,
        character: "Chuck E. Cheese",
        movement: "head_left",
        movement_display: "Head left",
        data: new Uint8Array([0x0f, 0xf0, 0x41]),
      },
      {
        time: 600,
        character: "Chuck E. Cheese",
        movement: "arm_left_raise",
        movement_display: "Left arm up",
        data: new Uint8Array([0xff, 0x00, 0x42]),
      },
      // Munch spotlight
      {
        time: 1200,
        character: "Munch",
        movement: "mouth",
        movement_display: "Open mouth",
        data: new Uint8Array([0xaa, 0x55, 0x80]),
      },
      {
        time: 1500,
        character: "Munch",
        movement: "strum_motion",
        movement_display: "Strum",
        data: new Uint8Array([0x66, 0x99, 0x81]),
      },
      {
        time: 1800,
        character: "Munch",
        movement: "foot_tap",
        movement_display: "Foot tap",
        data: new Uint8Array([0x5a, 0xa5, 0x82]),
      },
      // Helen spotlight
      {
        time: 2400,
        character: "Helen Henny",
        movement: "blink_right",
        movement_display: "Right blink",
        data: new Uint8Array([0x55, 0xaa, 0xc0]),
      },
      {
        time: 2700,
        character: "Helen Henny",
        movement: "hand_gesture",
        movement_display: "Hand gesture",
        data: new Uint8Array([0xff, 0x00, 0xc1]),
      },
      {
        time: 3000,
        character: "Helen Henny",
        movement: "hip_sway",
        movement_display: "Hip sway",
        data: new Uint8Array([0xc3, 0x3c, 0xc2]),
      },
      // Jasper spotlight
      {
        time: 3600,
        character: "Jasper T. Jowls",
        movement: "mouth",
        movement_display: "Mouth open",
        data: new Uint8Array([0xaa, 0x55, 0x5f]),
      },
      {
        time: 3900,
        character: "Jasper T. Jowls",
        movement: "neck_sway",
        movement_display: "Neck sway",
        data: new Uint8Array([0xc3, 0x3c, 0x5e]),
      },
      {
        time: 4200,
        character: "Jasper T. Jowls",
        movement: "arm_right_up",
        movement_display: "Right arm up",
        data: new Uint8Array([0xff, 0x00, 0x5d]),
      },
      // Pasqually spotlight
      {
        time: 4800,
        character: "Pasqually",
        movement: "mouth",
        movement_display: "Mouth open",
        data: new Uint8Array([0xaa, 0x55, 0x7f]),
      },
      {
        time: 5100,
        character: "Pasqually",
        movement: "hand_gesture",
        movement_display: "Chef gesture",
        data: new Uint8Array([0xff, 0x00, 0x7e]),
      },
      {
        time: 5400,
        character: "Pasqually",
        movement: "body_lean",
        movement_display: "Body lean",
        data: new Uint8Array([0xc3, 0x3c, 0x7d]),
      },
      // All characters finale
      {
        time: 6200,
        character: "All",
        movement: "final_pose",
        movement_display: "Final pose",
        data: new Uint8Array([0xaa, 0x55, 0xff]),
      },
    ],
  },

  "test-movements": {
    title: "Movement Test Patterns",
    description:
      "Sequential test of different movement types to understand the signal patterns.",
    duration: 8000,
    bitrate: 600,
    band: "munch",
    sequences: [
      // Test all mouth movements
      {
        time: 0,
        character: "All",
        movement: "mouth",
        movement_display: "Mouth",
        data: new Uint8Array([0xaa, 0x55, 0xff]),
      },
      // Test blink patterns
      {
        time: 800,
        character: "All",
        movement: "blink_left",
        movement_display: "Blink left",
        data: new Uint8Array([0x55, 0xaa, 0xee]),
      },
      // Test head movements
      {
        time: 1600,
        character: "All",
        movement: "head_left",
        movement_display: "Head left",
        data: new Uint8Array([0x0f, 0xf0, 0xdd]),
      },
      // Test arm movements
      {
        time: 2400,
        character: "All",
        movement: "arm_left_raise",
        movement_display: "Arm up",
        data: new Uint8Array([0xff, 0x00, 0xcc]),
      },
      // Test body movements
      {
        time: 3200,
        character: "All",
        movement: "hip_sway",
        movement_display: "Sway",
        data: new Uint8Array([0xc3, 0x3c, 0xbb]),
      },
      // Test foot movements
      {
        time: 4000,
        character: "All",
        movement: "foot_tap",
        movement_display: "Foot tap",
        data: new Uint8Array([0x5a, 0xa5, 0xaa]),
      },
      // Complex pattern
      {
        time: 4800,
        character: "All",
        movement: "synchronized_sequence",
        movement_display: "Complex",
        data: new Uint8Array([0x33, 0xcc, 0x99]),
      },
    ],
  },
};

// Get showtape by ID
function getShowtape(id) {
  return SHOWTAPES[id];
}

// Get all showtape IDs
function getShowtapeList() {
  return Object.keys(SHOWTAPES).map((id) => ({
    id: id,
    title: SHOWTAPES[id].title,
  }));
}

// Get showtape metadata
function getShowtapeInfo(id) {
  const tape = SHOWTAPES[id];
  if (!tape) return null;
  return {
    id: id,
    title: tape.title,
    description: tape.description,
    duration: tape.duration,
    bitrate: tape.bitrate,
    band: tape.band,
    sequences: tape.sequences.length,
  };
}
