"""
Byte-precise sequential NRBF dump of the first ~600 bytes of each .rshw file.
We parse the header/class record byte-by-byte so we can see EXACTLY what
record types and member-value bytes follow the ClassWithMembersAndTypes header.
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
    s = data[pos:pos+length].decode('utf-8', errors='replace')
    return s, pos + length

PRIM = {1:'Boolean',2:'Byte',3:'Char',5:'Decimal',6:'Double',7:'Int16',
        8:'Int32',9:'Int64',10:'SByte',11:'Single',12:'TimeSpan',
        13:'DateTime',14:'UInt16',15:'UInt32',16:'UInt64',18:'String'}
ESIZES = {1:1,2:1,3:2,6:8,7:2,8:4,9:8,10:1,11:4,12:8,13:8,14:2,15:4,16:8}

RTYPE = {
    0x00:'SerializedStreamHeader', 0x01:'ClassWithId',
    0x02:'SystemClassWithMembers', 0x03:'ClassWithMembers',
    0x04:'SystemClassWithMembersAndTypes', 0x05:'ClassWithMembersAndTypes',
    0x06:'SystemClassWithMembersAndTypes(alt)', 0x07:'BinaryObjectString',
    0x08:'BinaryArray', 0x09:'MemberPrimitiveTyped', 0x0A:'ObjectNull',
    0x0B:'MessageEnd', 0x0C:'BinaryLibrary', 0x0D:'ObjectNullMultiple256',
    0x0E:'ObjectNullMultiple', 0x0F:'ArraySinglePrimitive',
    0x10:'ArraySingleObject', 0x11:'ArraySingleString',
    0x15:'MethodReturn',
}

def dump(path, max_arrays=2):
    print(f"\n{'='*72}")
    print(f"FILE: {os.path.basename(path)}  ({os.path.getsize(path):,} bytes)")
    print('='*72)
    with open(path, 'rb') as f:
        data = f.read()

    pos = 0
    arrays_seen = 0

    while pos < len(data) and arrays_seen < max_arrays + 1:
        rec_start = pos
        rt = data[pos]; pos += 1
        rname = RTYPE.get(rt, f'UNKNOWN(0x{rt:02X})')

        if rt == 0x00:  # SerializedStreamHeader
            root  = struct.unpack_from('<i', data, pos)[0]; pos += 4
            hdr   = struct.unpack_from('<i', data, pos)[0]; pos += 4
            major = struct.unpack_from('<i', data, pos)[0]; pos += 4
            minor = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start:>6}] {rname}: rootId={root}, headerId={hdr}, v{major}.{minor}")

        elif rt == 0x0C:  # BinaryLibrary
            lid = struct.unpack_from('<i', data, pos)[0]; pos += 4
            name, pos = read_lpstr(data, pos)
            print(f"[{rec_start:>6}] BinaryLibrary id={lid}: {name!r}")

        elif rt == 0x05:  # ClassWithMembersAndTypes
            oid = struct.unpack_from('<i', data, pos)[0]; pos += 4
            cname, pos = read_lpstr(data, pos)
            mc = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start:>6}] ClassWithMembersAndTypes id={oid}: {cname!r}, {mc} members")
            mnames = []
            for _ in range(mc):
                mn, pos = read_lpstr(data, pos)
                mnames.append(mn); print(f"           member: {mn!r}")
            btypes = list(data[pos:pos+mc]); pos += mc
            print(f"           BinaryTypeEnums: {btypes}")
            addl = []
            for bt in btypes:
                if bt == 0:
                    pte = data[pos]; pos += 1
                    addl.append(f"Primitive({PRIM.get(pte,'?')}={pte})")
                elif bt == 3:
                    cn, pos = read_lpstr(data, pos); addl.append(f"SystemClass({cn!r})")
                elif bt == 4:
                    cn, pos = read_lpstr(data, pos)
                    lid2 = struct.unpack_from('<i', data, pos)[0]; pos += 4
                    addl.append(f"Class({cn!r},lib={lid2})")
                else:
                    addl.append(f"type({bt})")
            print(f"           AdditionalInfo: {addl}")
            lib = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"           LibraryId: {lib}")
            # Now dump the NEXT 32 bytes raw — these are the member VALUES
            print(f"           *** Member value bytes (next 32): {data[pos:pos+32].hex()}")
            for i, b in enumerate(data[pos:pos+32]):
                r2 = RTYPE.get(b, f'?0x{b:02X}')
                print(f"               [{pos+i}] 0x{b:02X}  ({r2})")

        elif rt == 0x0F:  # ArraySinglePrimitive
            oid = struct.unpack_from('<i', data, pos)[0]; pos += 4
            pte = data[pos]; pos += 1
            arr_len = struct.unpack_from('<i', data, pos)[0]; pos += 4
            es = ESIZES.get(pte, 1)
            print(f"[{rec_start:>6}] ArraySinglePrimitive id={oid}: {PRIM.get(pte,'?')}[{arr_len}]  (data at {pos}, {arr_len*es} bytes)")
            print(f"           first 16 bytes: {data[pos:pos+16].hex()}")
            pos += arr_len * es
            arrays_seen += 1

        elif rt == 0x0A:  # ObjectNull
            print(f"[{rec_start:>6}] ObjectNull")

        elif rt == 0x0B:  # MessageEnd
            print(f"[{rec_start:>6}] MessageEnd")
            break

        elif rt == 0x09:  # MemberPrimitiveTyped
            pte = data[pos]; pos += 1
            es  = ESIZES.get(pte, 1)
            val = data[pos:pos+es]; pos += es
            print(f"[{rec_start:>6}] MemberPrimitiveTyped {PRIM.get(pte,'?')}: {val.hex()}")

        elif rt == 0x01:  # ClassWithId (member reference decoded as a back-ref)
            oid  = struct.unpack_from('<i', data, pos)[0]; pos += 4
            meta = struct.unpack_from('<i', data, pos)[0]; pos += 4
            print(f"[{rec_start:>6}] ClassWithId id={oid}, metaId={meta}")

        else:
            print(f"[{rec_start:>6}] *** UNHANDLED record 0x{rt:02X} — raw next 32: {data[rec_start:rec_start+33].hex()}")
            # Try to continue — these are likely nested data records
            # Check if it could be MemberReference (0x09 ≠ MemberPrimitiveTyped context)
            # In NRBF spec, 0x09 IS MemberPrimitiveTyped; there's no "MemberReference"
            # record type — references are encoded as ClassWithId (0x01).
            # But 0x09 appears right after the class def in working file — investigate:
            print(f"           context -5..+10: {data[rec_start-5:rec_start+38].hex()}")
            break

base = r"c:\Users\New User\Documents\VScodeFiles\Cyberstar Simulator"

# Find the most recently created .rshw
import glob, time
rshw_files = glob.glob(os.path.join(base, "*.rshw"))
rshw_by_time = sorted(rshw_files, key=os.path.getmtime, reverse=True)
print("All .rshw files (newest first):")
for f in rshw_by_time:
    print(f"  {os.path.basename(f):50s}  {os.path.getsize(f):>12,} bytes  mtime={time.ctime(os.path.getmtime(f))}")

dump(os.path.join(base, "WorkingShowTape.rshw"))
# Dump newest non-working
for f in rshw_by_time:
    if 'Working' not in f:
        dump(f)
        break
