# =============================================================================
# constants.py — SMM Hardware Constants and Channel Maps
# =============================================================================
#
# ALL values in this file are KWS-confirmed (4 WAV files, 8 channels, 89.3%
# mean BMC run-length coverage). DO NOT change these without new KWS evidence.
#
# Source: RAE_Bit_Chart_2.pdf + cross-validated via archive.org/details/rae-2000s-adjustment

# -----------------------------------------------------------------------------
# CYBERSTAR / RAE HARDWARE TIMING  (System 1)
# -----------------------------------------------------------------------------

SAMPLE_RATE   = 44_100          # Hz — native Cyberstar hardware sample rate (KWS-confirmed)
BAUD_RATE     = 4_800           # baud — KWS-confirmed via run-length bimodal analysis
SAMPLES_PER_BIT = SAMPLE_RATE // BAUD_RATE  # = 9  (floor of 9.1875 — MUST stay integer)
# NOTE: The true ratio is 9.1875. The hardware uses a fixed 9-sample grid.
#       Fractional accumulation would cause signal drift and SPTE rejection.
#       int() / floor division is the correct operation here — never round().

# BMC half-period split for 9-sample bit periods:
#   First half  = 4 samples  (9 // 2)
#   Second half = 5 samples  (9 - 4)
# An odd period is a hardware reality, not a bug. The hardware tolerates it.
BMC_HALF_A = SAMPLES_PER_BIT // 2        # = 4
BMC_HALF_B = SAMPLES_PER_BIT - BMC_HALF_A  # = 5

# PCM amplitude levels for the BMC square wave (16-bit signed)
BMC_HIGH =  32767
BMC_LOW  = -32768

# Idle frame value (no actuators active, sync bit only — see frame builder)
# Transmitted continuously between show events to keep the decoder locked.
IDLE_FRAME_TD = 0b00000000   # All bits off — sync held by encoder
IDLE_FRAME_BD = 0b00000000


# -----------------------------------------------------------------------------
# SPTE / RR-ENGINE TIMING  (System 2) — SEPARATE from System 1
# -----------------------------------------------------------------------------
# Sample rate confirmed: 44,100 Hz (SPTE only accepts 44.1kHz WAV input).
# Baud rate and encoding: TBD — awaiting RR-engine documentation.
# DO NOT reuse BAUD_RATE or SAMPLES_PER_BIT from System 1 until confirmed.

SPTE_SAMPLE_RATE = 44_100   # Hz — confirmed by SPTE WAV ingest requirement
SPTE_BAUD_RATE   = None     # TBD
SPTE_SAMPLES_PER_BIT = None # TBD


# -----------------------------------------------------------------------------
# TD TRACK CHANNEL MAP  (94 channels)
# Source: RAE_Bit_Chart_2.pdf
# Key   = human-readable channel name
# Value = 1-based RAE bit number (the position in the 94-bit TD frame)
# BLANK entries are real physical slots that must remain 0 (reserved hardware).
# -----------------------------------------------------------------------------
TD_CHANNELS = {
    # ── Rolfe ─────────────────────────────────────────────────────────────
    "rolfe_mouth":                1,
    "rolfe_left_eyelid":          2,
    "rolfe_right_eyelid":         3,
    "rolfe_eyes_left":            4,
    "rolfe_eyes_right":           5,
    "rolfe_head_left":            6,
    "rolfe_head_right":           7,
    "rolfe_head_up":              8,
    "rolfe_left_ear":             9,
    "rolfe_right_ear":            10,
    "rolfe_left_arm_raise":       11,
    "rolfe_left_arm_twist":       12,
    "rolfe_left_elbow":           13,
    "rolfe_body_twist_left":      14,
    "rolfe_body_twist_right":     15,
    "rolfe_body_lean":            16,
    "rolfe_right_arm_raise":      17,
    "rolfe_right_arm_twist":      18,
    "rolfe_right_elbow_twist":    19,
    "rolfe_earl_head_tilt":       20,
    # ── Duke ──────────────────────────────────────────────────────────────
    "duke_head_right":            21,
    "duke_head_up":               22,
    "duke_left_ear":              23,
    "duke_right_ear":             24,
    "duke_head_left":             25,
    "duke_left_eyelid":           26,
    "duke_right_eyelid":          27,
    "duke_eyes_left":             28,
    "duke_eyes_right":            29,
    "duke_mouth":                 30,
    "duke_right_elbow":           31,
    "duke_left_foot_hihat":       32,
    "duke_left_arm_swing":        33,
    "duke_right_arm_swing":       34,
    "duke_left_elbow":            35,
    # ── Earl (Rolfe's puppet) ──────────────────────────────────────────────
    "earl_mouth":                 36,
    "earl_eyebrow":               37,
    # ── Props ──────────────────────────────────────────────────────────────
    "props_sun_mouth":            38,
    "props_sun_raise":            39,
    # ── Specials ───────────────────────────────────────────────────────────
    "specials_dual_pressure_td":  40,
    # ── Fats ───────────────────────────────────────────────────────────────
    "fats_left_eyelid":           41,
    "fats_right_eyelid":          42,
    "fats_eyes_left":             43,
    "fats_eyes_right":            44,
    "fats_mouth":                 45,
    # ── Props (continued) ──────────────────────────────────────────────────
    "props_moon_mouth":           46,
    "props_moon_raise":           47,
    "props_looney_bird_hands":    48,
    "props_antioch_down":         49,
    "props_baby_bear_raise":      50,
    # ── Fats (continued) ───────────────────────────────────────────────────
    "fats_head_tip_left":         51,
    "fats_head_tip_right":        52,
    "fats_head_up":               53,
    "fats_head_left":             54,
    "fats_head_right":            55,
    # bit 56 = BLANK (reserved — must stay 0)
    "fats_left_arm_swing":        57,
    "fats_right_arm_swing":       58,
    "fats_left_elbow":            59,
    "fats_right_elbow":           60,
    "fats_foot_tap":              61,
    "fats_body_lean":             62,
    "duke_right_foot_bass_drum":  63,
    "duke_body_lean":             64,
    # bit 65 = BLANK (reserved — must stay 0)
    # ── Organ Lights ───────────────────────────────────────────────────────
    "organ_top_blue":             66,
    "organ_top_red":              67,
    "organ_top_amber":            68,
    "organ_top_green":            69,
    # bit 70 = BLANK
    "organ_leg_top":              71,
    "organ_leg_mid":              72,
    "organ_leg_bottom":           73,
    "organ_cont_strobe":          74,
    "organ_flash_strobe":         75,
    # ── Sign Lights ────────────────────────────────────────────────────────
    "sign_inner":                 76,
    "sign_mid":                   77,
    "sign_outer":                 78,
    "sign_cont_strobe":           79,
    "sign_flash_strobe":          80,
    # ── Spotlights ─────────────────────────────────────────────────────────
    "spot_mitzi":                 81,
    "spot_beach_bear":            82,
    "spot_looney_bird":           83,
    "spot_billy_bob":             84,
    "spot_fats":                  85,
    "spot_duke":                  86,
    "spot_rolfe":                 87,
    "spot_earl":                  88,
    # ── Curtains ───────────────────────────────────────────────────────────
    "curtain_stage_right_open":   89,
    "curtain_stage_right_close":  90,
    "curtain_center_stage_open":  91,
    "curtain_center_stage_close": 92,
    "curtain_stage_left_open":    93,
    "curtain_stage_left_close":   94,
}

# Bits in TD frame that are BLANK/reserved — must always be 0
TD_BLANK_BITS = {56, 65, 70}

# Total bit-width of TD frame (including blanks)
TD_FRAME_BITS = 94


# -----------------------------------------------------------------------------
# BD TRACK CHANNEL MAP  (96 channels)
# Source: RAE_Bit_Chart_2.pdf
# -----------------------------------------------------------------------------
BD_CHANNELS = {
    # ── Beach Bear ─────────────────────────────────────────────────────────
    "beachbear_left_eyelid":          1,
    "beachbear_right_eyelid":         2,
    "beachbear_eye_cross":            3,
    "beachbear_left_hand_slide":      4,
    "beachbear_guitar_raise":         5,
    "beachbear_head_left":            6,
    "beachbear_head_right":           7,
    "beachbear_head_up":              8,
    "beachbear_left_leg_kick":        9,
    "beachbear_right_leg_kick":       10,
    "beachbear_right_arm_raise":      11,
    "beachbear_right_arm_twist":      12,
    "beachbear_right_elbow_twist":    13,
    "beachbear_right_wrist":          14,
    "beachbear_body_lean":            15,
    "beachbear_mouth":                16,
    # ── Looney Bird ────────────────────────────────────────────────────────
    "looneybird_mouth":               17,
    # ── Mitzi ──────────────────────────────────────────────────────────────
    "mitzi_right_arm_raise":          18,
    "mitzi_right_elbow":              19,
    "mitzi_right_arm_twist":          20,
    "looneybird_head_right":          21,
    "looneybird_raise":               22,
    "mitzi_left_arm_raise":           23,
    "mitzi_left_elbow":               24,
    "mitzi_left_arm_twist":           25,
    "mitzi_left_ear":                 26,
    "mitzi_right_ear":                27,
    "mitzi_head_left":                28,
    "mitzi_head_right":               29,
    "mitzi_head_up":                  30,
    "mitzi_left_eyelid":              31,
    "mitzi_right_eyelid":             32,
    "mitzi_eyes_left":                33,
    "mitzi_eyes_right":               34,
    "mitzi_mouth":                    35,
    "mitzi_body_twist_left":          36,
    "mitzi_body_twist_right":         37,
    "mitzi_body_lean":                38,
    # ── Billy Bob ──────────────────────────────────────────────────────────
    "billybob_left_arm_slide":        39,
    "billybob_guitar_raise":          40,
    # ── Looney Bird (continued) ────────────────────────────────────────────
    "looneybird_left_eyelid":         41,
    "looneybird_right_eyelid":        42,
    "looneybird_eye_cross":           43,
    # ── Billy Bob (continued) ──────────────────────────────────────────────
    "billybob_foot_tap":              44,
    # bit 45 = BLANK
    "billybob_mouth":                 46,
    "billybob_left_eyelid":           47,
    "billybob_right_eyelid":          48,
    "billybob_eyes_left":             49,
    "billybob_eyes_right":            50,
    "billybob_head_left":             51,
    "billybob_head_right":            52,
    "billybob_head_tip_left":         53,
    "billybob_head_tip_right":        54,
    "billybob_head_up":               55,
    "billybob_right_arm_raise":       56,
    "billybob_right_arm_twist":       57,
    "billybob_right_elbow_twist":     58,
    "billybob_right_wrist":           59,
    # ── Specials ───────────────────────────────────────────────────────────
    "specials_dual_pressure_bd":      60,
    # ── Billy Bob (continued) ──────────────────────────────────────────────
    "billybob_body_twist_left":       61,
    "billybob_body_twist_right":      62,
    "billybob_body_lean":             63,
    # ── Tape Control ───────────────────────────────────────────────────────
    "specials_tape_stop":             64,
    "specials_tape_rewind":           65,
    # ── Flood Lights ───────────────────────────────────────────────────────
    "flood_stage_right_blue":         66,
    "flood_stage_right_green":        67,
    "flood_stage_right_amber":        68,
    "flood_stage_right_red":          69,
    "prop_light_applause":            70,
    "flood_center_stage_blue":        71,
    "flood_center_stage_green":       72,
    "flood_center_stage_amber":       73,
    "flood_center_stage_red":         74,
    "prop_light_drums":               75,
    "flood_stage_left_blue":          76,
    "flood_stage_left_green":         77,
    "flood_stage_left_amber":         78,
    "flood_stage_left_red":           79,
    "prop_light_fire_still":          80,
    "flood_backdrop_outside_blue":    81,
    "flood_backdrop_inside_amber":    82,
    "flood_treeline_blue":            83,
    "flood_backdrop_inside_blue":     84,
    "flood_treeline_red":             85,
    "flood_bushes_green":             86,
    "flood_bushes_red_amber":         87,
    # ── Spotlights ─────────────────────────────────────────────────────────
    "spot_sun":                       88,
    "spot_moon":                      89,
    "spot_spider":                    90,
    "prop_light_gas_pump":            91,
    "stage_light_service_stn_red":    92,
    "stage_light_service_stn_blue":   93,
    "stage_light_rainbow_1_red":      94,
    "stage_light_rainbow_2_yellow":   95,
    "spot_guitar":                    96,
}

# Bits in BD frame that are BLANK/reserved — must always be 0
BD_BLANK_BITS = {45}

# Total bit-width of BD frame
BD_FRAME_BITS = 96


# -----------------------------------------------------------------------------
# Convenience: reverse maps  (bit_number → name)
# -----------------------------------------------------------------------------
TD_BIT_TO_NAME = {v: k for k, v in TD_CHANNELS.items()}
BD_BIT_TO_NAME = {v: k for k, v in BD_CHANNELS.items()}
