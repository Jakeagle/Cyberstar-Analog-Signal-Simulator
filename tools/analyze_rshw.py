"""Analyze and compare .rshw files (NRBF BinaryFormatter format)."""
import struct, sys, os

def analyze_rshw(path):
    print(f"\n{'='*70}")
    print(f"FILE: {path}")
    print('='*70)
    with open(path, 'rb') as f:
        raw = f.read()
    print(f"Total bytes: {len(raw)}")
    print(f"First 80 bytes (hex): {raw[:80].hex()}")
    print(f"First 80 bytes (repr): {repr(raw[:80])}")

    # Find ArraySinglePrimitive records (0x0F) by scanning
    print("\n--- ArraySinglePrimitive (0x0F) records ---")
    i = 0
    prim_names = {1:'Boolean',2:'Byte',3:'Char',5:'Decimal',6:'Double',7:'Int16',
                  8:'Int32',9:'Int64',10:'SByte',11:'Single',12:'TimeSpan',
                  13:'DateTime',14:'UInt16',15:'UInt32',16:'UInt64',18:'String'}
    elem_sizes = {2:1,7:2,8:4,9:8,11:4,14:2,15:4,16:8}
    audio_data = None
    signal_data = None

    while i < len(raw) - 10:
        if raw[i] == 0x0F:
            obj_id   = struct.unpack_from('<i', raw, i+1)[0]
            prim_type = raw[i+5]
            arr_len  = struct.unpack_from('<i', raw, i+6)[0]
            ptype_name = prim_names.get(prim_type, f'?{prim_type}')
            data_start = i + 10
            elem_size  = elem_sizes.get(prim_type, 1)
            total_data = arr_len * elem_size

            # Sanity check: length must be plausible
            if arr_len < 0 or total_data > len(raw) - data_start + 100:
                i += 1
                continue

            data_bytes = raw[data_start:data_start + total_data]
            print(f"\n  Offset {i}: objId={obj_id}, primType={ptype_name}({prim_type}), length={arr_len}")
            print(f"  dataStart={data_start}, totalDataBytes={len(data_bytes)}")

            if prim_type == 2:  # Byte array → audioData
                audio_data = data_bytes
                duration_s = arr_len / (44100 * 2 * 2)  # stereo 16-bit
                print(f"  → AUDIO DATA candidate: {arr_len} bytes")
                print(f"    Interpreted as stereo 16-bit @ 44100 Hz: {duration_s:.2f}s")
                print(f"    First 44 bytes (hex): {data_bytes[:44].hex()}")
                if data_bytes[:4] == b'RIFF':
                    print(f"    ✅ Valid RIFF header")
                    # Parse WAV header
                    if len(data_bytes) > 36:
                        riff_size = struct.unpack_from('<I', data_bytes, 4)[0]
                        fmt_tag   = struct.unpack_from('<H', data_bytes, 20)[0]
                        channels  = struct.unpack_from('<H', data_bytes, 22)[0]
                        sample_rate = struct.unpack_from('<I', data_bytes, 24)[0]
                        bits      = struct.unpack_from('<H', data_bytes, 34)[0]
                        print(f"    RIFF size={riff_size}, format={fmt_tag} ({'PCM' if fmt_tag==1 else 'OTHER'})")
                        print(f"    Channels={channels}, SampleRate={sample_rate}, BitsPerSample={bits}")
                        true_dur = (arr_len - 44) / (sample_rate * channels * bits // 8)
                        print(f"    True audio duration: {true_dur:.2f}s")
                else:
                    print(f"    ❌ NOT a RIFF WAV - raw PCM or garbage")
                i += 10 + total_data

            elif prim_type == 8:  # Int32 array → signalData
                vals = list(struct.unpack_from(f'<{arr_len}i', raw, data_start))
                signal_data = vals
                print(f"  → SIGNAL DATA candidate: {arr_len} int32 values")
                print(f"    First 80 values: {vals[:80]}")
                zero_count   = vals.count(0)
                nonzero_vals = [v for v in vals if v != 0]
                max_val = max(vals) if vals else 0
                min_val = min(vals) if vals else 0
                print(f"    Zero count (frame delimiters): {zero_count}")
                print(f"    Non-zero count (active bits):  {len(nonzero_vals)}")
                print(f"    Value range: {min_val} .. {max_val}")
                print(f"    Non-zero values (first 40):    {nonzero_vals[:40]}")
                # Estimate frame count and duration
                if zero_count > 0:
                    est_duration = zero_count / 60.0
                    print(f"    Estimated frames: {zero_count}, ~{est_duration:.2f}s at 60fps")
                # Bit bucket analysis
                td_bits = [v for v in nonzero_vals if 1 <= v <= 150]
                bd_bits = [v for v in nonzero_vals if 151 <= v <= 300]
                print(f"    TD bit events (1-150):  {len(td_bits)}")
                print(f"    BD bit events (151-300): {len(bd_bits)}")
                if td_bits:
                    from collections import Counter
                    td_hist = Counter(td_bits).most_common(10)
                    print(f"    Most common TD bits: {td_hist}")
                if bd_bits:
                    from collections import Counter
                    bd_hist = Counter(bd_bits).most_common(10)
                    print(f"    Most common BD bits: {bd_hist}")
                i += 10 + total_data
            else:
                i += 1
        else:
            i += 1

    # Summary
    print(f"\n--- SUMMARY ---")
    print(f"  Audio found:  {'YES' if audio_data else 'NO'}")
    print(f"  Signal found: {'YES' if signal_data else 'NO'}")

base = r"c:\Users\New User\Documents\VScodeFiles\Cyberstar Simulator"
analyze_rshw(os.path.join(base, "WorkingShowTape.rshw"))
analyze_rshw(os.path.join(base, "Come_Together_Python_3_4ch (1) (1).rshw"))
