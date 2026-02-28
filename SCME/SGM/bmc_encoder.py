# =============================================================================
# bmc_encoder.py — Biphase Mark Code (BMC) Encoder
# =============================================================================
#
# Converts a sequence of bits into raw 16-bit signed PCM samples using the
# Biphase Mark Code encoding confirmed from Cyberstar KWS recordings.
#
# BMC RULES (hardware-confirmed):
#   - There is ALWAYS a level transition at the START of each bit period.
#   - If the bit = 1: there is an ADDITIONAL transition at the MID-point.
#   - If the bit = 0: NO additional mid-period transition.
#
# With SAMPLES_PER_BIT = 9, HALF_A = 4, HALF_B = 5:
#
#   Bit '1' (two transitions — start + mid):
#     samples: [HIGH x4, LOW x5]  or  [LOW x4, HIGH x5]
#     End state = same as state BEFORE this bit (two flips cancel)
#
#   Bit '0' (one transition — start only):
#     samples: [HIGH x9]  or  [LOW x9]
#     End state = OPPOSITE of state before this bit
#
# This matches the bimodal run-length distribution observed in KWS files:
#   Short runs ~4-5 samples = half-period of a '1' bit
#   Long  runs ~9   samples = full-period of a '0' bit
#   (At 96kHz resample: 9→20, 4→9, 5→10 — which matches KWS observations)

import struct
from SCME.SMM.constants import (
    BMC_HIGH, BMC_LOW,
    BMC_HALF_A, BMC_HALF_B,
    SAMPLES_PER_BIT,
)


class BMCEncoder:
    """
    Stateful BMC encoder. Maintains current output level between calls so that
    multi-frame streams are correctly phase-continuous — critical for hardware
    decoder lock-on.

    Usage:
        enc = BMCEncoder()
        pcm = enc.encode_bits([1, 0, 1, 1, 0, 0, 1, 0])  # one byte
        raw_bytes = enc.to_raw_bytes(pcm)
    """

    def __init__(self, initial_level: int = BMC_LOW) -> None:
        # Current output level — persists across encode_bits() calls so
        # back-to-back frames are seamlessly phase-continuous.
        self._level = initial_level

    def reset(self, level: int = BMC_LOW) -> None:
        """Reset encoder state (use only between independent streams)."""
        self._level = level

    # ── Core encoder ────────────────────────────────────────────────────────

    def encode_bit(self, bit: int) -> list[int]:
        """
        Encode a single bit into a list of PCM sample values (int16).
        Updates internal level state.

        Args:
            bit: 0 or 1

        Returns:
            List of SAMPLES_PER_BIT integer sample values.
        """
        # Always transition at the start of the bit period
        self._level = BMC_HIGH if self._level == BMC_LOW else BMC_LOW

        if bit:
            # '1': mid-period transition after HALF_A samples
            first_half  = [self._level]  * BMC_HALF_A
            self._level = BMC_HIGH if self._level == BMC_LOW else BMC_LOW
            second_half = [self._level] * BMC_HALF_B
            return first_half + second_half
        else:
            # '0': no mid-period transition — full period at new level
            return [self._level] * SAMPLES_PER_BIT

    def encode_bits(self, bits: list[int]) -> list[int]:
        """
        Encode multiple bits (MSB-first) into PCM sample values.

        Args:
            bits: Iterable of 0/1 values (MSB first per RAE convention).

        Returns:
            Flat list of int16 sample values.
        """
        samples = []
        for bit in bits:
            samples.extend(self.encode_bit(bit))
        return samples

    def encode_byte(self, byte: int, msb_first: bool = True) -> list[int]:
        """
        Encode a single byte (8 bits) into PCM sample values.

        Args:
            byte:      Integer 0-255.
            msb_first: If True, bit 7 is encoded first (RAE convention).

        Returns:
            List of 8 * SAMPLES_PER_BIT = 72 sample values.
        """
        if msb_first:
            bits = [(byte >> i) & 1 for i in range(7, -1, -1)]
        else:
            bits = [(byte >> i) & 1 for i in range(8)]
        return self.encode_bits(bits)

    # ── Frame encoding ───────────────────────────────────────────────────────

    def encode_frame(self, frame_bits: list[int]) -> list[int]:
        """
        Encode an entire RAE frame (up to 96 bits) into PCM samples.
        Phase-continuous with previous call.

        Args:
            frame_bits: List of 0/1 values, length must match track frame size
                        (TD_FRAME_BITS=94 or BD_FRAME_BITS=96).

        Returns:
            List of len(frame_bits) * SAMPLES_PER_BIT sample values.
        """
        return self.encode_bits(frame_bits)

    # ── Output helpers ───────────────────────────────────────────────────────

    @staticmethod
    def to_raw_bytes(samples: list[int]) -> bytes:
        """
        Pack a list of int16 sample values into raw little-endian bytes
        suitable for writing directly into a WAV data chunk.

        Args:
            samples: List of integer values in range [-32768, 32767].

        Returns:
            bytes object (2 bytes per sample, little-endian signed 16-bit).
        """
        return struct.pack(f"<{len(samples)}h", *samples)

    @staticmethod
    def samples_to_numpy(samples: list[int]):
        """
        Convert sample list to a numpy int16 array (for downstream processing).
        Requires numpy — available in both Pyodide and desktop Python.
        """
        import numpy as np
        return np.array(samples, dtype=np.int16)
