#!/usr/bin/env python3
# =============================================================================
# bmc_decoder.py — Hardware-accurate BMC Decoder
# =============================================================================
#
# Inverse of BMCEncoder.  Accepts raw PCM samples (int16 numpy array or list)
# and returns a stream of decoded bits, along with timing diagnostics that
# model what the real Cyberstar hardware would accept or reject.
#
# Hardware model:
#   - A transition detector finds every zero-crossing (polarity change).
#   - Run lengths between crossings are measured in samples.
#   - Each run is classified as HALF (mid-bit transition) or FULL (no mid-bit)
#     using a tolerance window around the known nominal values.
#   - Runs outside ALL tolerance windows produce a BIT_ERROR.
#   - Decoded bits are emitted once per nominal bit period (SAMPLES_PER_BIT).
#
# Timing tolerance:
#   Real Cyberstar hardware uses an analog PLL to recover clock.  We conservatively
#   model the tolerance window as ±30% of the nominal run length.  This is wider
#   than a tight digital PLL but matches the analog hardware's likely behaviour.
#   Set TOLERANCE_FACTOR to change this (0.20 = ±20%, 0.30 = ±30%, etc.)
#
# =============================================================================

from __future__ import annotations
import math
from typing import Sequence, NamedTuple

TOLERANCE_FACTOR = 0.30   # ±30% of nominal run length


class DecodedBit(NamedTuple):
    bit:         int    # 0 or 1
    sample_pos:  int    # sample index at start of this bit period
    run_a:       int    # first run length (samples)
    run_b:       int | None  # second run length if bit=1, else None
    in_tolerance: bool  # False = hardware would likely reject this bit


class BitError(NamedTuple):
    sample_pos: int
    run_length: int
    reason:     str


class BMCDecoder:
    """
    Stateful BMC decoder.

    Parameters
    ----------
    sample_rate : int
        Sample rate of the PCM data (e.g. 44100 or 48000).
    baud_rate : int
        Expected baud rate (e.g. 4800).
    tolerance : float
        Fractional tolerance window, default TOLERANCE_FACTOR (0.30 = ±30%).
    zero_threshold : int
        Amplitude below this is treated as silence (not decoded).
    """

    def __init__(
        self,
        sample_rate: int = 44_100,
        baud_rate: int = 4_800,
        tolerance: float = TOLERANCE_FACTOR,
        zero_threshold: int = 200,
    ):
        self.sample_rate     = sample_rate
        self.baud_rate       = baud_rate
        self.tolerance       = tolerance
        self.zero_threshold  = zero_threshold

        # Nominal periods at this sample rate
        spb = sample_rate / baud_rate          # samples per bit (may be float)
        self.nom_full = spb                    # nominal full-bit run
        self.nom_half = spb / 2               # nominal half-bit run

        # Tolerance windows  [lo, hi]
        self._full_lo = math.floor(self.nom_full * (1 - tolerance))
        self._full_hi = math.ceil(self.nom_full  * (1 + tolerance))
        self._half_lo = math.floor(self.nom_half * (1 - tolerance))
        self._half_hi = math.ceil(self.nom_half  * (1 + tolerance))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def decode(
        self, samples: Sequence[int]
    ) -> tuple[list[DecodedBit], list[BitError]]:
        """
        Decode a full PCM channel into BMC bits.

        Returns
        -------
        bits   : list[DecodedBit]
        errors : list[BitError]
        """
        runs       = self._run_lengths(samples)
        bits:   list[DecodedBit] = []
        errors: list[BitError]   = []
        self._consume_runs(runs, bits, errors)
        return bits, errors

    def tolerance_summary(self) -> str:
        return (
            f"  Nominal bit period : {self.nom_full:.2f} samp  "
            f"({int(self.nom_full)} int at {self.sample_rate} Hz / {self.baud_rate} baud)\n"
            f"  Full-run window    : {self._full_lo} – {self._full_hi} samp\n"
            f"  Half-run window    : {self._half_lo} – {self._half_hi} samp  (tol={int(self.tolerance*100)}%)"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_lengths(self, samples: Sequence[int]) -> list[tuple[int, int]]:
        """
        Return list of (start_sample_index, run_length) for each contiguous
        run of positive/negative samples.  Skips silence.
        """
        runs   = []
        i      = 0
        n      = len(samples)
        thresh = self.zero_threshold

        while i < n:
            s = samples[i]
            if abs(s) < thresh:
                i += 1
                continue
            positive = s > 0
            start    = i
            while i < n and ((samples[i] > 0) == positive) and abs(samples[i]) >= thresh:
                i += 1
            runs.append((start, i - start))

        return runs

    def _is_full(self, r: int) -> bool:
        return self._full_lo <= r <= self._full_hi

    def _is_half(self, r: int) -> bool:
        return self._half_lo <= r <= self._half_hi

    def _consume_runs(
        self,
        runs: list[tuple[int, int]],
        bits: list[DecodedBit],
        errors: list[BitError],
    ) -> None:
        """
        Walk the run list and emit DecodedBits.

        BMC decoding logic
        ------------------
        Every bit begins with a mandatory transition (start-of-bit edge).
        After consuming the start-of-bit transition run:
          - If the run is FULL  → bit = 0  (no mid-bit transition)
          - If the run is HALF  → peek at next run:
              - next run is also HALF → bit = 1  (mid-bit transition consumed)
              - next run is FULL or missing → bit error (incomplete '1')
        """
        idx = 0
        total = len(runs)

        while idx < total:
            pos, r = runs[idx]

            if self._is_full(r):
                # Bit '0': single full run
                bits.append(DecodedBit(
                    bit=0,
                    sample_pos=pos,
                    run_a=r,
                    run_b=None,
                    in_tolerance=True,
                ))
                idx += 1

            elif self._is_half(r):
                # Potentially bit '1': need a second half run
                if idx + 1 < total:
                    pos2, r2 = runs[idx + 1]
                    if self._is_half(r2):
                        bits.append(DecodedBit(
                            bit=1,
                            sample_pos=pos,
                            run_a=r,
                            run_b=r2,
                            in_tolerance=True,
                        ))
                        idx += 2
                    else:
                        # Second run is not half — tolerated if sum ≈ full
                        combined = r + r2
                        if self._is_full(combined):
                            # Close enough — call it a '1' with a timing note
                            bits.append(DecodedBit(
                                bit=1,
                                sample_pos=pos,
                                run_a=r,
                                run_b=r2,
                                in_tolerance=False,   # marginal
                            ))
                            idx += 2
                        else:
                            errors.append(BitError(
                                sample_pos=pos,
                                run_length=r,
                                reason=f"half-run ({r}) followed by non-half ({r2}), sum={combined}",
                            ))
                            idx += 1
                else:
                    # Trailing half run at end of stream — tolerate
                    bits.append(DecodedBit(
                        bit=1,
                        sample_pos=pos,
                        run_a=r,
                        run_b=None,
                        in_tolerance=False,
                    ))
                    idx += 1

            else:
                # Out-of-tolerance run
                errors.append(BitError(
                    sample_pos=pos,
                    run_length=r,
                    reason=(
                        f"run={r} outside full=[{self._full_lo},{self._full_hi}] "
                        f"and half=[{self._half_lo},{self._half_hi}]"
                    ),
                ))
                idx += 1
