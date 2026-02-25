/**
 * Character Movement Catalog v2.0 - Official RFE Bitmap
 * Maps each character movement to its specific data track (TD/BD) and bit index.
 * Bit indices are 0-indexed (subtract 1 from the 1-based spec).
 */

const CHARACTER_MOVEMENTS = {
  // --- Track TD (Left Channel) ---
  Rolfe: {
    movements: {
      mouth: { track: "TD", bit: 0 },
      eyelid_left: { track: "TD", bit: 1 },
      eyelid_right: { track: "TD", bit: 2 },
      eye_left: { track: "TD", bit: 3 },
      eye_right: { track: "TD", bit: 4 },
      head_left: { track: "TD", bit: 5 },
      head_right: { track: "TD", bit: 6 },
      head_up: { track: "TD", bit: 7 },
      ear_left: { track: "TD", bit: 8 },
      ear_right: { track: "TD", bit: 9 },
      arm_left_raise: { track: "TD", bit: 10 },
      arm_left_twist: { track: "TD", bit: 11 },
      elbow_left: { track: "TD", bit: 12 },
      body_twist_left: { track: "TD", bit: 13 },
      body_twist_right: { track: "TD", bit: 14 },
      body_lean: { track: "TD", bit: 15 },
      arm_right_raise: { track: "TD", bit: 16 },
      arm_right_twist: { track: "TD", bit: 17 },
      elbow_right_twist: { track: "TD", bit: 18 },
    },
  },
  Earl: {
    movements: {
      head_tilt: { track: "TD", bit: 19 },
      mouth: { track: "TD", bit: 35 },
      eyebrow: { track: "TD", bit: 36 },
    },
  },
  "Dook LaRue": {
    movements: {
      head_right: { track: "TD", bit: 20 },
      head_up: { track: "TD", bit: 21 },
      ear_left: { track: "TD", bit: 22 },
      ear_right: { track: "TD", bit: 23 },
      head_left: { track: "TD", bit: 24 },
      eyelid_left: { track: "TD", bit: 25 },
      eyelid_right: { track: "TD", bit: 26 },
      eye_left: { track: "TD", bit: 27 },
      eye_right: { track: "TD", bit: 28 },
      mouth: { track: "TD", bit: 29 },
      elbow_right: { track: "TD", bit: 30 },
      hi_hat: { track: "TD", bit: 31 },
      arm_left_swing: { track: "TD", bit: 32 },
      arm_right_swing: { track: "TD", bit: 33 },
      elbow_left: { track: "TD", bit: 34 },
      bass_drum: { track: "TD", bit: 62 },
      body_lean: { track: "TD", bit: 63 },
    },
  },
  Fatz: {
    movements: {
      eyelid_left: { track: "TD", bit: 40 },
      eyelid_right: { track: "TD", bit: 41 },
      eye_left: { track: "TD", bit: 42 },
      eye_right: { track: "TD", bit: 43 },
      mouth: { track: "TD", bit: 44 },
      head_tip_left: { track: "TD", bit: 50 },
      head_tip_right: { track: "TD", bit: 51 },
      head_up: { track: "TD", bit: 52 },
      head_left: { track: "TD", bit: 53 },
      head_right: { track: "TD", bit: 54 },
      arm_left_swing: { track: "TD", bit: 56 },
      arm_right_swing: { track: "TD", bit: 57 },
      elbow_left: { track: "TD", bit: 58 },
      elbow_right: { track: "TD", bit: 59 },
      foot_tap: { track: "TD", bit: 60 },
      body_lean: { track: "TD", bit: 61 },
    },
  },

  // --- Track BD (Right Channel) ---
  "Beach Bear": {
    movements: {
      eyelid_left: { track: "BD", bit: 0 },
      eyelid_right: { track: "BD", bit: 1 },
      eye_cross: { track: "BD", bit: 2 },
      hand_left_slide: { track: "BD", bit: 3 },
      guitar_raise: { track: "BD", bit: 4 },
      head_left: { track: "BD", bit: 5 },
      head_right: { track: "BD", bit: 6 },
      head_up: { track: "BD", bit: 7 },
      leg_left_kick: { track: "BD", bit: 8 },
      leg_right_kick: { track: "BD", bit: 9 },
      arm_right_raise: { track: "BD", bit: 10 },
      arm_right_twist: { track: "BD", bit: 11 },
      elbow_right_twist: { track: "BD", bit: 12 },
      wrist_right: { track: "BD", bit: 13 },
      body_lean: { track: "BD", bit: 14 },
      mouth: { track: "BD", bit: 15 },
    },
  },
  "Looney Bird": {
    movements: {
      mouth: { track: "BD", bit: 16 },
      head_right: { track: "BD", bit: 20 },
      raise: { track: "BD", bit: 21 },
      eyelid_left: { track: "BD", bit: 40 },
      eyelid_right: { track: "BD", bit: 41 },
      eye_cross: { track: "BD", bit: 42 },
    },
  },
  Mitzi: {
    movements: {
      arm_right_raise: { track: "BD", bit: 17 },
      elbow_right: { track: "BD", bit: 18 },
      arm_right_twist: { track: "BD", bit: 19 },
      arm_left_raise: { track: "BD", bit: 22 },
      elbow_left: { track: "BD", bit: 23 },
      arm_left_twist: { track: "BD", bit: 24 },
      ear_left: { track: "BD", bit: 25 },
      ear_right: { track: "BD", bit: 26 },
      head_left: { track: "BD", bit: 27 },
      head_right: { track: "BD", bit: 28 },
      head_up: { track: "BD", bit: 29 },
      eyelid_left: { track: "BD", bit: 30 },
      eyelid_right: { track: "BD", bit: 31 },
      eye_left: { track: "BD", bit: 32 },
      eye_right: { track: "BD", bit: 33 },
      mouth: { track: "BD", bit: 34 },
      body_twist_left: { track: "BD", bit: 35 },
      body_twist_right: { track: "BD", bit: 36 },
      body_lean: { track: "BD", bit: 37 },
    },
  },
  "Billy Bob": {
    movements: {
      arm_left_slide: { track: "BD", bit: 38 },
      guitar_raise: { track: "BD", bit: 39 },
      foot_tap: { track: "BD", bit: 43 },
      mouth: { track: "BD", bit: 45 },
      eyelid_left: { track: "BD", bit: 46 },
      eyelid_right: { track: "BD", bit: 47 },
      eye_left: { track: "BD", bit: 48 },
      eye_right: { track: "BD", bit: 49 },
      head_left: { track: "BD", bit: 50 },
      head_right: { track: "BD", bit: 51 },
      head_tip_left: { track: "BD", bit: 52 },
      head_tip_right: { track: "BD", bit: 53 },
      head_up: { track: "BD", bit: 54 },
      arm_right_raise: { track: "BD", bit: 55 },
      arm_right_twist: { track: "BD", bit: 56 },
      elbow_right_twist: { track: "BD", bit: 57 },
      wrist_right: { track: "BD", bit: 58 },
      body_twist_left: { track: "BD", bit: 60 },
      body_twist_right: { track: "BD", bit: 61 },
      body_lean: { track: "BD", bit: 62 },
    },
  },

  // --- Specials / Lights ---
  Lights: {
    movements: {
      sun_mouth: { track: "TD", bit: 37 },
      sun_raise: { track: "TD", bit: 38 },
      moon_mouth: { track: "TD", bit: 45 },
      moon_raise: { track: "TD", bit: 46 },
      looney_bird_hands: { track: "TD", bit: 47 },
      antioch_down: { track: "TD", bit: 48 },
      baby_bear_raise: { track: "TD", bit: 49 },
      spotlight_mitzi: { track: "TD", bit: 80 },
      spotlight_beach: { track: "TD", bit: 81 },
      spotlight_looney: { track: "TD", bit: 82 },
      spotlight_bob: { track: "TD", bit: 83 },
      spotlight_fats: { track: "TD", bit: 84 },
      spotlight_duke: { track: "TD", bit: 85 },
      spotlight_rolfe: { track: "TD", bit: 86 },
      spotlight_earl: { track: "TD", bit: 87 },
    },
  },

  // --- MMBB Characters (Mock Mapping for Sim) ---
  "Chuck E. Cheese": {
    movements: {
      mouth: { track: "TD", bit: 0 },
      head_left: { track: "TD", bit: 1 },
      head_right: { track: "TD", bit: 2 },
      head_up: { track: "TD", bit: 3 },
      eyelid_left: { track: "TD", bit: 4 },
      eyelid_right: { track: "TD", bit: 5 },
      arm_left_raise: { track: "TD", bit: 6 },
      arm_right_raise: { track: "TD", bit: 7 },
    },
  },
  Munch: {
    movements: {
      mouth: { track: "TD", bit: 10 },
      head_left: { track: "TD", bit: 11 },
      head_right: { track: "TD", bit: 12 },
      arm_left_raise: { track: "TD", bit: 13 },
      arm_right_raise: { track: "TD", bit: 14 },
    },
  },
  "Helen Henny": {
    movements: {
      mouth: { track: "BD", bit: 0 },
      head_left: { track: "BD", bit: 1 },
      head_right: { track: "BD", bit: 2 },
      arm_left_raise: { track: "BD", bit: 3 },
      arm_right_raise: { track: "BD", bit: 4 },
    },
  },
  "Jasper T. Jowls": {
    movements: {
      mouth: { track: "BD", bit: 10 },
      head_left: { track: "BD", bit: 11 },
      head_right: { track: "BD", bit: 12 },
      arm_left_raise: { track: "BD", bit: 13 },
      arm_right_raise: { track: "BD", bit: 14 },
    },
  },
  Pasqually: {
    movements: {
      mouth: { track: "BD", bit: 20 },
      head_left: { track: "BD", bit: 21 },
      head_right: { track: "BD", bit: 22 },
      arm_left_raise: { track: "BD", bit: 23 },
      arm_right_raise: { track: "BD", bit: 24 },
    },
  },
};

/**
 * Get all movements for a specific character
 */
function getCharacterMovements(characterName) {
  return CHARACTER_MOVEMENTS[characterName] || null;
}

/**
 * Get all characters in a band
 */
function getCharactersByBand(bandName) {
  return Object.keys(CHARACTER_MOVEMENTS).filter(
    (name) => CHARACTER_MOVEMENTS[name].band === bandName,
  );
}

/**
 * Get movement key from character and movement name
 */
function getMovementKey(characterName, movementName) {
  const character = CHARACTER_MOVEMENTS[characterName];
  if (!character) return null;

  for (const [key, value] of Object.entries(character.movements)) {
    if (value === movementName) return key;
  }
  return null;
}
