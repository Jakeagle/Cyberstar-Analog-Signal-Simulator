/**
 * Character Movement Catalog v3.2.3 - Complete RAE Bitmap
 * Maps each character movement to its specific data track (TD/BD) and bit index.
 * Bit indices are 0-indexed (subtract 1 from the 1-based spec).
 * Source: RAE_Bit_Chart.md (Rock-afire Explosion full channel mapping)
 */

const CHARACTER_MOVEMENTS = {
  // --- ROLFE & EARL (Track TD) ---
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
      earl_head_tilt: { track: "TD", bit: 19 },
    },
  },
  Earl: {
    movements: {
      head_tilt: { track: "TD", bit: 19 },
      mouth: { track: "TD", bit: 35 },
      eyebrow: { track: "TD", bit: 36 },
    },
  },

  // --- DOOK LARUE (Track TD) ---
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

  // --- FATZ (Track TD) ---
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

  // --- PROPS & SPECIALS (Track TD) ---
  Props: {
    movements: {
      sun_mouth: { track: "TD", bit: 37 },
      sun_raise: { track: "TD", bit: 38 },
      moon_mouth: { track: "TD", bit: 45 },
      moon_raise: { track: "TD", bit: 46 },
      looney_bird_hands: { track: "TD", bit: 47 },
      antioch_down: { track: "TD", bit: 48 },
      baby_bear_raise: { track: "TD", bit: 49 },
    },
  },

  // --- ORGAN LIGHTS (Track TD) ---
  "Organ Lights": {
    movements: {
      top_blue: { track: "TD", bit: 65 },
      top_red: { track: "TD", bit: 66 },
      top_amber: { track: "TD", bit: 67 },
      top_green: { track: "TD", bit: 68 },
      leg_top: { track: "TD", bit: 70 },
      leg_mid: { track: "TD", bit: 71 },
      leg_bottom: { track: "TD", bit: 72 },
      cont_strobe: { track: "TD", bit: 73 },
      flash_strobe: { track: "TD", bit: 74 },
    },
  },

  // --- SIGN LIGHTS (Track TD) ---
  "Sign Lights": {
    movements: {
      inner: { track: "TD", bit: 75 },
      mid: { track: "TD", bit: 76 },
      outer: { track: "TD", bit: 77 },
      cont_strobe: { track: "TD", bit: 78 },
      flash_strobe: { track: "TD", bit: 79 },
    },
  },

  // --- SPOTLIGHTS (Track TD) ---
  "Stage Spotlights": {
    movements: {
      mitzi: { track: "TD", bit: 80 },
      beach_bear: { track: "TD", bit: 81 },
      looney_bird: { track: "TD", bit: 82 },
      billy_bob: { track: "TD", bit: 83 },
      fatz: { track: "TD", bit: 84 },
      duke: { track: "TD", bit: 85 },
      rolfe: { track: "TD", bit: 86 },
      earl: { track: "TD", bit: 87 },
    },
  },

  // --- CURTAINS (Track TD) ---
  Curtains: {
    movements: {
      stage_right_open: { track: "TD", bit: 88 },
      stage_right_close: { track: "TD", bit: 89 },
      center_stage_open: { track: "TD", bit: 90 },
      center_stage_close: { track: "TD", bit: 91 },
      stage_left_open: { track: "TD", bit: 92 },
      stage_left_close: { track: "TD", bit: 93 },
    },
  },

  // --- UNIFIED LIGHTS (for show builder AI) ---
  // Includes all light controls for SAM (show analysis module) automation
  Lights: {
    movements: {
      // Props (TD track)
      sun_mouth: { track: "TD", bit: 37 },
      sun_raise: { track: "TD", bit: 38 },
      moon_mouth: { track: "TD", bit: 45 },
      moon_raise: { track: "TD", bit: 46 },
      looney_bird_hands: { track: "TD", bit: 47 },
      antioch_down: { track: "TD", bit: 48 },
      baby_bear_raise: { track: "TD", bit: 49 },
      // Organ Lights (TD track)
      organ_top_blue: { track: "TD", bit: 65 },
      organ_top_red: { track: "TD", bit: 66 },
      organ_top_amber: { track: "TD", bit: 67 },
      organ_top_green: { track: "TD", bit: 68 },
      organ_leg_top: { track: "TD", bit: 70 },
      organ_leg_mid: { track: "TD", bit: 71 },
      organ_leg_bottom: { track: "TD", bit: 72 },
      organ_cont_strobe: { track: "TD", bit: 73 },
      organ_flash_strobe: { track: "TD", bit: 74 },
      // Sign Lights (TD track)
      sign_inner: { track: "TD", bit: 75 },
      sign_mid: { track: "TD", bit: 76 },
      sign_outer: { track: "TD", bit: 77 },
      sign_cont_strobe: { track: "TD", bit: 78 },
      sign_flash_strobe: { track: "TD", bit: 79 },
      // Spotlights (TD track)
      spotlight_mitzi: { track: "TD", bit: 80 },
      spotlight_beach: { track: "TD", bit: 81 },
      spotlight_looney: { track: "TD", bit: 82 },
      spotlight_bob: { track: "TD", bit: 83 },
      spotlight_fatz: { track: "TD", bit: 84 },
      spotlight_duke: { track: "TD", bit: 85 },
      spotlight_rolfe: { track: "TD", bit: 86 },
      spotlight_earl: { track: "TD", bit: 87 },
      // Curtains (TD track)
      curtain_stage_right_open: { track: "TD", bit: 88 },
      curtain_stage_right_close: { track: "TD", bit: 89 },
      curtain_center_stage_open: { track: "TD", bit: 90 },
      curtain_center_stage_close: { track: "TD", bit: 91 },
      curtain_stage_left_open: { track: "TD", bit: 92 },
      curtain_stage_left_close: { track: "TD", bit: 93 },
      // Tape Control (BD track)
      tape_stop: { track: "BD", bit: 63 },
      tape_rewind: { track: "BD", bit: 64 },
      // Flood Lights (BD track)
      flood_stage_right_blue: { track: "BD", bit: 65 },
      flood_stage_right_green: { track: "BD", bit: 66 },
      flood_stage_right_amber: { track: "BD", bit: 67 },
      flood_stage_right_red: { track: "BD", bit: 68 },
      flood_center_stage_blue: { track: "BD", bit: 70 },
      flood_center_stage_green: { track: "BD", bit: 71 },
      flood_center_stage_amber: { track: "BD", bit: 72 },
      flood_center_stage_red: { track: "BD", bit: 73 },
      flood_stage_left_blue: { track: "BD", bit: 75 },
      flood_stage_left_green: { track: "BD", bit: 76 },
      flood_stage_left_amber: { track: "BD", bit: 77 },
      flood_stage_left_red: { track: "BD", bit: 78 },
      // Property Lights (BD track)
      prop_light_applause: { track: "BD", bit: 69 },
      prop_light_drums: { track: "BD", bit: 74 },
      prop_light_fire_still: { track: "BD", bit: 79 },
      prop_light_gas_pump: { track: "BD", bit: 90 },
      // Scenic Lights (BD track)
      flood_backdrop_outside_blue: { track: "BD", bit: 80 },
      flood_backdrop_inside_amber: { track: "BD", bit: 81 },
      flood_treeline_blue: { track: "BD", bit: 82 },
      flood_backdrop_inside_blue: { track: "BD", bit: 83 },
      flood_treeline_red: { track: "BD", bit: 84 },
      flood_bushes_green: { track: "BD", bit: 85 },
      flood_bushes_red_amber: { track: "BD", bit: 86 },
      // Spotlights BD (BD track)
      spotlight_sun: { track: "BD", bit: 87 },
      spotlight_moon: { track: "BD", bit: 88 },
      spotlight_spider: { track: "BD", bit: 89 },
      spotlight_guitar: { track: "BD", bit: 95 },
      // Service Lights (BD track)
      stage_light_service_stn_red: { track: "BD", bit: 91 },
      stage_light_service_stn_blue: { track: "BD", bit: 92 },
      stage_light_rainbow_1_red: { track: "BD", bit: 93 },
      stage_light_rainbow_2_yellow: { track: "BD", bit: 94 },
    },
  },

  // --- BEACH BEAR (Track BD) ---
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

  // --- LOONEY BIRD (Track BD) ---
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

  // --- MITZI (Track BD) ---
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

  // --- BILLY BOB (Track BD) ---
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

  // --- TAPE CONTROL (Track BD) ---
  "Tape Control": {
    movements: {
      stop: { track: "BD", bit: 63 },
      rewind: { track: "BD", bit: 64 },
    },
  },

  // --- FLOOD LIGHTS (Track BD) ---
  "Flood Lights - Stage Right": {
    movements: {
      blue: { track: "BD", bit: 65 },
      green: { track: "BD", bit: 66 },
      amber: { track: "BD", bit: 67 },
      red: { track: "BD", bit: 68 },
    },
  },
  "Flood Lights - Center Stage": {
    movements: {
      blue: { track: "BD", bit: 70 },
      green: { track: "BD", bit: 71 },
      amber: { track: "BD", bit: 72 },
      red: { track: "BD", bit: 73 },
    },
  },
  "Flood Lights - Stage Left": {
    movements: {
      blue: { track: "BD", bit: 75 },
      green: { track: "BD", bit: 76 },
      amber: { track: "BD", bit: 77 },
      red: { track: "BD", bit: 78 },
    },
  },
  "Backdrop & Scenic Lights": {
    movements: {
      backdrop_outside_blue: { track: "BD", bit: 80 },
      backdrop_inside_amber: { track: "BD", bit: 81 },
      treeline_blue: { track: "BD", bit: 82 },
      backdrop_inside_blue: { track: "BD", bit: 83 },
      treeline_red: { track: "BD", bit: 84 },
      bushes_green: { track: "BD", bit: 85 },
      bushes_red_amber: { track: "BD", bit: 86 },
    },
  },

  // --- PROPERTY & SERVICE LIGHTS (Track BD) ---
  "Property Lights": {
    movements: {
      applause: { track: "BD", bit: 69 },
      drums: { track: "BD", bit: 74 },
      fire_still: { track: "BD", bit: 79 },
      gas_pump: { track: "BD", bit: 90 },
    },
  },
  "Service Lights": {
    movements: {
      service_station_red: { track: "BD", bit: 91 },
      service_station_blue: { track: "BD", bit: 92 },
      rainbow_1_red: { track: "BD", bit: 93 },
      rainbow_2_yellow: { track: "BD", bit: 94 },
    },
  },

  // --- STAGE SPOTLIGHTS (Track BD) ---
  "Stage Spotlights BD": {
    movements: {
      sun: { track: "BD", bit: 87 },
      moon: { track: "BD", bit: 88 },
      spider: { track: "BD", bit: 89 },
      guitar: { track: "BD", bit: 95 },
    },
  },

  // --- MMBB (Munch's Make Believe Band) Characters ---
  // These are placeholder mappings for MMBB simulation
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
