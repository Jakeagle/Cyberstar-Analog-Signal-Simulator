"""Proper sequential NRBF stream parser for .rshw files."""
import struct, os
from collections import Counter

def read7bit(data, pos):
    """Read a 7-bit encoded integer. Returns (value, new_pos)."""
    result, shift = 0, 0
    while True:
        b = data[pos]; pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80): break
        shift += 7
    return result, pos

def read_lpstr(data, pos):
    """Read length-prefixed UTF-8 string. Returns (str, new_pos)."""
    length, pos = read7bit(data, pos)
    s = data[pos:pos+length].decode('utf-8', errors='replace')
    return s, pos + length

def parse_nrbf(data):
    """Parse an NRBF stream sequentially, returning arrays found."""
    pos = 0
    arrays = []  # list of (recordType, objectId, primType, values, offset)

    prim_names = {1:'Boolean',2:'Byte',3:'Char',5:'Decimal',6:'Double',7:'Int16',
                  8:'Int32',9:'Int64',10:'SByte',11:'Single',12:'TimeSpan',
                  13:'DateTime',14:'UInt16',15:'UInt32',16:'UInt64',18:'String'}
    elem_sizes = {1:1,2:1,3:2,6:8,7:2,8:4,9:8,10:1,11:4,12:8,13:8,14:2,15:4,16:8}

    depth = 0
    while pos < len(data):
        rec_start = pos
        rec_type = data[pos]; pos += 1

        if rec_type == 0x00:  # SerializedStreamHeader
            major = struct.unpack_from('<i', data, pos)[0]; pos += 4
            minor = struct.unpack_from('<i', data, pos)[0]; pos += 4
            root_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            header_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start}] SerializedStreamHeader: major={major}, minor={minor}, rootId={root_id}, headerId={header_id}")

        elif rec_type == 0x0C:  # BinaryLibrary
            lib_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            lib_name, pos = read_lpstr(data, pos)
            print(f"[{rec_start}] BinaryLibrary id={lib_id}: {lib_name!r}")

        elif rec_type == 0x05:  # ClassWithMembersAndTypes
            obj_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            class_name, pos = read_lpstr(data, pos)
            member_count = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start}] ClassWithMembersAndTypes id={obj_id}: {class_name!r}, {member_count} members")
            member_names = []
            for _ in range(member_count):
                name, pos = read_lpstr(data, pos)
                member_names.append(name)
                print(f"    member: {name!r}")
            # BinaryTypeEnum array
            print(f"    BinaryTypes: ", end='')
            btypes = []
            for _ in range(member_count):
                bt = data[pos]; pos += 1
                btypes.append(bt)
            print(btypes)
            # AdditionalTypeInfo
            print(f"    AdditionalInfo: ", end='')
            addl = []
            for bt in btypes:
                if bt == 0:   # Primitive
                    pte = data[pos]; pos += 1
                    addl.append(f"PrimitiveType({prim_names.get(pte,'?')}={pte})")
                elif bt == 3: # SystemClass
                    cname, pos = read_lpstr(data, pos)
                    addl.append(f"SystemClass({cname!r})")
                elif bt == 4: # Class
                    cname, pos = read_lpstr(data, pos)
                    lid = struct.unpack_from('<i', data, pos)[0]; pos += 4
                    addl.append(f"Class({cname!r}, libId={lid})")
                else:
                    addl.append(f"BinaryType({bt})")
            print(addl)
            lib_id2 = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"    LibraryId={lib_id2}")
            print(f"    [Cursor now at {pos}, next byte=0x{data[pos]:02X}]")

        elif rec_type == 0x0F:  # ArraySinglePrimitive
            obj_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            prim_type = data[pos]; pos += 1
            arr_len = struct.unpack_from('<i', data, pos)[0]; pos += 4
            ptype_name = prim_names.get(prim_type, f'?{prim_type}')
            elem_size = elem_sizes.get(prim_type, 1)
            data_start = pos
            print(f"[{rec_start}] ArraySinglePrimitive id={obj_id}: {ptype_name}[{arr_len}] at offset {data_start}")
            if prim_type == 2:  # Byte
                raw = data[data_start:data_start + arr_len]
                arrays.append(('audio', obj_id, raw, rec_start))
                print(f"    → AUDIO BYTES: {arr_len}")
                print(f"      First 44 hex: {raw[:44].hex()}")
                if raw[:4] == b'RIFF':
                    fmt_tag = struct.unpack_from('<H', raw, 20)[0]
                    channels = struct.unpack_from('<H', raw, 22)[0]
                    sr = struct.unpack_from('<I', raw, 24)[0]
                    bps = struct.unpack_from('<H', raw, 34)[0]
                    byte_rate = struct.unpack_from('<I', raw, 28)[0]
                    dur = (arr_len - 44) / byte_rate if byte_rate else 0
                    print(f"      ✅ RIFF WAV: fmt={fmt_tag}({'PCM' if fmt_tag==1 else 'OTHER'}), ch={channels}, sr={sr}, bps={bps}, dur={dur:.2f}s")
                else:
                    print(f"      ❌ NOT RIFF — raw PCM bytes (no WAV wrapper)")
            elif prim_type == 8:  # Int32
                vals = list(struct.unpack_from(f'<{arr_len}i', data, data_start))
                arrays.append(('signal', obj_id, vals, rec_start))
                zeros = vals.count(0)
                nonzero = [v for v in vals if v != 0]
                print(f"    → SIGNAL: {arr_len} int32s, {zeros} zeros (frames @60fps={zeros/60:.1f}s), {len(nonzero)} nonzero")
                print(f"      First 80: {vals[:80]}")
                print(f"      Max={max(vals) if vals else 0}, Min={min(vals) if vals else 0}")
                td = [v for v in nonzero if 1 <= v <= 150]
                bd = [v for v in nonzero if 151 <= v <= 300]
                print(f"      TD events (1-150): {len(td)}, BD events (151-300): {len(bd)}")
                if td: print(f"      TD most common: {Counter(td).most_common(10)}")
                if bd: print(f"      BD most common: {Counter(bd).most_common(10)}")
            pos += arr_len * elem_size

        elif rec_type == 0x07:  # BinaryObjectString
            obj_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            s, pos = read_lpstr(data, pos)
            print(f"[{rec_start}] BinaryObjectString id={obj_id}: {s!r}")

        elif rec_type == 0x0A:  # ObjectNull
            print(f"[{rec_start}] ObjectNull")

        elif rec_type == 0x0B:  # MessageEnd
            print(f"[{rec_start}] MessageEnd ← stream complete")
            break

        elif rec_type == 0x01:  # ClassWithId
            obj_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            meta_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start}] ClassWithId id={obj_id}, metaId={meta_id}")

        elif rec_type == 0x09:  # MemberPrimitiveTyped
            prim_type = data[pos]; pos += 1
            elem_size = elem_sizes.get(prim_type, 1)
            raw = data[pos:pos+elem_size]; pos += elem_size
            print(f"[{rec_start}] MemberPrimitiveTyped type={prim_names.get(prim_type,'?')}: {raw.hex()}")

        else:
            print(f"[{rec_start}] *** UNKNOWN record type 0x{rec_type:02X} — cannot continue parse ***")
            print(f"    Context bytes: {data[rec_start:rec_start+32].hex()}")
            break

    return arrays

def analyze(path):
    print(f"\n{'='*70}")
    print(f"FILE: {path}")
    print(f"SIZE: {os.path.getsize(path)} bytes")
    print('='*70)
    with open(path, 'rb') as f:
        raw = f.read()
    arrays = parse_nrbf(raw)
    return arrays

base = r"c:\Users\New User\Documents\VScodeFiles\Cyberstar Simulator"
print(">>> WORKING SHOWTAPE <<<")
w = analyze(os.path.join(base, "WorkingShowTape.rshw"))
print("\n>>> CONVERTED SHOWTAPE <<<")
c = analyze(os.path.join(base, "Come_Together_Python_3_4ch (1) (1).rshw"))
