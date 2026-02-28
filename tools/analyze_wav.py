"""
analyze_wav.py  —  KWS (Known Working System) reference WAV batch analyzer
Analyzes one or more Cyberstar hardware recordings to cross-validate BMC timing.

RELIABILITY NOTES (MP4-extracted WAVs):
  [OK] TRUSTWORTHY  -- Frequency structure (baud rate fingerprint).
                    AAC lossy compression cannot change HOW OFTEN the signal
                    transitions, only how sharply.  The 2:1 run-length ratio
                    (half-bit vs full-bit in BMC) survives lossy codecs.
  [OK] TRUSTWORTHY  -- The algebraic confirmation: 44100 / 4800 = 9.1875 ->
                    floor to 9 samples/bit.  This is independent of the WAV.
  [NO] NOT RELIABLE -- Exact amplitude and transition-edge timing at sub-sample
                    level.  AAC smooths square-wave edges -> blob the clusters.
  [!!] ARTIFACT    -- Run smearing (e.g. 10->11 samp, 20->21-22 samp) is a mix
                    of 96kHz resample and AAC edge smoothing. Not a hardware trait.

CROSS-VALIDATION STRATEGY:
  Add more WAVs (different movements, characters, dates from the archive).
  If every file independently produces the same bimodal ratio at the same
  cluster centers, the baud-rate conclusion is confirmed beyond AAC doubt.

Usage:
  Drop WAV files into the project root or a subfolder, then run this script.
  It will auto-discover all .wav files under the project directory.
"""
import soundfile as sf
import numpy as np
import collections
import pathlib
import sys

PROJECT_ROOT = pathlib.Path(r"C:\Users\New User\Documents\VScodeFiles\Cyberstar Simulator")

# ── Gather WAV files (deduplicated — Windows FS is case-insensitive) ────────
_seen = set()
_all  = sorted(PROJECT_ROOT.rglob("*.wav")) + sorted(PROJECT_ROOT.rglob("*.WAV"))
wav_files = []
for p in _all:
    key = p.resolve()
    if key not in _seen:
        _seen.add(key)
        wav_files.append(p)
wav_files = [p for p in wav_files if ".venv" not in p.parts and "stable-diffusion" not in str(p)]

if not wav_files:
    print("No WAV files found in project.")
    sys.exit(1)

print(f"Found {len(wav_files)} WAV file(s):\n")
for p in wav_files:
    print(f"  {p.relative_to(PROJECT_ROOT)}")
print()

# ── Per-file analysis ─────────────────────────────────────────────────────────
all_results = []  # for cross-validation summary at the end

for wav_path in wav_files:
    print(f"\n{'='*65}")
    print(f"  FILE: {wav_path.name}")
    print(f"{'='*65}")

    try:
        data, sr = sf.read(str(wav_path), dtype='int16', always_2d=True)
    except Exception as e:
        print(f"  ERROR reading file: {e}")
        continue

    channels = data.shape[1]
    nframes  = data.shape[0]
    duration = nframes / sr
    print(f"  Sample rate : {sr} Hz")
    print(f"  Channels    : {channels}")
    print(f"  Duration    : {duration:.4f} s  ({duration/60:.2f} min)")
    print(f"  Bit depth   : 16-bit")

    file_result = {"name": wav_path.name, "sr": sr, "channels": []}

    for ci in range(channels):
        ch = data[:, ci]
        peak = int(np.max(np.abs(ch)))
        rms  = float(np.sqrt(np.mean(ch.astype(np.int64)**2)))
        print(f"\n  Channel {ci+1}:  peak={peak}  rms={rms:.1f}")

        if peak < 200:
            print("    (silent — skipping)")
            continue

        # Run-length analysis
        pos   = (ch >= 0).view(np.uint8)
        edges = np.where(np.diff(pos))[0]
        if len(edges) < 10:
            print("    (no transitions — skipping)")
            continue
        runs = np.diff(np.concatenate(([0], edges+1, [len(ch)]))).tolist()
        counter = collections.Counter(runs)
        total   = len(runs)

        # Display histogram for bins 1–40
        print(f"\n    Run-length histogram (bins 1–40):")
        for i in range(1, 41):
            bar = '#' * (counter.get(i,0) // max(1, total//200))
            print(f"    {i:3d}: {counter.get(i,0):7d}  {bar}")

        # Identify the two dominant clusters
        top = counter.most_common(5)
        sorted_top = sorted([x[0] for x in top])
        print(f"\n    Top run lengths: {top}")

        # Buckets based on sample rate scaling of 4800-baud half/full period
        # At 44100 Hz: half=4.59, full=9.19 → round to 5/9
        # At 96000 Hz: half=10, full=20
        scale = sr / 44100
        half_center = round(9.1875 * scale / 2)   # half-period
        full_center = round(9.1875 * scale)        # full-period

        half_count = sum(counter.get(i,0) for i in range(half_center-3, half_center+4))
        full_count = sum(counter.get(i,0) for i in range(full_center-3, full_center+4))
        together   = half_count + full_count

        print(f"\n    4800-baud hypothesis (scaled to {sr} Hz):")
        print(f"      Expected half-period center : {half_center} samp  (±3)")
        print(f"      Expected full-period center : {full_center} samp  (±3)")
        print(f"      Short-run bucket ({half_center-3}–{half_center+3}): {half_count:6d}  ({100*half_count/total:.1f}%)")
        print(f"      Long-run  bucket ({full_center-3}–{full_center+3}): {full_count:6d}  ({100*full_count/total:.1f}%)")
        print(f"      Combined coverage            : {together:6d}  ({100*together/total:.1f}%)")

        if together / total > 0.80:
            verdict = "[STRONG]   confirms 4800 baud BMC"
        elif together / total > 0.60:
            verdict = "[MODERATE] likely 4800 baud, more files needed"
        else:
            verdict = "[WEAK]     does not match 4800 baud hypothesis"
        print(f"      Verdict: {verdict}")

        file_result["channels"].append({
            "ch": ci+1,
            "sr": sr,
            "coverage": together / total,
            "half_center": half_center,
            "full_center": full_center,
            "verdict": verdict,
        })

    all_results.append(file_result)

# ── Cross-validation summary ──────────────────────────────────────────────────
print(f"\n\n{'='*65}")
print("  CROSS-VALIDATION SUMMARY")
print(f"{'='*65}")
print(f"  {'File':<40} {'Ch':<4} {'Coverage'}")
print(f"  {'-'*60}")
coverages = []
for fr in all_results:
    for ch in fr["channels"]:
        cov = ch["coverage"]
        coverages.append(cov)
        flag = "[OK] " if cov > 0.80 else ("[!!]" if cov > 0.60 else "[NO]")
        print(f"  {fr['name'][:40]:<40} {ch['ch']:<4} {flag} {cov*100:.1f}%")

if coverages:
    mean_cov = np.mean(coverages)
    print(f"\n  Mean coverage across all channels: {mean_cov*100:.1f}%")
    if mean_cov > 0.80:
        print(f"  [CONFIRMED] 4800 baud @ 44100 Hz CONFIRMED across {len(coverages)} channel(s).")
        print(f"     samples/bit = int(44100/4800) = 9  (floor of 9.1875)")
    elif mean_cov > 0.60:
        print(f"  [PARTIAL] Add more KWS files to strengthen confidence.")
    else:
        print(f"  [FAIL] Hypothesis not supported -- review files for non-BMC content.")

    print(f"\n  Algebraic confirmation (independent of WAV quality):")
    print(f"     44100 / 4800 = {44100/4800:.6f} samples/bit")
    print(f"     Integer: 9 samples/bit  |  Fractional remainder: {44100/4800 - 9:.6f}")
    print(f"     At 96kHz (resampled): 96000 / 4800 = {96000/4800:.1f} samples/bit (exact integer)")

