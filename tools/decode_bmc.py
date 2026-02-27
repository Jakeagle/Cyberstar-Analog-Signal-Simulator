"""
Step B: Bit-level BMC decoder. Extracts edges -> bits -> frame dumps.
Usage: python tools/decode_bmc.py path/to/file_4ch.wav [td_ch] [bd_ch] [bps]
  td_ch / bd_ch default to 2 / 3 (Ch2=TD, Ch3=BD per RetroMation spec)
  bps defaults to 4800 (48000Hz / 4800bps = exactly 10 samples/bit)
"""
import sys
import soundfile as sf
import numpy as np

if len(sys.argv) < 2:
    print("Usage: python tools/decode_bmc.py file.wav [td_ch=2] [bd_ch=3] [bps=4800]")
    raise SystemExit

path   = sys.argv[1]
td_idx      = int(sys.argv[2])   if len(sys.argv) > 2 else 2
bd_idx      = int(sys.argv[3])   if len(sys.argv) > 3 else 3
FORCE_BPS   = float(sys.argv[4]) if len(sys.argv) > 4 else 4800.0  # RetroMation rate

data, sr = sf.read(path, always_2d=True)
print(f"Loaded: {path}  sr={sr}  channels={data.shape[1]}")

def decode_channel(ch, sr, label, n_frame_bits=128):
    # Skip pilot region (first 3 seconds = 3*sr samples); data frames start after
    pilot_end = int(sr * 3.0)
    post_pilot = ch[pilot_end:]
    s = np.sign(post_pilot)
    s[s == 0] = 1
    edges = np.where(np.diff(s) != 0)[0]
    if len(edges) < 10:
        print(f"  {label}: not enough edges after pilot ({len(edges)})")
        return

    intervals = np.diff(edges) / sr
    mean_interval = np.mean(intervals)
    edge_est_bps = 1.0 / (mean_interval * 2.0)

    # The edge-based estimator under-reads for data-heavy 0-bit streams.
    # Use the known Pianocorder bitrate (4500 bps) for actual sampling.
    samples_per_bit = sr / FORCE_BPS

    print(f"\n{label}:")
    print(f"  Edges       : {len(edges)}")
    print(f"  Edge est bps: {edge_est_bps:.1f} bps  (NOTE: underestimates for 0-heavy data)")
    print(f"  Using bps   : {FORCE_BPS:.1f} bps  (forced Pianocorder rate)")
    print(f"  Samp/bit    : {samples_per_bit:.2f}  (target {sr/4500:.2f})")

    # --- Proper edge-interval BMC decoder ------------------------------------
    # BMC is DIFFERENTIAL: you cannot decode it by sampling absolute level.
    # Rule: measure gap between successive zero-crossings (edges).
    #   short gap (~spb/2) = half-bit period -> part of a logical 1
    #   long  gap (~spb)   = full-bit period -> a logical 0
    # Two consecutive short gaps = one logical 1 bit.
    # One long gap = one logical 0 bit.
    ispb = max(1, int(samples_per_bit))
    short_thresh = samples_per_bit * 0.75  # anything < 75% of spb = short

    # Get edge positions in the post-pilot region
    s = np.sign(post_pilot).astype(np.float32)
    s[s == 0] = 1
    edge_pos = np.where(np.diff(s) != 0)[0].astype(np.int64)

    if len(edge_pos) < 4:
        print(f"  Not enough edges to decode.")
        return

    gaps = np.diff(edge_pos)
    bits = []
    gi = 0
    while gi < len(gaps) and len(bits) < n_frame_bits * 60:  # decode 60 frames
        g = gaps[gi]
        if g < short_thresh:
            # Two short gaps = one 1-bit
            if gi + 1 < len(gaps) and gaps[gi + 1] < short_thresh:
                bits.append(1)
                gi += 2
            else:
                # Orphan short gap — skip
                gi += 1
        else:
            # Long gap = one 0-bit
            bits.append(0)
            gi += 1

    # Find first 0xFF sync by searching for 8 consecutive 1-bits at ANY bit offset.
    # (Byte-aligned search misses by 1 bit due to pilot/data boundary orphan edge.)
    def bits_to_bytes_msb(b):
        out = []
        for i in range(0, len(b) - 7, 8):
            val = 0
            for j in range(8): val = (val << 1) | b[i + j]
            out.append(val)
        return out

    sync_bit_offset = None
    for bit_off in range(min(n_frame_bits * 2, len(bits) - 8)):
        if all(b == 1 for b in bits[bit_off: bit_off + 8]):
            sync_bit_offset = bit_off
            break

    if sync_bit_offset is not None:
        aligned_bits = bits[sync_bit_offset:]
        aligned_bytes = bits_to_bytes_msb(aligned_bits)
        print(f"  0xFF sync found : at bit offset {sync_bit_offset}")
    else:
        aligned_bytes = bits_to_bytes_msb(bits)
        print(f"  WARNING: No 8-consecutive-1s found in decoded bits")

    print(f"  First 128 bits  :")
    print("  " + "".join(str(b) for b in bits[:128]))

    frame1 = aligned_bytes[:n_frame_bits // 8]
    frame2 = aligned_bytes[n_frame_bits // 8: n_frame_bits // 4]
    print(f"  Frame 1 hex     : {' '.join(f'{b:02X}' for b in frame1)}")
    print(f"  Frame 2 hex     : {' '.join(f'{b:02X}' for b in frame2)}")

    if frame1 and frame1[0] == 0xFF:
        print(f"  Sync byte OK (0xFF)")
        anim = frame1[1:]
        active_bits = []
        for byte_i, byte_val in enumerate(anim):
            for bit_i in range(8):
                if byte_val & (0x80 >> bit_i):
                    active_bits.append(byte_i * 8 + bit_i)
        print(f"  Active anim bits: {active_bits if active_bits else 'none (all zero — no movement this frame)'}")
    else:
        sync_byte = f"0x{frame1[0]:02X}" if frame1 else "??"
        print(f"  Sync byte = {sync_byte} — NOT 0xFF, frame not aligned")

    # Scan first 50 frames to find any with non-zero animation
    FRAME_BYTES = n_frame_bits // 8
    print(f"\n  Scanning first 50 frames for non-zero movement data...")
    found_movement = False
    for fi in range(50):
        fstart = fi * FRAME_BYTES
        fend   = fstart + FRAME_BYTES
        frame  = aligned_bytes[fstart:fend]
        if len(frame) < FRAME_BYTES:
            break
        if frame[0] != 0xFF:
            continue
        if any(b != 0 for b in frame[1:]):
            active = [byte_i * 8 + bit_i
                      for byte_i, bval in enumerate(frame[1:])
                      for bit_i in range(8) if bval & (0x80 >> bit_i)]
            hex_str = ' '.join(f'{b:02X}' for b in frame)
            print(f"  Frame {fi:3d} (t≈{fi/35.16:.2f}s): {hex_str}")
            print(f"              Active bits: {active}")
            found_movement = True
    if not found_movement:
        print(f"  No movement found in first 50 frames (song may start moving later)")

decode_channel(data[:, td_idx], sr, f"Ch{td_idx} (TD)")
decode_channel(data[:, bd_idx], sr, f"Ch{bd_idx} (BD)")
print("\nDone.")
