# =============================================================================
# SAM — Show Analysis Module
# =============================================================================
#
# Analyses an audio file and generates a complete choreographed show tape for
# a given Cyberstar band.  All processing runs in Python (via Pyodide in the
# browser) so the Web Audio API is used only for decoding the input file —
# never for signal generation.
#
# Sub-modules
# -----------
# show_bridge.py  — self-contained Pyodide entry point (no file I/O,
#                   numpy-accelerated).  Exposes:
#
#       analyze_and_choreograph_json(
#           samples_list,   # list[int] — mono Int16, downsampled to 11 025 Hz
#           sample_rate,    # int — 11 025
#           band,           # str — "rock" | "munch"
#           title,          # str — show title
#           duration_ms,    # int — original audio duration in ms
#       ) -> str            # JSON string (.cybershow.json v3.0 format)
#
# Pipeline
# --------
#   1. JS decodes WAV / MP3 with AudioContext.decodeAudioData()
#   2. JS mixes to mono + decimates to 11 025 Hz → Int16Array
#   3. JS passes samples to Pyodide → Python runs:
#        a. Boxcar-filter frequency split (bass / mid / treble)
#        b. Chunk-energy onset-strength curves
#        c. Peak-picking → beat / bass-onset / treble-onset times
#        d. BPM estimation via median inter-onset interval
#        e. Character choreography via role-table lookup
#   4. Python returns .cybershow.json v3.0 string
#   5. JS parses JSON → converts frames → saves to localStorage
