"""
Deep byte-level NRBF comparison between working and converted .rshw files.
Reads the working file's structure as ground truth, then checks the new file.
"""
import struct, os

def read7bit(data, pos):
    result, shift = 0, 0
    while True:
        b = data[pos]; pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80): break
        shift += 7
    return result, pos

def read_lpstr(data, pos):
    length, pos = read7bit(data, pos)
    return data[pos:pos+length].decode('utf-8', errors='replace'), pos + length

def read_i32(data, pos):
    return struct.unpack_from('<i', data, pos)[0], pos + 4

def read_u32(data, pos):
    return struct.unpack_from('<I', data, pos)[0], pos + 4

PRIM_NAMES = {1:'Boolean',2:'Byte',3:'Char',5:'Decimal',6:'Double',7:'Int16',
              8:'Int32',9:'Int64',10:'SByte',11:'Single',12:'TimeSpan',
              13:'DateTime',14:'UInt16',15:'UInt32',16:'UInt64',18:'String'}
PRIM_SIZES = {1:1,2:1,3:2,5:16,6:8,7:2,8:4,9:8,10:1,11:4,12:8,13:8,14:2,15:4,16:8}
BTYPE_NAMES = {0:'Primitive',1:'String',2:'Object',3:'SystemClass',4:'Class',
               5:'ObjectArray',6:'StringArray',7:'PrimitiveArray'}
REC_NAMES = {0:'SerializedStreamHeader',1:'ClassWithId',2:'SystemClassWithMembers',
             3:'ClassWithMembers',4:'SystemClassWithMembersAndTypes',
             5:'ClassWithMembersAndTypes',6:'SystemClassWithMembersAndTypes',
             7:'BinaryObjectString',8:'BinaryArray',9:'MemberPrimitiveTyped',
             10:'ObjectNull',11:'MessageEnd',12:'BinaryLibrary',
             13:'ObjectNullMultiple256',14:'ObjectNullMultiple',
             15:'ArraySinglePrimitive',16:'ArraySingleObject',
             17:'ArraySingleString',21:'MethodCall',22:'MethodReturn'}

def parse_nrbf_detailed(data, label):
    print(f"\n{'='*70}")
    print(f"  {label}  |  {len(data)} bytes")
    print('='*70)
    pos = 0
    arrays_found = {}

    while pos < len(data):
        rec_start = pos
        rec_type = data[pos]; pos += 1
        rname = REC_NAMES.get(rec_type, f'UNKNOWN(0x{rec_type:02X})')

        if rec_type == 0:    # SerializedStreamHeader
            root_id,   pos = read_i32(data, pos)
            header_id, pos = read_i32(data, pos)
            major,     pos = read_i32(data, pos)
            minor,     pos = read_i32(data, pos)
            print(f"[{rec_start:08d}] SerializedStreamHeader: rootId={root_id}, headerId={header_id}, v{major}.{minor}")

        elif rec_type == 12:  # BinaryLibrary
            lib_id, pos = read_i32(data, pos)
            name,   pos = read_lpstr(data, pos)
            print(f"[{rec_start:08d}] BinaryLibrary id={lib_id}: {name!r}")

        elif rec_type == 5:   # ClassWithMembersAndTypes
            obj_id,   pos = read_i32(data, pos)
            cname,    pos = read_lpstr(data, pos)
            mcount,   pos = read_i32(data, pos)
            print(f"[{rec_start:08d}] ClassWithMembersAndTypes id={obj_id}: {cname!r}, {mcount} members")
            mnames = []
            for _ in range(mcount):
                n, pos = read_lpstr(data, pos); mnames.append(n)
            for n in mnames: print(f"    member: {n!r}")
            btypes = list(data[pos:pos+mcount]); pos += mcount
            print(f"    BinaryTypeEnums: {[BTYPE_NAMES.get(b,b) for b in btypes]} = {btypes}")
            addl = []
            for bt in btypes:
                if bt == 0:   # Primitive
                    pte = data[pos]; pos += 1
                    addl.append(f"PrimType={PRIM_NAMES.get(pte,'?')}({pte})")
                elif bt == 7: # PrimitiveArray
                    pte = data[pos]; pos += 1
                    addl.append(f"PrimArrayType={PRIM_NAMES.get(pte,'?')}({pte})")
                elif bt in (3,4): # SystemClass / Class
                    n, pos = read_lpstr(data, pos)
                    if bt == 4:
                        lid, pos = read_i32(data, pos)
                        addl.append(f"Class({n!r}, lib={lid})")
                    else:
                        addl.append(f"SystemClass({n!r})")
                else:
                    addl.append(f"BinaryType({bt})")
            print(f"    AdditionalTypeInfo: {addl}")
            lib_id2, pos = read_i32(data, pos)
            print(f"    LibraryId={lib_id2}")
            print(f"    >>> Member VALUES follow from offset {pos} (next byte: 0x{data[pos]:02X}) <<<")

        elif rec_type == 15:  # ArraySinglePrimitive
            obj_id,   pos = read_i32(data, pos)
            arr_len,  pos = read_i32(data, pos)
            prim_type = data[pos]; pos += 1
            pname = PRIM_NAMES.get(prim_type, f'?{prim_type}')
            esize = PRIM_SIZES.get(prim_type, 1)
            data_start = pos
            print(f"[{rec_start:08d}] ArraySinglePrimitive id={obj_id}: {pname}[{arr_len}] @ data offset {data_start}")
            arrays_found[obj_id] = (prim_type, arr_len, data_start)
            if prim_type == 2:   # Byte
                raw = data[data_start:data_start+min(arr_len, 48)]
                print(f"    First 48 bytes: {raw.hex()}")
                if data[data_start:data_start+4] == b'RIFF':
                    fmt_tag = struct.unpack_from('<H', data, data_start+20)[0]
                    channels= struct.unpack_from('<H', data, data_start+22)[0]
                    sr      = struct.unpack_from('<I', data, data_start+24)[0]
                    bps     = struct.unpack_from('<H', data, data_start+34)[0]
                    br      = struct.unpack_from('<I', data, data_start+28)[0]
                    dur     = (arr_len - 44) / br if br else 0
                    print(f"    ✅ RIFF WAV: fmt={fmt_tag}({'PCM' if fmt_tag==1 else 'OTHER'}), ch={channels}, sr={sr}, bps={bps}, br={br}")
                    print(f"    Duration = {dur:.2f}s")
                else:
                    print(f"    ❌  NOT a RIFF WAV header — raw bytes, RR-Engine won't play audio")
            elif prim_type == 8: # Int32
                count = min(arr_len, 120)
                vals = list(struct.unpack_from(f'<{count}i', data, data_start))
                print(f"    Total ints: {arr_len}")
                print(f"    First {count}: {vals}")
                zeros   = sum(1 for v in vals if v == 0)
                nonzero = [v for v in vals if v != 0]
                print(f"    In first {count}: {zeros} zeros, nonzero: {nonzero[:30]}")
                if arr_len > 0:
                    all_vals = list(struct.unpack_from(f'<{arr_len}i', data, data_start))
                    all_zeros = all_vals.count(0)
                    all_nz = [v for v in all_vals if v != 0]
                    td = [v for v in all_nz if 1 <= v <= 150]
                    bd = [v for v in all_nz if 151 <= v <= 300]
                    bad = [v for v in all_nz if v > 300 or v < 0]
                    print(f"    ALL: {arr_len} ints, {all_zeros} delimiters (~{all_zeros/60:.1f}s @ 60fps)")
                    print(f"    TD events (1-150): {len(td)}, BD events (151-300): {len(bd)}, INVALID (>300 or <0): {len(bad)}")
                    if bad: print(f"    *** INVALID values (first 10): {bad[:10]} ***")
            pos += arr_len * esize

        elif rec_type == 10: # ObjectNull
            print(f"[{rec_start:08d}] ObjectNull")

        elif rec_type == 11: # MessageEnd
            print(f"[{rec_start:08d}] MessageEnd — stream ends here (pos={pos})")
            break

        elif rec_type == 1:  # ClassWithId
            obj_id,  pos = read_i32(data, pos)
            meta_id, pos = read_i32(data, pos)
            print(f"[{rec_start:08d}] ClassWithId id={obj_id}, metaId={meta_id}")

        elif rec_type == 7:  # BinaryObjectString
            obj_id, pos = read_i32(data, pos)
            s, pos = read_lpstr(data, pos)
            print(f"[{rec_start:08d}] BinaryObjectString id={obj_id}: {s!r}")

        elif rec_type == 9:  # MemberPrimitiveTyped
            ptype = data[pos]; pos += 1
            esize = PRIM_SIZES.get(ptype, 1)
            raw = data[pos:pos+esize]; pos += esize
            print(f"[{rec_start:08d}] MemberPrimitiveTyped type={PRIM_NAMES.get(ptype,'?')}: {raw.hex()}")

        else:
            print(f"[{rec_start:08d}] *** UNKNOWN 0x{rec_type:02X} — ABORTING ***")
            print(f"    Surrounding bytes [{rec_start}:{rec_start+32}]: {data[rec_start:rec_start+32].hex()}")
            break

    print(f"\n  Arrays found: { {k: (PRIM_NAMES.get(v[0],'?'), v[1]) for k,v in arrays_found.items()} }")
    return arrays_found

base = r"c:\Users\New User\Documents\VScodeFiles\Cyberstar Simulator"

with open(os.path.join(base, "WorkingShowTape.rshw"), 'rb') as f:
    wdata = f.read()
with open(os.path.join(base, "Come_Together_Python_3_4ch (2).rshw"), 'rb') as f:
    cdata = f.read()

parse_nrbf_detailed(wdata, "WORKING SHOWTAPE")
parse_nrbf_detailed(cdata, "CONVERTED (new) SHOWTAPE")
