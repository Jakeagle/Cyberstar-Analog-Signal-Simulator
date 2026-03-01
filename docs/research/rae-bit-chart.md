# RAE Bit Chart — Actuator Channel Map Reference

This page documents the complete Rock-Afire Explosion actuator channel assignments for both the TD and BD control tracks. The primary source is `RAE_Bit_Chart_2.pdf`, cross-referenced with `archive.org/details/rae-2000s-adjustment`.

All bit numbers on this page are **1-based** (as they appear in the PDF). In code (`character-movements.js`, `constants.py`), subtract 1 for JavaScript 0-based indexing, or use the dict values directly for Python 1-based values.

---

## Track TD — 94 channels

Bytes 1–11 of every TD frame, MSB-first (bit 1 = MSB of byte 1).

### Rolfe (Lead guitarist / vocalist)

| Bit | Channel name            | Notes          |
| --- | ----------------------- | -------------- |
| 1   | rolfe_mouth             | Jaw open/close |
| 2   | rolfe_left_eyelid       |                |
| 3   | rolfe_right_eyelid      |                |
| 4   | rolfe_eyes_left         |                |
| 5   | rolfe_eyes_right        |                |
| 6   | rolfe_head_left         |                |
| 7   | rolfe_head_right        |                |
| 8   | rolfe_head_up           |                |
| 9   | rolfe_left_ear          |                |
| 10  | rolfe_right_ear         |                |
| 11  | rolfe_left_arm_raise    |                |
| 12  | rolfe_left_arm_twist    |                |
| 13  | rolfe_left_elbow        |                |
| 14  | rolfe_body_twist_left   |                |
| 15  | rolfe_body_twist_right  |                |
| 16  | rolfe_body_lean         |                |
| 17  | rolfe_right_arm_raise   |                |
| 18  | rolfe_right_arm_twist   |                |
| 19  | rolfe_right_elbow_twist |                |

### Dook LaRue (Drummer / bassist)

| Bit | Channel name                                            |
| --- | ------------------------------------------------------- |
| 20  | rolfe_earl_head_tilt _(Earl rides on Rolfe's shoulder)_ |
| 21  | duke_head_right                                         |
| 22  | duke_head_up                                            |
| 23  | duke_left_ear                                           |
| 24  | duke_right_ear                                          |
| 25  | duke_head_left                                          |
| 26  | duke_left_eyelid                                        |
| 27  | duke_right_eyelid                                       |
| 28  | duke_eyes_left                                          |
| 29  | duke_eyes_right                                         |
| 30  | duke_mouth                                              |
| 31  | duke_right_elbow                                        |
| 32  | duke_left_foot_hihat                                    |
| 33  | duke_left_arm_swing                                     |
| 34  | duke_right_arm_swing                                    |
| 35  | duke_left_elbow                                         |

### Earl (On Rolfe's shoulder)

| Bit | Channel name |
| --- | ------------ |
| 36  | earl_mouth   |
| 37  | earl_eyebrow |

### Props / Specials (Stage)

| Bit | Channel name              |
| --- | ------------------------- |
| 38  | props_sun_mouth           |
| 39  | props_sun_raise           |
| 40  | specials_dual_pressure_td |

### Fatz (Keyboard player)

| Bit    | Channel name                    |
| ------ | ------------------------------- |
| 41     | fats_left_eyelid                |
| 42     | fats_right_eyelid               |
| 43     | fats_eyes_left                  |
| 44     | fats_eyes_right                 |
| 45     | fats_mouth                      |
| 46     | props_moon_mouth                |
| 47     | props_moon_raise                |
| 48     | props_looney_bird_hands         |
| 49     | props_antioch_down              |
| 50     | props_baby_bear_raise           |
| 51     | fats_head_tip_left              |
| 52     | fats_head_tip_right             |
| 53     | fats_head_up                    |
| 54     | fats_head_left                  |
| 55     | fats_head_right                 |
| **56** | **BLANK — reserved, must be 0** |
| 57     | fats_left_arm_swing             |
| 58     | fats_right_arm_swing            |
| 59     | fats_left_elbow                 |
| 60     | fats_right_elbow                |
| 61     | fats_foot_tap                   |
| 62     | fats_body_lean                  |
| 63     | duke_right_foot_bass_drum       |
| 64     | duke_body_lean                  |
| **65** | **BLANK — reserved, must be 0** |

### Organ / Stage Lighting

| Bit    | Channel name                    |
| ------ | ------------------------------- |
| 66     | organ_top_blue                  |
| 67     | organ_top_red                   |
| 68     | organ_top_amber                 |
| 69     | organ_top_green                 |
| **70** | **BLANK — reserved, must be 0** |
| 71     | organ_leg_top                   |
| 72     | organ_leg_mid                   |
| 73     | organ_leg_bottom                |
| 74     | organ_cont_strobe               |
| 75     | organ_flash_strobe              |

### Sign Lighting

| Bit | Channel name      |
| --- | ----------------- |
| 76  | sign_inner        |
| 77  | sign_mid          |
| 78  | sign_outer        |
| 79  | sign_cont_strobe  |
| 80  | sign_flash_strobe |

### Spotlights

| Bit | Channel name     |
| --- | ---------------- |
| 81  | spot_mitzi       |
| 82  | spot_beach_bear  |
| 83  | spot_looney_bird |
| 84  | spot_billy_bob   |
| 85  | spot_fats        |
| 86  | spot_duke        |
| 87  | spot_rolfe       |
| 88  | spot_earl        |

### Curtains

| Bit | Channel name               |
| --- | -------------------------- |
| 89  | curtain_stage_right_open   |
| 90  | curtain_stage_right_close  |
| 91  | curtain_center_stage_open  |
| 92  | curtain_center_stage_close |
| 93  | curtain_stage_left_open    |
| 94  | curtain_stage_left_close   |

---

## Track BD — 96 channels

Bytes 1–12 of every BD frame, MSB-first.

### Beach Bear

| Bit | Channel name                |
| --- | --------------------------- |
| 1   | beachbear_left_eyelid       |
| 2   | beachbear_right_eyelid      |
| 3   | beachbear_eye_cross         |
| 4   | beachbear_left_hand_slide   |
| 5   | beachbear_guitar_raise      |
| 6   | beachbear_head_left         |
| 7   | beachbear_head_right        |
| 8   | beachbear_head_up           |
| 9   | beachbear_left_leg_kick     |
| 10  | beachbear_right_leg_kick    |
| 11  | beachbear_right_arm_raise   |
| 12  | beachbear_right_arm_twist   |
| 13  | beachbear_right_elbow_twist |
| 14  | beachbear_right_wrist       |
| 15  | beachbear_body_lean         |
| 16  | beachbear_mouth             |

### Looney Bird / Mitzi

| Bit | Channel name          |
| --- | --------------------- |
| 17  | looneybird_mouth      |
| 18  | mitzi_right_arm_raise |
| 19  | mitzi_right_elbow     |
| 20  | mitzi_right_arm_twist |
| 21  | looneybird_head_right |
| 22  | looneybird_raise      |
| 23  | mitzi_right_wrist     |
| 24  | mitzi_left_arm_raise  |
| 25  | mitzi_left_elbow      |
| 26  | mitzi_left_arm_twist  |
| 27  | mitzi_body_lean       |
| 28  | mitzi_mouth           |
| 29  | mitzi_head_left       |
| 30  | mitzi_head_right      |

### Billy Bob

| Bit    | Channel name                                  |
| ------ | --------------------------------------------- |
| 31-45  | billy*bob*\* (see constants.py for full list) |
| **45** | **BLANK — reserved, must be 0**               |

> See `SCME/SMM/constants.py` → `BD_CHANNELS` dictionary for the complete authoritative list with exact bit numbers.

---

## Important Notes

1. All bit numbers in this page are **1-based** (as in the PDF).
2. Convert to 0-based for JavaScript array indexing (subtract 1).
3. Blank bits (TD: 56, 65, 70; BD: 45) must **never** be set to `1`.
4. The character names "Dook LaRue" (in show timeline) and "Duke" (in hardware channel names) refer to the same character. The hardware names use the informal spelling "duke".
