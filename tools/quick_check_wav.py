"""
Step A: Quick numeric checker for the 4-channel RAE showtape WAV.
Usage: python tools/quick_check_wav.py path/to/file_4ch.wav
"""
import sys
import soundfile as sf
import numpy as np

if len(sys.argv) < 2:
    print("Usage: python tools/quick_check_wav.py file.wav")
    raise SystemExit

f = sys.argv[1]
data, sr = sf.read(f, always_2d=True)
n_ch = data.shape[1]
duration = data.shape[0] / sr

print("=" * 60)
print(f"File     : {f}")
print(f"Sample rate : {sr} Hz")
print(f"Channels    : {n_ch}")
print(f"Duration    : {duration:.2f} s")
print("=" * 60)

for i in range(n_ch):
    ch = data[:, i]
    peak = np.max(np.abs(ch))
    rms  = np.sqrt(np.mean(ch ** 2))
    std  = np.std(ch)
    print(f"  Ch{i}: peak={peak:.3f}  rms={rms:.3f}  std={std:.3f}")

def estimate_bitrate(ch, sr):
    s = np.sign(ch)
    s[s == 0] = 1
    edges = np.where(np.diff(s) != 0)[0]
    if len(edges) < 10:
        return None, 0
    intervals = np.diff(edges) / sr
    # A BMC bit = 2 half-period intervals on average
    return 1.0 / (np.mean(intervals) * 2.0), len(edges)

print()
print("Estimated bitrate per channel:")
for i in range(min(4, n_ch)):
    bps, n_edges = estimate_bitrate(data[:, i], sr)
    if bps:
        flag = " <-- DATA" if 3000 < bps < 6000 else " <-- AUDIO/NOISE"
        print(f"  Ch{i}: ~{bps:.0f} bps  ({n_edges} edges){flag}")
    else:
        print(f"  Ch{i}: too few edges — likely silence")

print("=" * 60)
print("EXPECTED: Ch0 & Ch1 music (no bps estimate) | Ch2 & Ch3 data ~4800 bps")
