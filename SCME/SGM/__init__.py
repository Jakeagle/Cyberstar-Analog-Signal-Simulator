# =============================================================================
# SGM — Signal Generation Module
# Subfolder of SCME (Signal Creation and Management Engine)
# =============================================================================
#
# Generates deterministic BMC (Biphase Mark Code) PCM streams from show event
# data, using confirmed Cyberstar hardware constants.
#
# Modules:
#   bmc_encoder.py   — Converts bit streams to raw 16-bit PCM via BMC rules
#   frame_builder.py — Manages frame state; builds full PCM streams from events
#
# Constants live in SCME/SMM/constants.py
# Verification tools live in SCME/SVM/
