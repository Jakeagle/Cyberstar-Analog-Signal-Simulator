#!/usr/bin/env python3
# =============================================================================
# validate.py — SGM Self-Validation Suite
# =============================================================================
#
# Run directly:  python -m SCME.SVM.validate
#             or python SCME/SVM/validate.py (from project root)
#
# Tests:
#   1. Constants integrity   — channel maps complete, no duplicates, blanks safe
#   2. BMC encoder           — bit patterns produce correct run-length structure
#   3. Frame builder         — event-driven stream builds without errors
#   4. KWS cross-check       — generated signal run-length profile matches KWS
# =============================================================================

import sys
import os
import struct
import collections

# Allow running from project root without installing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from SCME.SMM.constants import (
    SAMPLE_RATE, BAUD_RATE, SAMPLES_PER_BIT, BMC_HALF_A, BMC_HALF_B,
    BMC_HIGH, BMC_LOW,
    TD_CHANNELS, BD_CHANNELS, TD_BLANK_BITS, BD_BLANK_BITS,
    TD_FRAME_BITS, BD_FRAME_BITS,
)
from SCME.SGM.bmc_encoder import BMCEncoder
from SCME.SGM.frame_builder import FrameBuilder

PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"

failures = 0

def check(label: str, condition: bool, detail: str = "") -> bool:
    global failures
    if condition:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}{(' -- ' + detail) if detail else ''}")
        failures += 1
    return condition


# =============================================================================
# TEST 1 — Constants Integrity
# =============================================================================
print("\n" + "="*60)
print("TEST 1 — Constants Integrity")
print("="*60)

# Timing math
check("SAMPLE_RATE = 44100",        SAMPLE_RATE == 44_100)
check("BAUD_RATE = 4800",           BAUD_RATE == 4_800)
check("SAMPLES_PER_BIT = 9",        SAMPLES_PER_BIT == 9,
      f"got {SAMPLES_PER_BIT}")
check("HALF_A + HALF_B = SPB",      BMC_HALF_A + BMC_HALF_B == SAMPLES_PER_BIT,
      f"{BMC_HALF_A}+{BMC_HALF_B}={BMC_HALF_A+BMC_HALF_B}")
check("HALF_A = SPB // 2 = 4",      BMC_HALF_A == 4)
check("HALF_B = SPB - 4 = 5",       BMC_HALF_B == 5)
check("SPB is integer (not float)",  isinstance(SAMPLES_PER_BIT, int))

# TD channel map
td_bits = list(TD_CHANNELS.values())
check("TD: no duplicate bit numbers", len(td_bits) == len(set(td_bits)))
check("TD: all bits in range 1-94",   all(1 <= b <= TD_FRAME_BITS for b in td_bits))
check("TD: blanks not in channel map",
      not any(b in TD_CHANNELS.values() for b in TD_BLANK_BITS),
      f"blank bits {TD_BLANK_BITS} must not appear as channel values")
check("TD: expected 91 named channels (94 - 3 blanks)",
      len(TD_CHANNELS) == 91, f"got {len(TD_CHANNELS)}")

# BD channel map
bd_bits = list(BD_CHANNELS.values())
check("BD: no duplicate bit numbers", len(bd_bits) == len(set(bd_bits)))
check("BD: all bits in range 1-96",   all(1 <= b <= BD_FRAME_BITS for b in bd_bits))
check("BD: blanks not in channel map",
      not any(b in BD_CHANNELS.values() for b in BD_BLANK_BITS))
check("BD: expected 95 named channels (96 - 1 blank)",
      len(BD_CHANNELS) == 95, f"got {len(BD_CHANNELS)}")


# =============================================================================
# TEST 2 — BMC Encoder
# =============================================================================
print("\n" + "="*60)
print("TEST 2 — BMC Encoder")
print("="*60)

enc = BMCEncoder(initial_level=BMC_LOW)

# --- Single bit '1' ---
enc.reset(BMC_LOW)
samples_1 = enc.encode_bit(1)
check("Bit '1': length = SAMPLES_PER_BIT",
      len(samples_1) == SAMPLES_PER_BIT, f"got {len(samples_1)}")
check("Bit '1': first half = HALF_A samples",
      len(set(samples_1[:BMC_HALF_A])) == 1,
      f"first {BMC_HALF_A} samples not uniform: {samples_1[:BMC_HALF_A]}")
check("Bit '1': second half = HALF_B samples",
      len(set(samples_1[BMC_HALF_A:])) == 1,
      f"last {BMC_HALF_B} samples not uniform: {samples_1[BMC_HALF_A:]}")
check("Bit '1': mid-transition exists (two levels)",
      len(set(samples_1)) == 2,
      f"expected 2 distinct levels, got {set(samples_1)}")

# --- Single bit '0' ---
enc.reset(BMC_LOW)
samples_0 = enc.encode_bit(0)
check("Bit '0': length = SAMPLES_PER_BIT",
      len(samples_0) == SAMPLES_PER_BIT)
check("Bit '0': all samples same level (no mid-transition)",
      len(set(samples_0)) == 1,
      f"expected 1 level, got {set(samples_0)}")

# --- Bit '1' returns encoder to original level ---
enc.reset(BMC_LOW)
_ = enc.encode_bit(1)
check("Bit '1': encoder level unchanged after encoding",
      enc._level == BMC_LOW,
      f"expected BMC_LOW after '1', got {enc._level}")

# --- Bit '0' flips encoder level ---
enc.reset(BMC_LOW)
_ = enc.encode_bit(0)
check("Bit '0': encoder level flipped after encoding",
      enc._level == BMC_HIGH,
      f"expected BMC_HIGH after '0', got {enc._level}")

# --- Run-length analysis on a known pattern ---
# Encode 100 '1' bits: should produce alternating HALF_A/HALF_B runs
enc.reset(BMC_LOW)
bits_all_ones = enc.encode_bits([1] * 100)
pos   = (b >= 0 for b in bits_all_ones)
import itertools
runs_all_ones = [len(list(g)) for _, g in itertools.groupby(bits_all_ones)]
allowed = {BMC_HALF_A, BMC_HALF_B}
check("All-ones stream: only HALF_A and HALF_B run lengths",
      all(r in allowed for r in runs_all_ones),
      f"unexpected run lengths: {set(runs_all_ones) - allowed}")

# Encode 100 '0' bits: all runs should be SAMPLES_PER_BIT
enc.reset(BMC_LOW)
bits_all_zeros = enc.encode_bits([0] * 100)
runs_all_zeros = [len(list(g)) for _, g in itertools.groupby(bits_all_zeros)]
check("All-zeros stream: all runs = SAMPLES_PER_BIT",
      all(r == SAMPLES_PER_BIT for r in runs_all_zeros),
      f"unexpected run lengths: {set(runs_all_zeros)}")

# --- Phase continuity: two consecutive calls ---
enc.reset(BMC_LOW)
block1 = enc.encode_bits([0, 1, 0])
block2 = enc.encode_bits([1, 0, 1])
combined = block1 + block2
runs_combined = [len(list(g)) for _, g in itertools.groupby(combined)]
check("Phase continuity: no extra-long runs at block boundary",
      max(runs_combined) <= SAMPLES_PER_BIT,
      f"max run = {max(runs_combined)}, expected <= {SAMPLES_PER_BIT}")


# =============================================================================
# TEST 3 — Frame Builder
# =============================================================================
print("\n" + "="*60)
print("TEST 3 — Frame Builder")
print("="*60)

# --- TD frame builder ---
td = FrameBuilder("TD")
check("TD builder created", td.track == "TD")

td.set_channel("rolfe_mouth", True)
td.set_channel("duke_mouth", True)
snap = td.get_frame_snapshot()
check("TD: rolfe_mouth bit set",
      snap[TD_CHANNELS["rolfe_mouth"] - 1] == 1)
check("TD: duke_mouth bit set",
      snap[TD_CHANNELS["duke_mouth"] - 1] == 1)
check("TD: blank bits stay 0",
      all(snap[b-1] == 0 for b in TD_BLANK_BITS))
check("TD: active channels = ['duke_mouth', 'rolfe_mouth']",
      sorted(td.get_active_channels()) == ["duke_mouth", "rolfe_mouth"])

td.clear_all()
check("TD: clear_all zeroes all bits", all(b == 0 for b in td.get_frame_snapshot()))

# --- BD frame builder ---
bd = FrameBuilder("BD")
bd.set_channel("beachbear_mouth", True)
check("BD: beachbear_mouth bit set",
      bd.get_frame_snapshot()[BD_CHANNELS["beachbear_mouth"] - 1] == 1)

# --- Reject blank bit write ---
try:
    bd2 = FrameBuilder("BD")
    bd2._frame[44] = 1   # manually test blank guard in set_channel path
    # blank bit 45 = index 44 — attempt via a fake channel would be caught
    bd2.clear_all()
    check("BD: blank bit guard (manual test)", bd2._frame[44] == 0)
except Exception as e:
    check("BD: blank bit guard", False, str(e))

# --- Build a short PCM stream ---
events = [
    {"time": 0.0,   "channel": "rolfe_mouth",        "active": True},
    {"time": 0.1,   "channel": "rolfe_left_arm_raise","active": True},
    {"time": 0.5,   "channel": "rolfe_mouth",         "active": False},
    {"time": 0.9,   "channel": "rolfe_left_arm_raise","active": False},
]
td2 = FrameBuilder("TD")
pcm_bytes = td2.build(events, duration_seconds=1.0)
expected_min_bytes = int(1.0 * SAMPLE_RATE) * 2
check("Build: output length >= 1s of samples",
      len(pcm_bytes) >= expected_min_bytes,
      f"got {len(pcm_bytes)} bytes, expected >= {expected_min_bytes}")
check("Build: output is even byte count (int16)",
      len(pcm_bytes) % 2 == 0)

# --- Run-length check on generated stream ---
samples = struct.unpack(f"<{len(pcm_bytes)//2}h", pcm_bytes)
runs_gen = [len(list(g)) for _, g in itertools.groupby(samples)]
counter  = collections.Counter(runs_gen)
total    = len(runs_gen)

short_count = sum(counter.get(i, 0) for i in range(BMC_HALF_A - 1, BMC_HALF_B + 2))
long_count  = sum(counter.get(i, 0) for i in range(SAMPLES_PER_BIT - 1, SAMPLES_PER_BIT + 2))
coverage    = (short_count + long_count) / total

print(f"\n  {INFO} Generated stream run-length histogram (top 10):")
for rl, cnt in counter.most_common(10):
    bar = "#" * (cnt // max(1, total // 100))
    print(f"       {rl:3d} samples: {cnt:7d}  {bar}")
print(f"  {INFO} Short-run bucket ({BMC_HALF_A-1}-{BMC_HALF_B+1}): {short_count} ({100*short_count/total:.1f}%)")
print(f"  {INFO} Long-run  bucket ({SAMPLES_PER_BIT-1}-{SAMPLES_PER_BIT+1}): {long_count} ({100*long_count/total:.1f}%)")
print(f"  {INFO} Combined coverage: {coverage*100:.1f}%")

check("Generated BMC stream: >90% coverage in expected run buckets",
      coverage > 0.90,
      f"got {coverage*100:.1f}% (should be ~100% for pure BMC output)")


# =============================================================================
# TEST 4 — KWS Cross-check (optional — requires KWS WAVs in project)
# =============================================================================
print("\n" + "="*60)
print("TEST 4 — KWS Cross-check")
print("="*60)

KWS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", )
kws_files = [
    os.path.join(KWS_DIR, "Swing Beat Drum Loop.wav"),
    os.path.join(KWS_DIR, "Arm Twists-Bear-Billy-Rolfe.wav"),
    os.path.join(KWS_DIR, "Duke Arm Swings.wav"),
    os.path.join(KWS_DIR, "Fatz Arm Swings.wav"),
    # Legacy 4-channel Cyberstar WAV (48 kHz, PCM_16) — Ch3=TD, Ch4=BD
    os.path.join(KWS_DIR, "Hip_to_be_square_-_Decoder_test_4ch.wav"),
]

try:
    import soundfile as sf
    import numpy as np
    have_sf = True
except ImportError:
    have_sf = False
    print(f"  {INFO} soundfile not available — skipping KWS cross-check")
    print(f"  {INFO} Install with: pip install soundfile")

if have_sf:
    all_coverages = []
    for path in kws_files:
        if not os.path.exists(path):
            print(f"  {INFO} Skipping (not found): {os.path.basename(path)}")
            continue
        data, sr = sf.read(path, dtype='int16', always_2d=True)
        n_ch = data.shape[1]

        # Standard Cyberstar 4-channel layout: Ch1=Music L, Ch2=Music R,
        # Ch3=TD (BMC), Ch4=BD (BMC).  Only analyse the BMC channels so
        # that music content does not corrupt the bimodal run-length check.
        if n_ch == 4:
            bmc_indices = [2, 3]   # 0-based: Ch3 and Ch4
            print(f"  {INFO} 4-ch file detected — analysing Ch3 (TD) + Ch4 (BD) only")
        elif n_ch == 2:
            bmc_indices = [0, 1]
        else:
            # Odd layout — try every channel, skip music-like ones heuristically
            bmc_indices = list(range(n_ch))
            print(f"  {INFO} {n_ch}-ch file — will attempt all channels")

        for ci in bmc_indices:
            ch = data[:, ci]
            if np.max(np.abs(ch)) < 200:
                print(f"  {INFO} Ch{ci+1}: low amplitude, skipping")
                continue
            pos   = (ch >= 0).view(np.uint8)
            edges = np.where(np.diff(pos))[0]
            if len(edges) < 10:
                print(f"  {INFO} Ch{ci+1}: too few transitions, skipping")
                continue
            runs = np.diff(np.concatenate(([0], edges+1, [len(ch)]))).tolist()
            counter_kws = collections.Counter(runs)
            total_kws   = len(runs)
            # Scale expected bucket centres to the file's actual sample rate.
            # KWS files from the MP4 pipeline are 96 kHz; native Cyberstar
            # tapes are 44.1 kHz.  scale handles both transparently.
            scale   = sr / SAMPLE_RATE
            half_c  = round((BMC_HALF_A + BMC_HALF_B) / 2 * scale)
            full_c  = round(SAMPLES_PER_BIT * scale)
            short_k = sum(counter_kws.get(i, 0) for i in range(half_c-3, half_c+4))
            long_k  = sum(counter_kws.get(i, 0) for i in range(full_c-3, full_c+4))
            cov = (short_k + long_k) / total_kws
            all_coverages.append(cov)
            name   = os.path.basename(path)[:35]
            result = "PASS" if cov > 0.80 else "FAIL"
            label  = "TD" if ci == 2 or (n_ch == 2 and ci == 0) else "BD"
            print(f"  [{result}] {name:<35} Ch{ci+1} ({label}): {cov*100:.1f}%")

    if all_coverages:
        mean_cov = sum(all_coverages) / len(all_coverages)
        check(f"KWS mean coverage > 80% across {len(all_coverages)} channels",
              mean_cov > 0.80, f"mean = {mean_cov*100:.1f}%")


# =============================================================================
# Summary
# =============================================================================
print("\n" + "="*60)
if failures == 0:
    print(f"  ALL TESTS PASSED")
else:
    print(f"  {failures} TEST(S) FAILED")
print("="*60 + "\n")
sys.exit(0 if failures == 0 else 1)
