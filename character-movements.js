/**
 * Character Movement Catalog
 * Maps each character to their available movements based on animatronic type
 */

const CHARACTER_MOVEMENTS = {
  // Rock Afire Explosion Characters
  "Billy Bob": {
    band: "rock",
    movements: {
      mouth: "Jaw open/close",
      blink_left: "Left eyelid blink",
      blink_right: "Right eyelid blink",
      eye_left: "Look left",
      eye_right: "Look right",
      eye_center: "Look center",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_up: "Head tilt up",
      head_down: "Head tilt down",
      arm_right_up: "Right arm raise",
      arm_right_down: "Right arm lower",
      arm_right_strum: "Right arm strum/twist",
      arm_left_up: "Left arm raise",
      arm_left_down: "Left arm lower",
      guitar_up: "Guitar raise",
      guitar_down: "Guitar lower",
      body_lean: "Body lean",
      body_turn_left: "Body turn left",
      body_turn_right: "Body turn right",
      foot_tap: "Foot tap",
      leg_kick: "Leg kick",
    },
  },
  Fatz: {
    band: "rock",
    movements: {
      mouth: "Mouth open/close",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye left",
      eye_right: "Eye right",
      eye_center: "Eye center",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      shoulder_left: "Shoulder raise left",
      shoulder_right: "Shoulder raise right",
      arm_left_raise: "Arm raise left",
      arm_right_raise: "Arm raise right",
      arm_twist: "Arm twist/rotation",
      hand_pose: "Hand/finger pose",
      keyboard_lean: "Keyboard chest lean",
      foot_bounce: "Foot/hip bounce",
      torso_twist: "Upper torso twist",
    },
  },
  Mitzi: {
    band: "rock",
    movements: {
      mouth: "Jaw open/close",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Look left",
      eye_right: "Look right",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      shoulder_left: "Shoulder raise left",
      shoulder_right: "Shoulder raise right",
      arm_swing: "Arm swing",
      wrist_rotate: "Wrist rotation",
      hip_sway: "Hip sway",
      waist_sway: "Waist sway",
      hand_wave: "Wave gesture",
      hand_point: "Point gesture",
      foot_tap: "Foot tap",
    },
  },
  "Beach Bear": {
    band: "rock",
    movements: {
      mouth: "Mouth open/close",
      blink: "Eyelid blink",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_turn: "Head turn",
      head_tilt: "Head tilt",
      arm_raise: "Arm raise",
      guitar_strum: "Guitar strum",
      hand_gesture: "Hand gesture",
      torso_lean: "Torso lean",
      torso_sway: "Torso sway",
      foot_tap: "Foot tap",
      rhythm_bounce: "Rhythmic bounce",
    },
  },
  "Dook LaRue": {
    band: "rock",
    movements: {
      mouth: "Mouth open/close",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_nod: "Head nod",
      head_tilt: "Head tilt",
      torso_swivel: "Torso/waist swivel",
      arm_up: "Arm up (drum hit)",
      arm_down: "Arm down",
      wrist_flick: "Wrist/hand flick (stick)",
      cymbal_reach: "Cross-arm reach (cymbals)",
      foot_kick: "Foot kick",
      foot_tap: "Foot tap",
    },
  },
  Rolfe: {
    band: "rock",
    movements: {
      mouth: "Vocal jaw movement",
      ear_left_flick: "Left ear flick",
      ear_right_flick: "Right ear flick",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_up: "Head tilt up",
      arm_left_raise: "Left arm raise",
      arm_right_raise: "Right arm raise",
      elbow_left_bend: "Left elbow bend",
      elbow_right_bend: "Right elbow bend",
      arm_left_twist: "Left arm twist",
      arm_right_twist: "Right arm twist",
      body_twist_left: "Body twist left",
      body_twist_right: "Body twist right",
      body_lean: "Body lean",
      hand_pose: "Hand pose",
    },
  },
  Earl: {
    band: "rock",
    movements: {
      head_tilt: "Head tilt",
      mouth: "Jaw movement",
      eyebrow_raise: "Eyebrow raise",
      eye_look: "Eye look direction",
    },
  },

  // Munch's Make Believe Band Characters
  "Chuck E. Cheese": {
    band: "munch",
    movements: {
      mouth: "Mouth/jaw open-close",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      arm_left_raise: "Left arm raise",
      arm_right_raise: "Right arm raise",
      wave: "Wave gesture",
      body_lean: "Body lean",
      hip_sway: "Hip sway",
      hand_gesture: "Hand gesture",
    },
  },
  Munch: {
    band: "munch",
    movements: {
      mouth: "Mouth/jaw",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      arm_left_raise: "Left arm raise",
      arm_right_raise: "Right arm raise",
      strum_motion: "Strum motion",
      hip_sway: "Hip/torso sway",
      foot_tap: "Foot tap",
    },
  },
  "Helen Henny": {
    band: "munch",
    movements: {
      mouth: "Mouth/jaw",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      arm_left_raise: "Left arm raise",
      arm_right_raise: "Right arm raise",
      hand_gesture: "Hand gesture (dance)",
      hip_sway: "Hip sway",
      torso_move: "Torso movement",
      foot_tap: "Foot/leg tap",
    },
  },
  "Jasper T. Jowls": {
    band: "munch",
    movements: {
      mouth: "Mouth/jaw open-close",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_left: "Head turn left",
      head_right: "Head turn right",
      neck_sway: "Neck side-to-side",
      arm_right_up: "Right arm up",
      arm_right_down: "Right arm down",
      arm_left_strum: "Left arm strum",
      arm_side_to_side: "Arm side to side",
      foot_stomp: "Foot stomp",
      foot_tap: "Foot tap",
      torso_shift: "Torso shift",
      torso_sway: "Torso sway",
    },
  },
  Pasqually: {
    band: "munch",
    movements: {
      mouth: "Mouth/jaw",
      blink_left: "Left eyelid",
      blink_right: "Right eyelid",
      eye_left: "Eye look left",
      eye_right: "Eye look right",
      head_left: "Head turn left",
      head_right: "Head turn right",
      head_tilt: "Head tilt",
      arm_left_raise: "Left arm raise",
      arm_right_raise: "Right arm raise",
      hand_gesture: "Chef-style gesture",
      body_lean: "Body lean",
      torso_move: "Torso movement",
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
