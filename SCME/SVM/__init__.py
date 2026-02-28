# =============================================================================
# SCME/SVM/__init__.py — Signal Verification Module
# =============================================================================
#
# The SVM contains all tools for verifying that signals conform to
# Cyberstar hardware specifications before export or playback.
#
# Sub-modules:
#   bmc_decoder.py   — decodes raw BMC PCM back into a bit stream
#   frame_sync.py    — finds frame boundaries and extracts channel data
#   hardware_sim.py  — full Cyberstar hardware emulator (CLI + importable)
#   validate.py      — automated test suite for the entire SCME/SGM stack
# =============================================================================
