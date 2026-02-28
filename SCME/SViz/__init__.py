# =============================================================================
# SCME/SViz/__init__.py — Signal Visualizer Module
# =============================================================================
#
# The SViz module provides a Pyodide-compatible bridge between the browser's
# Web Audio API (which decodes the WAV) and Python's hardware-accurate BMC
# decoder and frame sync logic.
#
# Data flow:
#   JS: AudioContext.decodeAudioData() → Float32Array per channel
#       → converts Ch3/Ch4 to Int16 → calls Python bridge
#   Python (Pyodide): BMC decode → frame sync → channel timeline JSON
#   JS: renders waveform canvas + animated channel activity from JSON
#
# Sub-modules:
#   visualizer_bridge.py  — Pyodide entry point; self-contained, no file I/O
# =============================================================================
