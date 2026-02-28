# =============================================================================
# SCME/SMM/__init__.py — Signal Mapping Module
# =============================================================================
#
# The SMM is the single source of truth for all Cyberstar and SPTE signal
# standards: baud rates, sample rates, bit timing, and the complete TD/BD
# channel-to-bit-position maps sourced from RAE_Bit_Chart_2.pdf.
#
# All other SCME sub-modules (SGM, etc.) import exclusively from here.
# Never define hardware constants outside this module.
#
# Sub-modules:
#   constants.py  — all timing constants and channel bit maps
# =============================================================================
