# =============================================================================
# visualizer_bridge.py — Pyodide-Compatible SViz Entry Point
# =============================================================================
#
# Self-contained: no file I/O, no soundfile dependency.
# JS decodes the WAV via AudioContext, extracts Ch3 (TD) and Ch4 (BD) as
# Int16 lists, then calls verify_and_decode().  Returns a plain dict that
# Pyodide serialises to a JS object.
#
# Designed to run in-browser via Pyodide.  Also fully importable in CPython
# for offline testing.
#
# =============================================================================

from __future__ import annotations
import math
import json
import collections
from typing import Sequence

# ---------------------------------------------------------------------------
# Inline hardware constants (mirrors SCME/SMM/constants.py).
# These are inlined so this file works in Pyodide without any package setup.
# ---------------------------------------------------------------------------
_BAUD_RATE      = 4_800
_TOLERANCE      = 0.30
_ZERO_THRESH    = 200
_MAX_ERR_RATE   = 0.02
_MIN_BLANK_RATE = 0.98
_LOCK_THRESHOLD = 3

_TD_FRAME_BITS  = 94
_BD_FRAME_BITS  = 96
_TD_BLANK_IDX   = {55, 64, 69}   # 0-based (bits 56, 65, 70)
_BD_BLANK_IDX   = {44}           # 0-based (bit 45)

_TD_BIT_TO_NAME = {
    1:"rolfe_mouth",2:"rolfe_left_eyelid",3:"rolfe_right_eyelid",
    4:"rolfe_eyes_left",5:"rolfe_eyes_right",6:"rolfe_head_left",
    7:"rolfe_head_right",8:"rolfe_head_up",9:"rolfe_left_ear",
    10:"rolfe_right_ear",11:"rolfe_left_arm_raise",12:"rolfe_left_arm_twist",
    13:"rolfe_left_elbow",14:"rolfe_body_twist_left",15:"rolfe_body_twist_right",
    16:"rolfe_body_lean",17:"rolfe_right_arm_raise",18:"rolfe_right_arm_twist",
    19:"rolfe_right_elbow_twist",20:"rolfe_earl_head_tilt",
    21:"duke_head_right",22:"duke_head_up",23:"duke_left_ear",24:"duke_right_ear",
    25:"duke_head_left",26:"duke_left_eyelid",27:"duke_right_eyelid",
    28:"duke_eyes_left",29:"duke_eyes_right",30:"duke_mouth",
    31:"duke_right_elbow",32:"duke_left_foot_hihat",33:"duke_left_arm_swing",
    34:"duke_right_arm_swing",35:"duke_left_elbow",36:"earl_mouth",
    37:"earl_eyebrow",38:"props_sun_mouth",39:"props_sun_raise",
    40:"specials_dual_pressure_td",41:"fats_left_eyelid",42:"fats_right_eyelid",
    43:"fats_eyes_left",44:"fats_eyes_right",45:"fats_mouth",
    46:"props_moon_mouth",47:"props_moon_raise",48:"props_looney_bird_hands",
    49:"props_antioch_down",50:"props_baby_bear_raise",51:"fats_head_tip_left",
    52:"fats_head_tip_right",53:"fats_head_up",54:"fats_head_left",
    55:"fats_head_right",
    57:"fats_left_arm_swing",58:"fats_right_arm_swing",59:"fats_left_elbow",
    60:"fats_right_elbow",61:"fats_foot_tap",62:"fats_body_lean",
    63:"duke_right_foot_bass_drum",64:"duke_body_lean",
    66:"organ_top_blue",67:"organ_top_red",68:"organ_top_amber",
    69:"organ_top_green",71:"organ_leg_top",72:"organ_leg_mid",
    73:"organ_leg_bottom",74:"organ_cont_strobe",75:"organ_flash_strobe",
    76:"sign_inner",77:"sign_mid",78:"sign_outer",79:"sign_cont_strobe",
    80:"sign_flash_strobe",81:"spot_mitzi",82:"spot_beach_bear",
    83:"spot_looney_bird",84:"spot_billy_bob",85:"spot_fats",
    86:"spot_duke",87:"spot_rolfe",88:"spot_earl",
    89:"curtain_stage_right_open",90:"curtain_stage_right_close",
    91:"curtain_center_stage_open",92:"curtain_center_stage_close",
    93:"curtain_stage_left_open",94:"curtain_stage_left_close",
}

_BD_BIT_TO_NAME = {
    1:"beachbear_left_eyelid",2:"beachbear_right_eyelid",3:"beachbear_eye_cross",
    4:"beachbear_left_hand_slide",5:"beachbear_guitar_raise",6:"beachbear_head_left",
    7:"beachbear_head_right",8:"beachbear_head_up",9:"beachbear_left_leg_kick",
    10:"beachbear_right_leg_kick",11:"beachbear_right_arm_raise",
    12:"beachbear_right_arm_twist",13:"beachbear_right_elbow_twist",
    14:"beachbear_right_wrist",15:"beachbear_body_lean",16:"beachbear_mouth",
    17:"looneybird_mouth",18:"mitzi_right_arm_raise",19:"mitzi_right_elbow",
    20:"mitzi_right_arm_twist",21:"looneybird_head_right",22:"looneybird_raise",
    23:"mitzi_left_arm_raise",24:"mitzi_left_elbow",25:"mitzi_left_arm_twist",
    26:"mitzi_left_ear",27:"mitzi_right_ear",28:"mitzi_head_left",
    29:"mitzi_head_right",30:"mitzi_head_up",31:"mitzi_left_eyelid",
    32:"mitzi_right_eyelid",33:"mitzi_eyes_left",34:"mitzi_eyes_right",
    35:"mitzi_mouth",36:"mitzi_body_twist_left",37:"mitzi_body_twist_right",
    38:"mitzi_body_lean",39:"billybob_left_arm_slide",40:"billybob_guitar_raise",
    41:"looneybird_left_eyelid",42:"looneybird_right_eyelid",
    43:"looneybird_eye_cross",44:"billybob_foot_tap",
    46:"billybob_mouth",47:"billybob_left_eyelid",48:"billybob_right_eyelid",
    49:"billybob_eyes_left",50:"billybob_eyes_right",51:"billybob_head_left",
    52:"billybob_head_right",53:"billybob_head_tip_left",54:"billybob_head_tip_right",
    55:"billybob_head_up",56:"billybob_right_arm_raise",57:"billybob_right_arm_twist",
    58:"billybob_right_elbow_twist",59:"billybob_right_wrist",
    60:"specials_dual_pressure_bd",61:"billybob_body_twist_left",
    62:"billybob_body_twist_right",63:"billybob_body_lean",
    64:"specials_tape_stop",65:"specials_tape_rewind",
    66:"flood_stage_right_blue",67:"flood_stage_right_green",
    68:"flood_stage_right_amber",69:"flood_stage_right_red",
    70:"prop_light_applause",71:"flood_center_stage_blue",
    72:"flood_center_stage_green",73:"flood_center_stage_amber",
    74:"flood_center_stage_red",75:"prop_light_drums",
    76:"flood_stage_left_blue",77:"flood_stage_left_green",
    78:"flood_stage_left_amber",79:"flood_stage_left_red",
    80:"prop_light_fire_still",81:"flood_backdrop_outside_blue",
    82:"flood_backdrop_inside_amber",83:"flood_treeline_blue",
    84:"flood_backdrop_inside_blue",85:"flood_treeline_red",
    86:"flood_bushes_green",87:"flood_bushes_red_amber",
    88:"spot_sun",89:"spot_moon",90:"spot_spider",91:"prop_light_gas_pump",
    92:"stage_light_service_stn_red",93:"stage_light_service_stn_blue",
    94:"stage_light_rainbow_1_red",95:"stage_light_rainbow_2_yellow",
    96:"spot_guitar",
}


# ---------------------------------------------------------------------------
# Internal: BMC run-length decoder
# ---------------------------------------------------------------------------
def _run_lengths(samples: Sequence[int]) -> list[tuple[int, int]]:
    runs = []
    i = 0
    n = len(samples)
    while i < n:
        s = samples[i]
        if abs(s) < _ZERO_THRESH:
            i += 1
            continue
        positive = s > 0
        start = i
        while i < n and ((samples[i] > 0) == positive) and abs(samples[i]) >= _ZERO_THRESH:
            i += 1
        runs.append((start, i - start))
    return runs


def _decode_bmc(samples: Sequence[int], sample_rate: int) -> tuple[list[int], int]:
    nom_full = sample_rate / _BAUD_RATE
    nom_half = nom_full / 2
    full_lo = math.floor(nom_full * (1 - _TOLERANCE))
    full_hi = math.ceil(nom_full  * (1 + _TOLERANCE))
    half_lo = math.floor(nom_half * (1 - _TOLERANCE))
    half_hi = math.ceil(nom_half  * (1 + _TOLERANCE))

    runs   = _run_lengths(samples)
    bits   = []
    errors = 0
    idx    = 0
    total  = len(runs)

    while idx < total:
        _, r = runs[idx]
        if full_lo <= r <= full_hi:
            bits.append(0)
            idx += 1
        elif half_lo <= r <= half_hi:
            if idx + 1 < total:
                _, r2 = runs[idx + 1]
                if half_lo <= r2 <= half_hi:
                    bits.append(1)
                    idx += 2
                else:
                    combined = r + r2
                    if full_lo <= combined <= full_hi:
                        bits.append(1)
                        idx += 2
                    else:
                        errors += 1
                        idx += 1
            else:
                bits.append(1)
                idx += 1
        else:
            errors += 1
            idx += 1

    return bits, errors


# ---------------------------------------------------------------------------
# Internal: frame sync
# ---------------------------------------------------------------------------
def _sync_frames(bits: list[int], frame_bits: int, blank_indices: set[int]) -> tuple[int, int, list[list[int]]]:
    total  = len(bits)
    best_offset = 0
    best_score  = 0
    search_end  = min(500, total - frame_bits * _LOCK_THRESHOLD)

    for candidate in range(max(0, search_end)):
        score = 0
        for k in range(_LOCK_THRESHOLD):
            start = candidate + k * frame_bits
            end   = start + frame_bits
            if end > total:
                break
            frame_slice = bits[start:end]
            if all(frame_slice[bi] == 0 for bi in blank_indices):
                score += 1
            else:
                break
        if score > best_score:
            best_score  = score
            best_offset = candidate
            if score >= _LOCK_THRESHOLD:
                break

    frames   = []
    pos      = best_offset
    while pos + frame_bits <= total:
        frames.append(bits[pos:pos + frame_bits])
        pos += frame_bits

    return best_offset, best_score, frames


# ---------------------------------------------------------------------------
# Internal: channel timeline from frame list
# ---------------------------------------------------------------------------
def _channel_timeline(
    frames: list[list[int]],
    bit_to_name: dict[int, str],
    secs_per_frame: float,
    track: str,
) -> list[dict]:
    active_since: dict[str, float] = {}
    events: list[dict] = []

    for fi, frame in enumerate(frames):
        t = fi * secs_per_frame
        active_set = set()
        for i, v in enumerate(frame):
            if v == 1 and (i + 1) in bit_to_name:
                active_set.add(bit_to_name[i + 1])

        for ch in active_set:
            if ch not in active_since:
                active_since[ch] = t

        for ch in list(active_since):
            if ch not in active_set:
                t_on = active_since.pop(ch)
                events.append({"channel": ch, "t_on": t_on, "t_off": t, "track": track})

    if frames:
        t_end = len(frames) * secs_per_frame
        for ch, t_on in active_since.items():
            events.append({"channel": ch, "t_on": t_on, "t_off": t_end, "track": track})

    events.sort(key=lambda e: e["t_on"])
    return events


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def verify_and_decode(
    td_samples: Sequence[int],
    bd_samples: Sequence[int],
    sample_rate: int,
) -> dict:
    """
    Main Pyodide entry point.

    Parameters
    ----------
    td_samples   : Ch3 PCM as Int16 list/array (BMC control track TD)
    bd_samples   : Ch4 PCM as Int16 list/array (BMC control track BD)
    sample_rate  : sample rate of the audio (e.g. 44100 or 48000)

    Returns
    -------
    Plain dict (JSON-serialisable) with keys:
        verdict          : "PASS" | "FAIL"
        reasons          : list of failure reason strings
        td               : {error_rate, locked, blank_ok_rate, frame_count}
        bd               : {error_rate, locked, blank_ok_rate, frame_count}
        channel_timeline : list of {channel, t_on, t_off, track}
        duration_seconds : float
        sample_rate      : int
        baud_rate        : int
    """
    verdict_pass = True
    reasons      = []
    channel_timeline = []

    duration_seconds = len(td_samples) / sample_rate

    def _process_track(samples, frame_bits, blank_indices, bit_to_name, label):
        nonlocal verdict_pass

        bits, n_errors = _decode_bmc(samples, sample_rate)
        n_bits     = len(bits)
        error_rate = n_errors / max(n_bits + n_errors, 1)

        _, score, frames = _sync_frames(bits, frame_bits, blank_indices)
        locked = score >= _LOCK_THRESHOLD

        blank_ok  = sum(1 for f in frames if all(f[bi] == 0 for bi in blank_indices))
        blank_rate = blank_ok / max(len(frames), 1)

        secs_per_frame = frame_bits / _BAUD_RATE
        timeline = _channel_timeline(frames, bit_to_name, secs_per_frame, label)
        channel_timeline.extend(timeline)

        if error_rate > _MAX_ERR_RATE:
            verdict_pass = False
            reasons.append(f"{label}: error rate {error_rate*100:.2f}% exceeds {_MAX_ERR_RATE*100:.1f}% limit")

        if not locked:
            verdict_pass = False
            reasons.append(f"{label}: failed to lock on frame boundaries")

        if blank_rate < _MIN_BLANK_RATE:
            verdict_pass = False
            reasons.append(f"{label}: blank-bit integrity {blank_rate*100:.1f}% < {_MIN_BLANK_RATE*100:.1f}%")

        return {
            "error_rate":    round(error_rate, 5),
            "locked":        locked,
            "blank_ok_rate": round(blank_rate, 4),
            "frame_count":   len(frames),
            "bit_count":     n_bits,
        }

    td_result = _process_track(td_samples, _TD_FRAME_BITS, _TD_BLANK_IDX, _TD_BIT_TO_NAME, "TD")
    bd_result = _process_track(bd_samples, _BD_FRAME_BITS, _BD_BLANK_IDX, _BD_BIT_TO_NAME, "BD")

    channel_timeline.sort(key=lambda e: e["t_on"])

    return {
        "verdict":          "PASS" if verdict_pass else "FAIL",
        "reasons":          reasons,
        "td":               td_result,
        "bd":               bd_result,
        "channel_timeline": channel_timeline,
        "duration_seconds": round(duration_seconds, 3),
        "sample_rate":      sample_rate,
        "baud_rate":        _BAUD_RATE,
    }


def get_channel_maps_json() -> str:
    """Return 1-based TD/BD bit-to-name dicts as JSON so the JS stage view
    can build a channelName → {charName, moveKey} reverse lookup."""
    return json.dumps({
        "td": {str(k): v for k, v in _TD_BIT_TO_NAME.items()},
        "bd": {str(k): v for k, v in _BD_BIT_TO_NAME.items()},
    })


def verify_and_decode_json(
    td_samples: Sequence[int],
    bd_samples: Sequence[int],
    sample_rate: int,
) -> str:
    """Same as verify_and_decode() but returns a JSON string — useful when
    Pyodide proxy conversion is unavailable."""
    return json.dumps(verify_and_decode(td_samples, bd_samples, sample_rate))
