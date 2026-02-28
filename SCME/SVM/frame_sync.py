#!/usr/bin/env python3
# =============================================================================
# frame_sync.py — Cyberstar Frame Synchroniser
# =============================================================================
#
# Takes the raw bit stream from BMCDecoder and finds Cyberstar frame boundaries.
#
# Frame sync strategy
# -------------------
# Cyberstar frames have no explicit preamble byte — the hardware locks onto the
# signal by knowing the frame length (94 bits for TD, 96 bits for BD) and using
# the blank bits as sync anchors:
#
#   TD blank bits: {56, 65, 70}  (1-based) — always 0
#   BD blank bits: {45}          (1-based) — always 0
#
# Algorithm:
#   1. Slide a window of FRAME_BITS across the bit stream.
#   2. For each candidate frame start, check that all blank-bit positions
#      within the window contain 0.
#   3. Score = number of consecutive frames that pass the blank-bit check.
#   4. The highest-scoring offset is accepted as frame lock.
#   5. Once locked, all subsequent frames are extracted at fixed intervals.
#
# This closely models what the analog hardware PLL does: it uses the guaranteed
# zero positions to validate its phase.
#
# =============================================================================

from __future__ import annotations
from typing import NamedTuple

from SCME.SMM.constants import (
    TD_FRAME_BITS, BD_FRAME_BITS,
    TD_BLANK_BITS, BD_BLANK_BITS,
    TD_BIT_TO_NAME, BD_BIT_TO_NAME,
)


class DecodedFrame(NamedTuple):
    frame_index:    int          # sequential frame number
    bit_offset:     int          # index into full bit list where this frame starts
    bits:           list[int]    # FRAME_BITS length list of 0/1
    active_channels: list[str]   # human-readable list of channels = 1
    blank_ok:       bool         # True if all blank bits are 0


class SyncResult(NamedTuple):
    locked:       bool
    lock_offset:  int          # bit index of first frame start
    score:        int          # number of consecutive clean frames used to lock
    frames:       list[DecodedFrame]
    orphan_bits:  int          # bits before lock discarded


# ---------------------------------------------------------------------------

LOCK_THRESHOLD = 3   # require this many consecutive clean frames to declare lock


def sync_frames(
    bits: list[int],
    track: str,                  # "TD" or "BD"
    max_search_bits: int = 500,  # search window for lock (bits)
) -> SyncResult:
    """
    Find frame boundaries in a decoded bit stream and return all frames.

    Parameters
    ----------
    bits             : flat list of 0/1 from BMCDecoder
    track            : "TD" or "BD"
    max_search_bits  : how far into the stream to search for lock

    Returns
    -------
    SyncResult
    """
    if track == "TD":
        frame_bits  = TD_FRAME_BITS
        blank_bits  = TD_BLANK_BITS      # 1-based bit numbers
        bit_to_name = TD_BIT_TO_NAME
    elif track == "BD":
        frame_bits  = BD_FRAME_BITS
        blank_bits  = BD_BLANK_BITS
        bit_to_name = BD_BIT_TO_NAME
    else:
        raise ValueError(f"track must be 'TD' or 'BD', got {track!r}")

    # Convert to 0-based indices
    blank_indices = {b - 1 for b in blank_bits}

    total = len(bits)

    # --- Phase 1: find lock offset ---
    best_offset = 0
    best_score  = 0

    search_end = min(max_search_bits, total - frame_bits * LOCK_THRESHOLD)

    for candidate in range(search_end):
        score = 0
        for k in range(LOCK_THRESHOLD):
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
            if score >= LOCK_THRESHOLD:
                break   # good enough

    locked = best_score >= LOCK_THRESHOLD

    # --- Phase 2: extract all frames from lock_offset ---
    frames: list[DecodedFrame] = []
    pos = best_offset

    while pos + frame_bits <= total:
        frame_slice = bits[pos:pos + frame_bits]
        blank_ok    = all(frame_slice[bi] == 0 for bi in blank_indices)
        active      = [
            bit_to_name[i + 1]          # 1-based
            for i, v in enumerate(frame_slice)
            if v == 1 and (i + 1) in bit_to_name
        ]
        frames.append(DecodedFrame(
            frame_index=len(frames),
            bit_offset=pos,
            bits=list(frame_slice),
            active_channels=active,
            blank_ok=blank_ok,
        ))
        pos += frame_bits

    return SyncResult(
        locked=locked,
        lock_offset=best_offset,
        score=best_score,
        frames=frames,
        orphan_bits=best_offset,
    )


def channel_timeline(
    frames: list[DecodedFrame],
    sample_rate: int,
    baud_rate: int,
    track: str,
) -> dict[str, list[tuple[float, float]]]:
    """
    Collapse a frame list into a per-channel timeline of (start_sec, end_sec)
    active intervals.

    Returns a dict:  channel_name -> [(t_on, t_off), ...]
    """
    frame_bits = TD_FRAME_BITS if track == "TD" else BD_FRAME_BITS
    secs_per_frame = frame_bits / baud_rate

    timeline: dict[str, list[tuple[float, float]]] = {}
    active_since: dict[str, float] = {}

    for f in frames:
        t = f.frame_index * secs_per_frame
        active_set = set(f.active_channels)

        # Channels that just turned on
        for ch in active_set:
            if ch not in active_since:
                active_since[ch] = t

        # Channels that just turned off
        for ch in list(active_since):
            if ch not in active_set:
                t_on  = active_since.pop(ch)
                timeline.setdefault(ch, []).append((t_on, t))

    # Close any still-active channels at end of stream
    if frames:
        t_end = (frames[-1].frame_index + 1) * secs_per_frame
        for ch, t_on in active_since.items():
            timeline.setdefault(ch, []).append((t_on, t_end))

    return timeline
