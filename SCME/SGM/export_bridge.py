# =============================================================================
# SCME/SGM/export_bridge.py — Python 4-channel WAV Export Bridge (Pyodide)
# =============================================================================
#
# Self-contained: no external imports from SCME.  All constants, BMC encoding,
# and frame-building logic are inlined so this file can be fetched and run
# directly inside Pyodide (py.runPython(source)).
#
# Entry points (available as Pyodide globals after runPython):
#
#   render_4ch_pcm_json(sequences_json, duration_ms) -> str
#       sequences_json : JSON string — list of {time_ms, character, movement, state}
#       duration_ms    : total show duration in milliseconds
#       returns        : JSON string {td_b64, bd_b64, sample_rate, n_samples}
#                        td_b64 / bd_b64 are base64-encoded raw Int16 LE PCM
#
# The JavaScript caller:
#   1. Decodes td_b64 / bd_b64 → Float32 (÷32768)
#   2. Optionally resamples / appends music channel data from AudioBuffer
#   3. Assembles a 4-channel WAV [MusicL, MusicR, TD, BD] via encodeMultiChWAV()
# =============================================================================

import base64
import json
import struct

# ---------------------------------------------------------------------------
# Inlined hardware constants  (source: SCME/SMM/constants.py, KWS-confirmed)
# ---------------------------------------------------------------------------

_SR            = 44_100   # sample rate Hz
_SPB           = 9        # samples per bit  (44100 // 4800 = 9)
_HALF_A        = 4        # first  half-period (9 // 2)
_HALF_B        = 5        # second half-period (9 - 4)
_HIGH          = 32767    # BMC high level (int16)
_LOW           = -32768   # BMC low level  (int16)

_TD_BITS       = 94       # bits per TD frame
_BD_BITS       = 96       # bits per BD frame
_TD_BLANK      = {56, 65, 70}   # 1-based bit numbers — must stay 0
_BD_BLANK      = {45}           # 1-based

# TD channel map  (name → 1-based bit number, from RAE_Bit_Chart_2.pdf)
_TD_CH = {
    "rolfe_mouth": 1, "rolfe_left_eyelid": 2, "rolfe_right_eyelid": 3,
    "rolfe_eyes_left": 4, "rolfe_eyes_right": 5,
    "rolfe_head_left": 6, "rolfe_head_right": 7, "rolfe_head_up": 8,
    "rolfe_left_ear": 9, "rolfe_right_ear": 10,
    "rolfe_left_arm_raise": 11, "rolfe_left_arm_twist": 12, "rolfe_left_elbow": 13,
    "rolfe_body_twist_left": 14, "rolfe_body_twist_right": 15, "rolfe_body_lean": 16,
    "rolfe_right_arm_raise": 17, "rolfe_right_arm_twist": 18, "rolfe_right_elbow_twist": 19,
    "rolfe_earl_head_tilt": 20,
    "duke_head_right": 21, "duke_head_up": 22,
    "duke_left_ear": 23, "duke_right_ear": 24, "duke_head_left": 25,
    "duke_left_eyelid": 26, "duke_right_eyelid": 27,
    "duke_eyes_left": 28, "duke_eyes_right": 29, "duke_mouth": 30,
    "duke_right_elbow": 31, "duke_left_foot_hihat": 32,
    "duke_left_arm_swing": 33, "duke_right_arm_swing": 34, "duke_left_elbow": 35,
    "earl_mouth": 36, "earl_eyebrow": 37,
    "props_sun_mouth": 38, "props_sun_raise": 39,
    "specials_dual_pressure_td": 40,
    "fats_left_eyelid": 41, "fats_right_eyelid": 42,
    "fats_eyes_left": 43, "fats_eyes_right": 44, "fats_mouth": 45,
    "props_moon_mouth": 46, "props_moon_raise": 47,
    "props_looney_bird_hands": 48, "props_antioch_down": 49, "props_baby_bear_raise": 50,
    "fats_head_tip_left": 51, "fats_head_tip_right": 52, "fats_head_up": 53,
    "fats_head_left": 54, "fats_head_right": 55,
    # bit 56 BLANK
    "fats_left_arm_swing": 57, "fats_right_arm_swing": 58,
    "fats_left_elbow": 59, "fats_right_elbow": 60,
    "fats_foot_tap": 61, "fats_body_lean": 62,
    "duke_right_foot_bass_drum": 63, "duke_body_lean": 64,
    # bit 65 BLANK
    "organ_top_blue": 66, "organ_top_red": 67, "organ_top_amber": 68, "organ_top_green": 69,
    # bit 70 BLANK
    "organ_leg_top": 71, "organ_leg_mid": 72, "organ_leg_bottom": 73,
    "organ_cont_strobe": 74, "organ_flash_strobe": 75,
    "sign_inner": 76, "sign_mid": 77, "sign_outer": 78,
    "sign_cont_strobe": 79, "sign_flash_strobe": 80,
    "spot_mitzi": 81, "spot_beach_bear": 82, "spot_looney_bird": 83,
    "spot_billy_bob": 84, "spot_fats": 85, "spot_duke": 86,
    "spot_rolfe": 87, "spot_earl": 88,
    "curtain_stage_right_open": 89, "curtain_stage_right_close": 90,
    "curtain_center_stage_open": 91, "curtain_center_stage_close": 92,
    "curtain_stage_left_open": 93, "curtain_stage_left_close": 94,
}

# BD channel map  (name → 1-based bit number)
_BD_CH = {
    "beachbear_left_eyelid": 1, "beachbear_right_eyelid": 2, "beachbear_eye_cross": 3,
    "beachbear_left_hand_slide": 4, "beachbear_guitar_raise": 5,
    "beachbear_head_left": 6, "beachbear_head_right": 7, "beachbear_head_up": 8,
    "beachbear_left_leg_kick": 9, "beachbear_right_leg_kick": 10,
    "beachbear_right_arm_raise": 11, "beachbear_right_arm_twist": 12,
    "beachbear_right_elbow_twist": 13, "beachbear_right_wrist": 14,
    "beachbear_body_lean": 15, "beachbear_mouth": 16,
    "looneybird_mouth": 17,
    "mitzi_right_arm_raise": 18, "mitzi_right_elbow": 19, "mitzi_right_arm_twist": 20,
    "looneybird_head_right": 21, "looneybird_raise": 22,
    "mitzi_left_arm_raise": 23, "mitzi_left_elbow": 24, "mitzi_left_arm_twist": 25,
    "mitzi_left_ear": 26, "mitzi_right_ear": 27,
    "mitzi_head_left": 28, "mitzi_head_right": 29, "mitzi_head_up": 30,
    "mitzi_left_eyelid": 31, "mitzi_right_eyelid": 32,
    "mitzi_eyes_left": 33, "mitzi_eyes_right": 34, "mitzi_mouth": 35,
    "mitzi_body_twist_left": 36, "mitzi_body_twist_right": 37, "mitzi_body_lean": 38,
    "billybob_left_arm_slide": 39, "billybob_guitar_raise": 40,
    "looneybird_left_eyelid": 41, "looneybird_right_eyelid": 42, "looneybird_eye_cross": 43,
    "billybob_foot_tap": 44,
    # bit 45 BLANK
    "billybob_mouth": 46,
    "billybob_left_eyelid": 47, "billybob_right_eyelid": 48,
    "billybob_eyes_left": 49, "billybob_eyes_right": 50,
    "billybob_head_left": 51, "billybob_head_right": 52,
    "billybob_head_tip_left": 53, "billybob_head_tip_right": 54, "billybob_head_up": 55,
    "billybob_right_arm_raise": 56, "billybob_right_arm_twist": 57,
    "billybob_right_elbow_twist": 58, "billybob_right_wrist": 59,
    "specials_dual_pressure_bd": 60,
    "billybob_body_twist_left": 61, "billybob_body_twist_right": 62, "billybob_body_lean": 63,
    "specials_tape_stop": 64, "specials_tape_rewind": 65,
    "flood_stage_right_blue": 66, "flood_stage_right_green": 67,
    "flood_stage_right_amber": 68, "flood_stage_right_red": 69,
    "prop_light_applause": 70,
    "flood_center_stage_blue": 71, "flood_center_stage_green": 72,
    "flood_center_stage_amber": 73, "flood_center_stage_red": 74,
    "prop_light_drums": 75,
    "flood_stage_left_blue": 76, "flood_stage_left_green": 77,
    "flood_stage_left_amber": 78, "flood_stage_left_red": 79,
    "prop_light_fire_still": 80,
    "flood_backdrop_outside_blue": 81, "flood_backdrop_inside_amber": 82,
    "flood_treeline_blue": 83, "flood_backdrop_inside_blue": 84, "flood_treeline_red": 85,
    "flood_bushes_green": 86, "flood_bushes_red_amber": 87,
    "spot_sun": 88, "spot_moon": 89, "spot_spider": 90,
    "prop_light_gas_pump": 91, "stage_light_service_stn_red": 92,
    "stage_light_service_stn_blue": 93,
    "stage_light_rainbow_1_red": 94, "stage_light_rainbow_2_yellow": 95,
    "spot_guitar": 96,
}

# Reverse maps: 1-based bit number → channel name
_TD_BIT = {v: k for k, v in _TD_CH.items()}
_BD_BIT = {v: k for k, v in _BD_CH.items()}


# ---------------------------------------------------------------------------
# Character-movement → (track, channel_name) lookup
# Derived from character-movements.js:  bit field is 0-based → add 1 for lookup
# ---------------------------------------------------------------------------

# Compact representation: char → (default_track, {movement: 0-based-bit})
_CHAR_MOV_BITS = {
    "Rolfe": ("TD", {
        "mouth": 0, "eyelid_left": 1, "eyelid_right": 2,
        "eye_left": 3, "eye_right": 4,
        "head_left": 5, "head_right": 6, "head_up": 7,
        "ear_left": 8, "ear_right": 9,
        "arm_left_raise": 10, "arm_left_twist": 11, "elbow_left": 12,
        "body_twist_left": 13, "body_twist_right": 14, "body_lean": 15,
        "arm_right_raise": 16, "arm_right_twist": 17, "elbow_right_twist": 18,
    }),
    "Earl": ("TD", {
        "head_tilt": 19, "mouth": 35, "eyebrow": 36,
    }),
    "Dook LaRue": ("TD", {
        "head_right": 20, "head_up": 21, "ear_left": 22, "ear_right": 23,
        "head_left": 24, "eyelid_left": 25, "eyelid_right": 26,
        "eye_left": 27, "eye_right": 28, "mouth": 29,
        "elbow_right": 30, "hi_hat": 31,
        "arm_left_swing": 32, "arm_right_swing": 33, "elbow_left": 34,
        "bass_drum": 62, "body_lean": 63,
    }),
    "Fatz": ("TD", {
        "eyelid_left": 40, "eyelid_right": 41, "eye_left": 42, "eye_right": 43,
        "mouth": 44,
        "head_tip_left": 50, "head_tip_right": 51, "head_up": 52,
        "head_left": 53, "head_right": 54,
        "arm_left_swing": 56, "arm_right_swing": 57,
        "elbow_left": 58, "elbow_right": 59,
        "foot_tap": 60, "body_lean": 61,
    }),
    "Lights": ("TD", {
        "sun_mouth": 37, "sun_raise": 38,
        "moon_mouth": 45, "moon_raise": 46,
        "looney_bird_hands": 47, "antioch_down": 48, "baby_bear_raise": 49,
        "spotlight_mitzi": 80, "spotlight_beach": 81, "spotlight_looney": 82,
        "spotlight_bob": 83, "spotlight_fats": 84, "spotlight_duke": 85,
        "spotlight_rolfe": 86, "spotlight_earl": 87,
    }),
    "Beach Bear": ("BD", {
        "eyelid_left": 0, "eyelid_right": 1, "eye_cross": 2,
        "hand_left_slide": 3, "guitar_raise": 4,
        "head_left": 5, "head_right": 6, "head_up": 7,
        "leg_left_kick": 8, "leg_right_kick": 9,
        "arm_right_raise": 10, "arm_right_twist": 11, "elbow_right_twist": 12,
        "wrist_right": 13, "body_lean": 14, "mouth": 15,
    }),
    "Looney Bird": ("BD", {
        "mouth": 16, "head_right": 20, "raise": 21,
        "eyelid_left": 40, "eyelid_right": 41, "eye_cross": 42,
    }),
    "Mitzi": ("BD", {
        "arm_right_raise": 17, "elbow_right": 18, "arm_right_twist": 19,
        "arm_left_raise": 22, "elbow_left": 23, "arm_left_twist": 24,
        "ear_left": 25, "ear_right": 26,
        "head_left": 27, "head_right": 28, "head_up": 29,
        "eyelid_left": 30, "eyelid_right": 31, "eye_left": 32, "eye_right": 33,
        "mouth": 34, "body_twist_left": 35, "body_twist_right": 36, "body_lean": 37,
    }),
    "Billy Bob": ("BD", {
        "arm_left_slide": 38, "guitar_raise": 39,
        "foot_tap": 43, "mouth": 45,
        "eyelid_left": 46, "eyelid_right": 47, "eye_left": 48, "eye_right": 49,
        "head_left": 50, "head_right": 51,
        "head_tip_left": 52, "head_tip_right": 53, "head_up": 54,
        "arm_right_raise": 55, "arm_right_twist": 56, "elbow_right_twist": 57,
        "wrist_right": 58,
        "body_twist_left": 60, "body_twist_right": 61, "body_lean": 62,
    }),
    # MMBB (mock bit positions — overlapping Rock hardware slots)
    "Chuck E. Cheese": ("TD", {
        "mouth": 0, "head_left": 1, "head_right": 2, "head_up": 3,
        "eyelid_left": 4, "eyelid_right": 5,
        "arm_left_raise": 6, "arm_right_raise": 7,
    }),
    "Munch": ("TD", {
        "mouth": 10, "head_left": 11, "head_right": 12,
        "arm_left_raise": 13, "arm_right_raise": 14,
    }),
    "Helen Henny": ("BD", {
        "mouth": 0, "head_left": 1, "head_right": 2,
        "arm_left_raise": 3, "arm_right_raise": 4,
    }),
    "Jasper T. Jowls": ("BD", {
        "mouth": 10, "head_left": 11, "head_right": 12,
        "arm_left_raise": 13, "arm_right_raise": 14,
    }),
    "Pasqually": ("BD", {
        "mouth": 20, "head_left": 21, "head_right": 22,
        "arm_left_raise": 23, "arm_right_raise": 24,
    }),
}

# Build flat lookup: (char_name, movement_name) → (track, channel_key_string)
_CHAR_CHANNEL = {}
for _cn, (_tk, _movs) in _CHAR_MOV_BITS.items():
    _rev = _TD_BIT if _tk == "TD" else _BD_BIT
    for _mv, _bit0 in _movs.items():
        _ch_name = _rev.get(_bit0 + 1)    # _bit0 is 0-based; dict is 1-based
        if _ch_name:
            _CHAR_CHANNEL[(_cn, _mv)] = (_tk, _ch_name)


# ---------------------------------------------------------------------------
# Inlined BMC encoder
# ---------------------------------------------------------------------------

class _BMCEncoder:
    """Stateful BMC encoder — phase-continuous across consecutive frames."""

    def __init__(self):
        self._level = _LOW      # start low, first bit always flips to HIGH

    def encode_bit(self, bit):
        # Always transition at start of bit period
        self._level = _HIGH if self._level == _LOW else _LOW
        if bit:
            # '1' → mid-bit transition after HALF_A samples
            first  = [self._level] * _HALF_A
            self._level = _HIGH if self._level == _LOW else _LOW
            second = [self._level] * _HALF_B
            return first + second
        else:
            # '0' → no mid-bit transition
            return [self._level] * _SPB

    def encode_frame(self, frame_bits):
        """Encode a list of 0/1 bits → list of int16 samples."""
        out = []
        for b in frame_bits:
            out.extend(self.encode_bit(b))
        return out


# ---------------------------------------------------------------------------
# Inlined frame builder
# ---------------------------------------------------------------------------

class _FrameBuilder:
    """
    Builds a continuous BMC PCM stream for one track (TD or BD) from
    timestamped channel-activation events.
    """

    def __init__(self, track):
        track = track.upper()
        if track not in ("TD", "BD"):
            raise ValueError(f"track must be 'TD' or 'BD', got {track!r}")
        self.track        = track
        self._ch_map      = _TD_CH    if track == "TD" else _BD_CH
        self._blank_bits  = _TD_BLANK if track == "TD" else _BD_BLANK
        self._frame_bits  = _TD_BITS  if track == "TD" else _BD_BITS
        self._frame_samps = self._frame_bits * _SPB   # 846 or 864
        self._frame       = [0] * self._frame_bits    # current bit state

    def set_channel(self, channel, active):
        if channel not in self._ch_map:
            raise ValueError(f"Unknown {self.track} channel: {channel!r}")
        bit_num = self._ch_map[channel]
        if bit_num in self._blank_bits:
            raise ValueError(
                f"Bit {bit_num} is BLANK (reserved) in {self.track} frame."
            )
        self._frame[bit_num - 1] = 1 if active else 0

    def clear_all(self):
        self._frame = [0] * self._frame_bits

    def build(self, events, duration_seconds):
        """
        Build raw 16-bit LE PCM bytes for the full duration, applying events
        at their exact sample positions.

        events: list of {time: float_seconds, channel: str, active: bool}
        duration_seconds: float
        returns: bytes (raw int16 LE PCM)
        """
        self.clear_all()
        total_samples = int(duration_seconds * _SR)
        remainder = total_samples % self._frame_samps
        if remainder:
            total_samples += self._frame_samps - remainder

        output    = bytearray(total_samples * 2)
        enc       = _BMCEncoder()
        sorted_ev = sorted(events, key=lambda e: int(e["time"] * _SR))
        cursor    = 0

        for ev in sorted_ev:
            ev_sample = int(ev["time"] * _SR)
            # ── Snap to frame boundary before filling ────────────────────────
            # Events that land mid-frame cause _fill to write a partial frame,
            # then the next _fill starts a fresh frame at a non-aligned byte.
            # The decoder locks at the original grid and sees a "corrupt" frame
            # at every seam, pushing blank-bit integrity just below 98 %.
            # Floor-snapping ensures (ev_sample - cursor) is always a whole
            # number of frames, so _fill never produces partial frames.
            ev_sample = (ev_sample // self._frame_samps) * self._frame_samps
            if ev_sample <= cursor:   # same frame as last event — update state, don't fill
                self.set_channel(ev["channel"], ev["active"])
                continue
            self._fill(output, enc, cursor, ev_sample)
            cursor = ev_sample
            self.set_channel(ev["channel"], ev["active"])

        self._fill(output, enc, cursor, total_samples)
        return bytes(output)

    def _fill(self, output, enc, start, end):
        if start >= end:
            return
        pos = start
        while pos < end:
            frame_pcm   = enc.encode_frame(list(self._frame))
            frame_bytes = struct.pack(f"<{len(frame_pcm)}h", *frame_pcm)
            can_write   = min(self._frame_samps, end - pos)
            byte_s      = pos * 2
            byte_e      = byte_s + can_write * 2
            output[byte_s:byte_e] = frame_bytes[: can_write * 2]
            pos += can_write


# ---------------------------------------------------------------------------
# Public bridge API
# ---------------------------------------------------------------------------

def render_4ch_pcm(sequences, duration_ms):
    """
    Build TD and BD PCM streams from a list of show-sequence dicts.

    Parameters
    ----------
    sequences : list[dict]
        Each dict: {time_ms: float, character: str, movement: str, state: bool}
    duration_ms : float
        Total show duration in milliseconds.

    Returns
    -------
    dict  {td_b64, bd_b64, sample_rate, n_samples_td, n_samples_bd}
    """
    duration_s = duration_ms / 1000.0
    td_events  = []
    bd_events  = []
    skipped    = 0

    for seq in sequences:
        char_name = seq.get("character", "")
        mov_name  = seq.get("movement",  "")
        state     = bool(seq.get("state", False))
        time_ms   = float(seq.get("time_ms", seq.get("time", 0)))
        time_s    = time_ms / 1000.0

        lookup = _CHAR_CHANNEL.get((char_name, mov_name))
        if lookup is None:
            skipped += 1
            continue

        track, channel = lookup
        ev = {"time": time_s, "channel": channel, "active": state}
        if track == "TD":
            td_events.append(ev)
        else:
            bd_events.append(ev)

    td_bytes = _FrameBuilder("TD").build(td_events, duration_s)
    bd_bytes = _FrameBuilder("BD").build(bd_events, duration_s)

    return {
        "td_b64":       base64.b64encode(td_bytes).decode("ascii"),
        "bd_b64":       base64.b64encode(bd_bytes).decode("ascii"),
        "sample_rate":  _SR,
        "n_samples_td": len(td_bytes) // 2,
        "n_samples_bd": len(bd_bytes) // 2,
        "skipped":      skipped,
    }


def render_4ch_pcm_json(sequences_json, duration_ms):
    """
    Safe Pyodide entry point.  Always returns a JSON string.
    On error returns {error, traceback}.
    """
    try:
        sequences = json.loads(sequences_json)
        result    = render_4ch_pcm(sequences, float(duration_ms))
        return json.dumps(result)
    except Exception as _exc:
        import traceback as _tb
        return json.dumps({
            "error":     str(_exc),
            "traceback": _tb.format_exc(),
        })
