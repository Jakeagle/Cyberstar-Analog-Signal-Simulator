#!/usr/bin/env python3
# =============================================================================
# hardware_sim.py — Cyberstar Hardware Emulator
# =============================================================================
#
# Simulates the Cyberstar signal-processing hardware in software.
# Feed it any WAV file (2-channel KWS format or 4-channel legacy format) and
# it will tell you whether the hardware would accept the signal, decode all
# animation frames, and report a full channel activity timeline.
#
# Usage:
#   python -m SCME.SVM.hardware_sim <path_to_wav>
#   python -m SCME.SVM.hardware_sim <path_to_wav> --tolerance 0.20
#   python -m SCME.SVM.hardware_sim <path_to_wav> --track TD
#   python -m SCME.SVM.hardware_sim <path_to_wav> --dump-frames
#
# Output sections:
#   [1] File info          — sample rate, channels, duration
#   [2] Decoder config     — nominal timing, tolerance windows
#   [3] Decode report      — bit count, error count, error rate
#   [4] Frame sync report  — lock status, frame count, blank-bit integrity
#   [5] Channel timeline   — every channel that fired, with timestamps
#   [6] VERDICT            — PASS / FAIL with reason
#
# =============================================================================

from __future__ import annotations
import sys, os, argparse, math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

try:
    import soundfile as sf
    import numpy as np
except ImportError:
    print("[!!] soundfile and numpy are required:  pip install soundfile numpy")
    sys.exit(1)

from SCME.SMM.constants import (
    SAMPLE_RATE, BAUD_RATE,
    TD_FRAME_BITS, BD_FRAME_BITS,
)
from SCME.SVM.bmc_decoder import BMCDecoder
from SCME.SVM.frame_sync  import sync_frames, channel_timeline

# ---------------------------------------------------------------------------
# Hard limits that model Cyberstar hardware strictness
# ---------------------------------------------------------------------------
MAX_ERROR_RATE      = 0.02    # >2% bit errors = hardware would lose lock
MIN_FRAME_LOCK_SCORE = 3      # fewer than 3 consecutive clean frames = no lock
MIN_BLANK_BIT_RATE  = 0.98   # <98% of frames with correct blank bits = suspect

DIVIDER = "=" * 68


def run_sim(wav_path: str, tolerance: float, track: str, dump_frames: bool) -> bool:
    """
    Run the full emulation pipeline on one WAV file.
    Returns True if the hardware would accept the signal, False otherwise.
    """
    verdict_pass = True
    reasons: list[str] = []

    # -----------------------------------------------------------------------
    # [1] File info
    # -----------------------------------------------------------------------
    print(f"\n{DIVIDER}")
    print(f"  Cyberstar Hardware Emulator")
    print(DIVIDER)

    if not os.path.exists(wav_path):
        print(f"  [!!] File not found: {wav_path}")
        return False

    info = sf.info(wav_path)
    print(f"  File     : {os.path.basename(wav_path)}")
    print(f"  Rate     : {info.samplerate} Hz")
    print(f"  Channels : {info.channels}")
    print(f"  Duration : {info.frames / info.samplerate:.2f} s  ({info.frames:,} frames)")
    print(f"  Format   : {info.subtype}")

    data, sr = sf.read(wav_path, dtype='int16', always_2d=True)
    n_ch = data.shape[1]

    # --- Channel selection ---
    if n_ch == 4:
        # Standard Cyberstar layout: Ch1=MusicL, Ch2=MusicR, Ch3=TD, Ch4=BD
        ch_map = {"TD": 2, "BD": 3}   # 0-based indices
        print(f"  Layout   : 4-channel Cyberstar (Ch3=TD, Ch4=BD)")
    elif n_ch == 2:
        # KWS 2-channel: Ch1=TD, Ch2=BD
        ch_map = {"TD": 0, "BD": 1}
        print(f"  Layout   : 2-channel KWS (Ch1=TD, Ch2=BD)")
    else:
        print(f"  [!!] Unexpected channel count: {n_ch}")
        return False

    tracks_to_run = ["TD", "BD"] if track == "BOTH" else [track]

    for trk in tracks_to_run:
        ch_idx = ch_map[trk]
        ch_data = data[:, ch_idx].tolist()

        print(f"\n{DIVIDER}")
        print(f"  Track: {trk} (Ch{ch_idx + 1})")
        print(DIVIDER)

        # -------------------------------------------------------------------
        # [2] Decoder config
        # -------------------------------------------------------------------
        dec = BMCDecoder(
            sample_rate=sr,
            baud_rate=BAUD_RATE,
            tolerance=tolerance,
        )
        print(f"\n  -- Decoder Configuration --")
        print(dec.tolerance_summary())

        # -------------------------------------------------------------------
        # [3] Decode
        # -------------------------------------------------------------------
        print(f"\n  -- Decode Report --")
        bits_decoded, decode_errors = dec.decode(ch_data)

        n_bits   = len(bits_decoded)
        n_errors = len(decode_errors)
        error_rate = n_errors / max(n_bits + n_errors, 1)

        print(f"  Bits decoded      : {n_bits:,}")
        print(f"  Decode errors     : {n_errors:,}")
        print(f"  Error rate        : {error_rate * 100:.3f}%  (limit: {MAX_ERROR_RATE*100:.1f}%)")

        if error_rate > MAX_ERROR_RATE:
            verdict_pass = False
            reasons.append(
                f"{trk}: error rate {error_rate*100:.2f}% exceeds {MAX_ERROR_RATE*100:.1f}% limit"
            )
            print(f"  [FAIL] Error rate too high — hardware would lose lock")
            if decode_errors[:5]:
                print(f"  First errors:")
                for e in decode_errors[:5]:
                    t = e.sample_pos / sr
                    print(f"    t={t:.4f}s  run={e.run_length}  {e.reason}")
        else:
            print(f"  [PASS] Error rate within tolerance")

        # -------------------------------------------------------------------
        # [4] Frame sync
        # -------------------------------------------------------------------
        print(f"\n  -- Frame Sync Report --")
        bit_vals = [b.bit for b in bits_decoded]
        sync     = sync_frames(bit_vals, trk)

        frame_bits = TD_FRAME_BITS if trk == "TD" else BD_FRAME_BITS
        secs_per_frame = frame_bits / BAUD_RATE
        total_dur  = len(bit_vals) / BAUD_RATE

        blank_ok_count = sum(1 for f in sync.frames if f.blank_ok)
        blank_ok_rate  = blank_ok_count / max(len(sync.frames), 1)

        print(f"  Lock status       : {'LOCKED' if sync.locked else 'NO LOCK'}")
        print(f"  Lock offset       : {sync.lock_offset} bits  ({sync.lock_offset/BAUD_RATE*1000:.1f} ms)")
        print(f"  Lock score        : {sync.score} consecutive clean frames")
        print(f"  Orphaned bits     : {sync.orphan_bits}")
        print(f"  Frames decoded    : {len(sync.frames):,}")
        print(f"  Blank-bit OK rate : {blank_ok_rate*100:.2f}%  (limit: {MIN_BLANK_BIT_RATE*100:.1f}%)")

        if not sync.locked:
            verdict_pass = False
            reasons.append(f"{trk}: failed to lock on frame boundaries")
            print(f"  [FAIL] No frame lock — hardware cannot decode animation")
        else:
            print(f"  [PASS] Frame lock acquired")

        if blank_ok_rate < MIN_BLANK_BIT_RATE:
            verdict_pass = False
            reasons.append(
                f"{trk}: blank-bit integrity {blank_ok_rate*100:.1f}% < {MIN_BLANK_BIT_RATE*100:.1f}%"
            )
            print(f"  [FAIL] Blank bit violations — frame alignment drifting")
        else:
            print(f"  [PASS] Blank bit integrity OK")

        # -------------------------------------------------------------------
        # [5] Channel timeline
        # -------------------------------------------------------------------
        print(f"\n  -- Channel Activity Timeline --")
        timeline = channel_timeline(sync.frames, sr, BAUD_RATE, trk)

        if not timeline:
            print(f"  (no channel activations detected)")
        else:
            # Show channels sorted by first activation time
            sorted_chs = sorted(timeline.items(), key=lambda kv: kv[1][0][0])
            print(f"  {'Channel':<40} {'On (s)':>8}  {'Off (s)':>8}  {'Dur (s)':>8}")
            print(f"  {'-'*40}  {'-'*8}  {'-'*8}  {'-'*8}")
            for ch, intervals in sorted_chs:
                for t_on, t_off in intervals:
                    dur = t_off - t_on
                    print(f"  {ch:<40} {t_on:>8.3f}  {t_off:>8.3f}  {dur:>8.3f}")

        # --- Optional frame dump ---
        if dump_frames:
            print(f"\n  -- Frame Dump (first 10) --")
            for f in sync.frames[:10]:
                bit_str = "".join(str(b) for b in f.bits)
                print(
                    f"  Frame {f.frame_index:04d}  "
                    f"bit[{f.bit_offset}]  "
                    f"blank={'OK' if f.blank_ok else 'ERR'}  "
                    f"active={f.active_channels or '[]'}"
                )
                print(f"    bits: {bit_str[:47]}...")

    # -----------------------------------------------------------------------
    # [6] Verdict
    # -----------------------------------------------------------------------
    print(f"\n{DIVIDER}")
    if verdict_pass:
        print(f"  VERDICT: PASS — hardware would accept this signal")
    else:
        print(f"  VERDICT: FAIL — hardware would reject this signal")
        for r in reasons:
            print(f"    - {r}")
    print(f"{DIVIDER}\n")

    return verdict_pass


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cyberstar Hardware Signal Emulator",
    )
    parser.add_argument("wav", help="Path to WAV file (2-ch KWS or 4-ch legacy)")
    parser.add_argument(
        "--tolerance", type=float, default=0.30,
        help="Run-length tolerance factor, default 0.30 (+-30%%)",
    )
    parser.add_argument(
        "--track", choices=["TD", "BD", "BOTH"], default="BOTH",
        help="Which track(s) to analyse, default BOTH",
    )
    parser.add_argument(
        "--dump-frames", action="store_true",
        help="Print first 10 decoded frames",
    )
    args = parser.parse_args()

    ok = run_sim(
        wav_path=args.wav,
        tolerance=args.tolerance,
        track=args.track,
        dump_frames=args.dump_frames,
    )
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
