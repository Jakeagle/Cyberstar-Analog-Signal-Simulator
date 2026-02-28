# =============================================================================
# SCME/SAM/show_bridge.py — Show Analysis Module, Pyodide entry point
# =============================================================================
#
# Self-contained: no file I/O, only stdlib + numpy (bundled in Pyodide 0.27).
#
# Entry point (called from JS via Pyodide globals):
#
#   json_str = analyze_and_choreograph_json(
#       samples_list,   # list[int]  — mono Int16, downsampled to 11 025 Hz
#       sample_rate,    # int        — must match the downsampled rate
#       band,           # str        — "rock" | "munch"
#       title,          # str        — show title
#       duration_ms,    # int | float — original audio duration in ms
#   ) -> str            # .cybershow.json v3.0 JSON string
#
# Output JSON structure (v3.0 — same format as importShowJSON accepts):
#   {
#     "cyberstar_show": true,
#     "version": "3.0",
#     "title": "...",
#     "band": "rock" | "munch",
#     "duration_ms": <int>,
#     "duration_frames": <int>,      # at 50 fps
#     "fps": 50,
#     "bpm": <int>,
#     "description": "...",
#     "characters": {
#       "<CharName>": {              # key MUST match CHARACTER_MOVEMENTS key
#         "signals": [
#           {"frame": <int>, "movement": "<name>", "state": true|false, "note": ""},
#           ...
#         ]
#       },
#       ...
#     }
#   }
#
# All character and movement names MUST match character-movements.js exactly.
# =============================================================================

import json
import math

try:
    import numpy as _np
    _HAS_NUMPY = True
except ImportError:
    _HAS_NUMPY = False


# ---------------------------------------------------------------------------
# Character Role Tables
# Keys = exact names from CHARACTER_MOVEMENTS in character-movements.js
# Each entry lists which movement keys to fire on each frequency-band onset.
# ---------------------------------------------------------------------------

# Rock-Afire Explosion
_ROCK = {
    # ── Dook LaRue — drums ──────────────────────────────────────────────────
    "Dook LaRue": {
        "role": "drums",
        "bass":   ["bass_drum", "arm_left_swing", "arm_right_swing"],
        "mid":    ["hi_hat", "arm_left_swing", "arm_right_swing", "body_lean"],
        "treble": ["mouth", "head_left", "head_right"],
        "soft":   [],
        "hold_bass": 2, "hold_mid": 2, "hold_treble": 3, "hold_soft": 2,
    },
    # ── Rolfe — lead vocalist / guitarist ───────────────────────────────────
    "Rolfe": {
        "role": "lead_vocalist",
        "bass":   ["body_lean", "arm_left_raise"],
        "mid":    ["arm_left_raise", "arm_right_raise", "body_lean", "head_left", "head_right"],
        "treble": ["mouth", "ear_left", "ear_right", "mouth"],   # mouth twice = higher weight
        "soft":   ["eyelid_left", "eyelid_right", "head_up"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 5, "hold_soft": 3,
    },
    # ── Mitzi — vocalist ────────────────────────────────────────────────────
    "Mitzi": {
        "role": "vocalist",
        "bass":   ["body_lean", "body_twist_left", "body_twist_right"],
        "mid":    ["arm_right_raise", "arm_left_raise", "body_lean"],
        "treble": ["mouth", "head_left", "head_right", "mouth"],
        "soft":   ["eyelid_left", "eyelid_right", "head_up", "ear_left", "ear_right"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 5, "hold_soft": 3,
    },
    # ── Billy Bob — guitarist / lead guitar ─────────────────────────────────
    "Billy Bob": {
        "role": "guitarist",
        "bass":   ["foot_tap", "guitar_raise"],
        "mid":    ["mouth", "head_left", "head_right", "arm_right_raise"],
        "treble": ["arm_right_raise", "mouth", "head_tip_left", "head_tip_right"],
        "soft":   ["eyelid_left", "eyelid_right", "head_up"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 3, "hold_soft": 2,
    },
    # ── Beach Bear — lead guitarist ─────────────────────────────────────────
    "Beach Bear": {
        "role": "guitarist",
        "bass":   ["guitar_raise", "leg_left_kick", "leg_right_kick"],
        "mid":    ["mouth", "head_left", "head_right", "arm_right_raise"],
        "treble": ["arm_right_raise", "mouth", "hand_left_slide"],
        "soft":   ["body_lean", "head_up"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 3, "hold_soft": 2,
    },
    # ── Fatz — keyboardist ──────────────────────────────────────────────────
    "Fatz": {
        "role": "keyboardist",
        "bass":   ["foot_tap", "arm_left_swing"],
        "mid":    ["mouth", "arm_right_swing", "head_left", "head_right"],
        "treble": ["mouth", "head_tip_left", "head_tip_right", "arm_left_swing"],
        "soft":   ["head_up", "eyelid_left", "eyelid_right", "body_lean"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 3, "hold_soft": 2,
    },
    # ── Lights ──────────────────────────────────────────────────────────────
    "Lights": {
        "role": "lights",
        "bass":   ["spotlight_duke", "spotlight_bob", "spotlight_beach"],
        "mid":    ["spotlight_fats", "spotlight_bob", "spotlight_beach", "spotlight_duke"],
        "treble": ["spotlight_rolfe", "spotlight_mitzi", "spotlight_earl", "spotlight_looney"],
        "soft":   [],
        "hold_bass": 4, "hold_mid": 4, "hold_treble": 5, "hold_soft": 3,
    },
}

# Munch's Make Believe Band
_MUNCH = {
    "Chuck E. Cheese": {
        "role": "lead",
        "bass":   ["arm_left_raise", "arm_right_raise"],
        "mid":    ["head_left", "head_right", "arm_left_raise", "arm_right_raise"],
        "treble": ["mouth"],
        "soft":   ["head_up", "eyelid_left", "eyelid_right"],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 5, "hold_soft": 2,
    },
    "Munch": {
        "role": "bassist",
        "bass":   ["mouth", "arm_left_raise"],
        "mid":    ["head_left", "head_right", "arm_right_raise"],
        "treble": ["arm_right_raise"],
        "soft":   [],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 3, "hold_soft": 2,
    },
    "Helen Henny": {
        "role": "vocalist",
        "bass":   ["arm_left_raise"],
        "mid":    ["arm_right_raise", "head_left", "head_right"],
        "treble": ["mouth"],
        "soft":   [],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 5, "hold_soft": 2,
    },
    "Jasper T. Jowls": {
        "role": "guitarist",
        "bass":   ["arm_left_raise"],
        "mid":    ["mouth", "head_left", "head_right"],
        "treble": ["arm_right_raise"],
        "soft":   [],
        "hold_bass": 2, "hold_mid": 3, "hold_treble": 3, "hold_soft": 2,
    },
    "Pasqually": {
        "role": "drummer",
        "bass":   ["arm_left_raise", "arm_right_raise"],
        "mid":    ["mouth", "head_left", "head_right"],
        "treble": ["arm_left_raise"],
        "soft":   [],
        "hold_bass": 2, "hold_mid": 2, "hold_treble": 2, "hold_soft": 2,
    },
}


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------


def _onset_strength(energies):
    """Positive energy flux — detects transients."""
    return [max(0.0, energies[i] - energies[i - 1]) for i in range(1, len(energies))]


def _find_peaks(values, threshold_ratio=0.3, min_gap=4):
    """Local maxima above threshold, separated by at least min_gap indices."""
    if not values:
        return []
    peak_val = max(values)
    if peak_val <= 0:
        return []
    threshold = peak_val * threshold_ratio
    peaks = []
    last = -min_gap
    for i in range(1, len(values) - 1):
        if (values[i] >= threshold
                and values[i] >= values[i - 1]
                and values[i] >= values[i + 1]
                and i - last >= min_gap):
            peaks.append(i)
            last = i
    return peaks


def _estimate_bpm(times_s, min_bpm=60, max_bpm=210):
    if len(times_s) < 4:
        return 120
    intervals = sorted([
        times_s[i + 1] - times_s[i]
        for i in range(len(times_s) - 1)
        if 60.0 / max_bpm <= times_s[i + 1] - times_s[i] <= 60.0 / min_bpm
    ])
    if not intervals:
        return 120
    median = intervals[len(intervals) // 2]
    return max(min_bpm, min(max_bpm, round(60.0 / median)))


def _cyclic(lst, idx):
    return lst[idx % len(lst)] if lst else None


def _cue(movement, frame_on, hold_frames):
    """Return [ON cue, OFF cue] for one movement activation."""
    return [
        {"frame": frame_on,               "movement": movement, "state": True,  "note": ""},
        {"frame": frame_on + hold_frames, "movement": movement, "state": False, "note": ""},
    ]


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def _analyze_audio(samples, sr):
    """
    Returns (bass_e, mid_e, treble_e, chunk_dur_s) where each energy list
    has one entry per 50 ms chunk.  Uses numpy when available.
    """
    chunk = max(256, int(sr * 0.050))  # 50 ms chunks

    # Frequency separation via boxcar (moving-mean on |x|):
    #   w_slow  = window covering ~1/150 Hz ≈ 6.7 ms  → bass envelope
    #   w_fast  = window covering ~1/2000 Hz ≈ 0.5 ms → separates treble
    w_slow = max(1, sr // 150)   # bass gate (~150 Hz)
    w_fast = max(1, sr // 2000)  # treble gate (~2 kHz)

    if _HAS_NUMPY:
        x = _np.asarray(samples, dtype=_np.float32) / 32768.0
        absx = _np.abs(x)
        n = len(absx)
        cs = _np.concatenate([[0.0], _np.cumsum(absx).astype(_np.float64)])

        def _smooth(w):
            # cs has shape (n+1,).
            # rolling mean of window w at position i = (cs[i+1] - cs[i+1-w]) / w
            # for i in [w-1, n-1]: r[w-1:n] = (cs[w:n+1] - cs[0:n-w+1]) / w
            w = max(1, w)
            r = _np.empty(n, dtype=_np.float32)
            r[w - 1:] = (cs[w:] - cs[:n - w + 1]) / w
            if w > 1:
                # Partial window at the very start
                r[:w - 1] = cs[1:w] / _np.arange(1, w, dtype=_np.float64)
            return r

        lp_slow = _smooth(w_slow)  # bass envelope
        lp_fast = _smooth(w_fast)  # mid+treble envelope

        bass_sig   = lp_slow
        mid_sig    = _np.clip(lp_fast - lp_slow, 0, None)
        treble_sig = _np.clip(absx  - lp_fast,  0, None)

        n_chunks = (n - chunk) // chunk

        def _crms(sig):
            out = []
            for i in range(n_chunks):
                seg = sig[i * chunk:(i + 1) * chunk]
                out.append(float(_np.mean(seg) + 1e-10))
            return out

        return _crms(bass_sig), _crms(mid_sig), _crms(treble_sig), chunk / sr

    else:
        # Pure-Python fallback (slow, but correct)
        norm = [s / 32768.0 for s in samples]
        absx = [abs(v) for v in norm]
        n = len(absx)
        cs = [0.0] * (n + 1)
        for i, v in enumerate(absx):
            cs[i + 1] = cs[i] + v

        def _smooth(w):
            w = max(1, w)
            r = []
            for i in range(n):
                lo = max(0, i - w + 1)
                r.append((cs[i + 1] - cs[lo]) / (i - lo + 1))
            return r

        lp_slow = _smooth(w_slow)
        lp_fast = _smooth(w_fast)

        n_chunks = (n - chunk) // chunk
        bass_e, mid_e, treble_e = [], [], []
        for i in range(n_chunks):
            s = i * chunk
            e = s + chunk
            bass_e.append(   sum(lp_slow[j]                          for j in range(s, e)) / chunk + 1e-10)
            mid_e.append(    sum(max(0.0, lp_fast[j] - lp_slow[j])  for j in range(s, e)) / chunk + 1e-10)
            treble_e.append( sum(max(0.0, absx[j]    - lp_fast[j])  for j in range(s, e)) / chunk + 1e-10)

        return bass_e, mid_e, treble_e, chunk / sr


# ---------------------------------------------------------------------------
# Choreography engine
# ---------------------------------------------------------------------------

def _choreograph(bass_e, mid_e, treble_e, chunk_dur_s, duration_ms,
                 band, bpm, beat_idx, bass_idx, treble_idx):
    """
    Map onset lists to character movements and return the characters dict
    suitable for .cybershow.json v3.0.
    """
    FPS = 50
    MS_PER_FRAME = 1000.0 / FPS

    n_on = min(len(bass_e), len(mid_e), len(treble_e)) - 1  # onset arrays are 1 shorter

    def to_s(idx_list):
        return [(i + 1) * chunk_dur_s for i in idx_list]

    beat_times_s   = to_s(beat_idx)
    treble_times_s = to_s(treble_idx)

    def to_frame(t_s):
        return max(0, int(t_s * 1000.0 / MS_PER_FRAME))

    char_table = _ROCK if band == "rock" else _MUNCH

    # Onset strength lists (one shorter than energy lists)
    bas_on = [max(0.0, bass_e[i] - bass_e[i - 1]) for i in range(1, len(bass_e))]
    mid_on = [max(0.0, mid_e[i]  - mid_e[i - 1])  for i in range(1, len(mid_e))]
    tre_on = [max(0.0, treble_e[i] - treble_e[i - 1]) for i in range(1, len(treble_e))]

    def classify(chunk_i):
        """Dominant band for a given onset chunk index."""
        b = bas_on[chunk_i] if chunk_i < len(bas_on) else 0.0
        m = mid_on[chunk_i] if chunk_i < len(mid_on) else 0.0
        t = tre_on[chunk_i] if chunk_i < len(tre_on) else 0.0
        if b >= m and b >= t:
            return "bass"
        if t >= m:
            return "treble"
        return "mid"

    # Pair each beat with its class
    beat_classes = [
        (idx, classify(min(idx, n_on - 1)))
        for idx in beat_idx
    ]

    beat_set_s = set(beat_times_s)  # for "near a beat" test

    characters_out = {}

    for char_name, cfg in char_table.items():
        signals = []
        counters = {"bass": 0, "mid": 0, "treble": 0, "soft": 0}

        # --- Main beat-driven cues ---
        for chunk_i, band_class in beat_classes:
            t_s = (chunk_i + 1) * chunk_dur_s
            if t_s * 1000.0 > duration_ms:
                break

            movlist = cfg.get(band_class, [])
            hold    = cfg.get(f"hold_{band_class}", 3)

            if movlist:
                mov = _cyclic(movlist, counters[band_class])
                if mov:
                    signals.extend(_cue(mov, to_frame(t_s), hold))
                    counters[band_class] += 1

        # --- Soft / idle movements for vocalists on treble-only onsets ---
        role      = cfg.get("role", "")
        soft_list = cfg.get("soft", [])
        if role in ("lead_vocalist", "vocalist", "lead") and soft_list:
            hold_soft = cfg.get("hold_soft", 2)
            for vi, t_s in enumerate(treble_times_s):
                if t_s * 1000.0 > duration_ms:
                    break
                # Skip if too close to a beat (avoid double-firing)
                near_beat = any(abs(t_s - bt) < 0.12 for bt in beat_set_s)
                if not near_beat:
                    mov = _cyclic(soft_list, counters["soft"])
                    if mov:
                        signals.extend(_cue(mov, to_frame(t_s), hold_soft))
                        counters["soft"] += 1

        # Sort by frame, ON before OFF within the same frame
        signals.sort(key=lambda x: (x["frame"], not x["state"]))

        if signals:
            characters_out[char_name] = {"signals": signals}

    return characters_out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_and_choreograph(samples_list, sample_rate, band, title, duration_ms):
    """
    Full show-generation pipeline.

    Parameters
    ----------
    samples_list : list[int]
        Mono Int16 PCM samples.  Should be downsampled to ~11 025 Hz by the
        caller (JS) before being passed here to keep processing fast.
    sample_rate  : int
        Sample rate of *samples_list* (not the original audio).
    band         : str
        "rock" (Rock-Afire Explosion) or "munch" (Munch's Make Believe Band).
    title        : str
        Human-readable show title used in the output JSON.
    duration_ms  : int | float
        Original audio duration in milliseconds.  Used for frame-count
        calculation and to cap event generation at the end of the song.

    Returns
    -------
    str
        JSON string in .cybershow.json v3.0 format ready for direct import.
    """
    duration_ms = int(duration_ms)
    sr = int(sample_rate)

    # -- Frequency-band energy per 50 ms chunk ----------------------------
    bass_e, mid_e, treble_e, chunk_dur_s = _analyze_audio(samples_list, sr)

    n_e = min(len(bass_e), len(mid_e), len(treble_e))
    bass_e   = bass_e[:n_e]
    mid_e    = mid_e[:n_e]
    treble_e = treble_e[:n_e]

    # -- Onset-strength curves (1 shorter) --------------------------------
    bas_on = _onset_strength(bass_e)
    mid_on = _onset_strength(mid_e)
    tre_on = _onset_strength(treble_e)
    n_on   = min(len(bas_on), len(mid_on), len(tre_on))

    combined = [
        bas_on[i] + 0.6 * mid_on[i] + 0.3 * tre_on[i]
        for i in range(n_on)
    ]

    # -- Peak-picking (minimum gap = 150 ms expressed in chunks) ----------
    min_gap_beat   = max(2, int(0.150 / chunk_dur_s))
    min_gap_treble = max(2, int(0.080 / chunk_dur_s))

    beat_idx   = _find_peaks(combined,  0.25, min_gap_beat)
    bass_idx   = _find_peaks(bas_on,    0.30, min_gap_beat)
    treble_idx = _find_peaks(tre_on,    0.25, min_gap_treble)

    beat_times_s = [(i + 1) * chunk_dur_s for i in beat_idx]
    bpm = _estimate_bpm(beat_times_s)

    # -- Build choreography -----------------------------------------------
    FPS = 50
    duration_frames = int(duration_ms / (1000.0 / FPS))

    characters_out = _choreograph(
        bass_e, mid_e, treble_e, chunk_dur_s, duration_ms,
        band, bpm, beat_idx, bass_idx, treble_idx,
    )

    # -- Assemble output --------------------------------------------------
    band_label = "Rock-Afire Explosion" if band == "rock" else "Munch's Make Believe Band"
    result = {
        "cyberstar_show": True,
        "version":        "3.0",
        "title":          title,
        "band":           band,
        "duration_ms":    duration_ms,
        "duration_frames": duration_frames,
        "fps":            FPS,
        "bpm":            bpm,
        "description": (
            f"Auto-generated by Cyberstar Online SAM. "
            f"{len(beat_times_s)} beats at ~{bpm} BPM for {band_label}. "
            f"{len(treble_idx)} vocal/treble cues. "
            f"Bass, mid, and treble bands mapped to appropriate performers."
        ),
        "characters": characters_out,
    }
    return json.dumps(result)


def analyze_and_choreograph_json(samples_list, sample_rate, band, title, duration_ms):
    """
    Safe Pyodide entry point — always returns a JSON string.
    On error returns {"error": "<message>", "traceback": "..."}.
    """
    try:
        return analyze_and_choreograph(
            samples_list, sample_rate, band, title, duration_ms
        )
    except Exception as _exc:
        import traceback as _tb
        return json.dumps({
            "error":     str(_exc),
            "traceback": _tb.format_exc(),
        })
