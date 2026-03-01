# =============================================================================
# rshw_builder.py — 4-Channel WAV → .rshw Converter (Pyodide-compatible)
# =============================================================================
#
# Converts a 4-channel Cyberstar WAV file to a .rshw showtape file that can
# be loaded by RR-Engine / SPTE.
#
# 4-Channel WAV layout (Cyberstar Online export standard):
#   Ch 0 (L): stereo music left
#   Ch 1 (R): stereo music right
#   Ch 2:     BMC-encoded TD signal track  (94 animatronic bits per frame)
#   Ch 3:     BMC-encoded BD signal track  (96 animatronic bits per frame)
#
# .rshw output format:
#   .NET BinaryFormatter (NRBF) serialization of `rshwFormat`:
#     audioData  (byte[])  — stereo 16-bit PCM WAV from Ch0+Ch1
#     signalData (int[])   — frame-encoded animatronic signals at 60 fps
#     videoData  (byte[])  — null (no video)
#
# signalData encoding (from UI_ShowtapeManager.SaveRecording):
#   For each rshw frame (at 60 fps):
#     append 0             ← frame delimiter
#     append bit+1         ← for each ON bit in the 300-bit frame (1-indexed)
#   Bit layout in the 300-bit frame:
#     bits   0-149  → mack.topDrawer[0-149]   (we use 0-93  for 94 TD signals)
#     bits 150-299  → mack.bottomDrawer[0-149] (we use 150-245 for 96 BD signals)
#   So:
#     TD bit N (1-indexed RAE PDF) → topDrawer[N-1]   → signalData value N
#     BD bit N (1-indexed RAE PDF) → bottomDrawer[N-1] → signalData value N+150
#
# NRBF class info (rshwFormat, Assembly-CSharp):
#   Class name: "rshwFormat"
#   Library:    "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
#   Members (auto-property backing fields):
#     "<audioData>k__BackingField"  → byte[]  — BinaryType=7(PrimitiveArray), PTEnum=2(Byte)
#     "<signalData>k__BackingField" → int[]   — BinaryType=7(PrimitiveArray), PTEnum=8(Int32)
#     "<videoData>k__BackingField"  → byte[]  — BinaryType=7(PrimitiveArray), PTEnum=2(Byte) [null]
#
# Self-contained: only uses struct, math, array (all Python stdlib, all in Pyodide).
# Also fully importable in CPython for offline testing.
#
# Main API:
#   convert_4ch_wav_to_rshw(wav_bytes: bytes) -> bytes
#   build_rshw(audio_l, audio_r, td_samples, bd_samples, sample_rate=44100) -> bytes
#
# =============================================================================

from __future__ import annotations
import struct
import math
import array as _array_mod

# ── Hardware constants (KWS-confirmed, matches SCME/SMM/constants.py) ─────────
_BAUD_RATE     = 4_800
_TOLERANCE     = 0.30        # ±30% run-length tolerance (analog PLL model)
_ZERO_THRESH   = 200         # amplitude below this = silence (int16 scale)
_TD_FRAME_BITS = 94          # RAE Top Drawer frame width in bits
_BD_FRAME_BITS = 96          # RAE Bottom Drawer frame width in bits
_RSHW_FPS      = 60          # UI_ShowtapeManager.dataStreamedFPS default


# ── WAV parser ─────────────────────────────────────────────────────────────────

def _parse_wav(wav_bytes: bytes):
    """
    Parse a PCM WAV file and return per-channel int16 sample lists.

    Returns
    -------
    channels    : list[list[int]]   — one list per channel, int16 values
    sample_rate : int
    num_channels: int
    """
    import io
    f = io.BytesIO(wav_bytes)

    riff = f.read(4)
    if riff != b'RIFF':
        raise ValueError("Not a RIFF file")
    f.read(4)  # file size − 8
    wave = f.read(4)
    if wave != b'WAVE':
        raise ValueError("RIFF type is not WAVE")

    num_channels = 0
    sample_rate = 0
    bits_per_sample = 0
    pcm_data = None

    while f.tell() < len(wav_bytes) - 8:
        chunk_id   = f.read(4)
        chunk_size = struct.unpack('<I', f.read(4))[0]
        chunk_start = f.tell()

        if chunk_id == b'fmt ':
            _audio_fmt   = struct.unpack('<H', f.read(2))[0]
            num_channels = struct.unpack('<H', f.read(2))[0]
            sample_rate  = struct.unpack('<I', f.read(4))[0]
            f.read(4)    # byte rate
            f.read(2)    # block align
            bits_per_sample = struct.unpack('<H', f.read(2))[0]
            f.seek(chunk_start + chunk_size)
        elif chunk_id == b'data':
            pcm_data = f.read(chunk_size)
            break
        else:
            f.seek(chunk_start + chunk_size)

    if pcm_data is None or sample_rate == 0:
        raise ValueError("Could not find fmt or data chunk in WAV")

    # Decode PCM samples
    bytes_per_sample = bits_per_sample // 8
    total_samples = len(pcm_data) // bytes_per_sample

    if bits_per_sample == 16:
        all_samples = _array_mod.array('h')
        all_samples.frombytes(pcm_data[:total_samples * 2])
        all_samples_list = list(all_samples)
    elif bits_per_sample == 8:
        # 8-bit WAV is unsigned; centre at 128 → scale to int16 range
        all_samples_list = [(b - 128) * 256 for b in pcm_data]
        total_samples = len(pcm_data)
    elif bits_per_sample == 24:
        all_samples_list = []
        for i in range(0, total_samples * 3, 3):
            v = pcm_data[i] | (pcm_data[i+1] << 8) | (pcm_data[i+2] << 16)
            if v >= 0x800000:
                v -= 0x1000000
            all_samples_list.append(v >> 8)  # scale to int16 range
    elif bits_per_sample == 32:
        # float32 WAV
        raw = _array_mod.array('f')
        raw.frombytes(pcm_data[:total_samples * 4])
        all_samples_list = [max(-32768, min(32767, int(s * 32767))) for s in raw]
    else:
        raise ValueError(f"Unsupported bit depth: {bits_per_sample}")

    # De-interleave: [L,R,TD,BD, L,R,TD,BD, ...] → separate channel lists
    channels = [[] for _ in range(num_channels)]
    for i, s in enumerate(all_samples_list):
        channels[i % num_channels].append(s)

    return channels, sample_rate, num_channels


# ── BMC Decoder ────────────────────────────────────────────────────────────────

def _decode_bmc(samples, sample_rate=44100, baud_rate=4800,
                tolerance=0.30, zero_thresh=200):
    """
    Decode a BMC-encoded PCM channel into a list of bit values (0 or 1).

    BMC rules (hardware-confirmed via KWS recordings):
      - Always a level transition at the START of each bit period.
      - Bit 1: additional transition at mid-period   → two runs (half+half)
      - Bit 0: no mid-period transition              → one full-period run

    Parameters
    ----------
    samples     : list[int]  — int16 PCM samples
    sample_rate : int        — e.g. 44100
    baud_rate   : int        — e.g. 4800
    tolerance   : float      — run-length tolerance (0.30 = ±30%)
    zero_thresh : int        — amplitude below this counts as silence

    Returns
    -------
    list[int]  — decoded bits (0 or 1), in transmission order
    """
    nom_full = sample_rate / baud_rate      # nominal full-bit run (float)
    nom_half = nom_full / 2.0

    fl_lo = math.floor(nom_full * (1 - tolerance))
    fl_hi = math.ceil( nom_full * (1 + tolerance))
    ha_lo = math.floor(nom_half * (1 - tolerance))
    ha_hi = math.ceil( nom_half * (1 + tolerance))

    def is_full(r): return fl_lo <= r <= fl_hi
    def is_half(r): return ha_lo <= r <= ha_hi

    # ── Build run-length list ────────────────────────────────────────────────
    runs = []
    i = 0
    n = len(samples)
    while i < n:
        s = samples[i]
        if abs(s) < zero_thresh:
            i += 1
            continue
        positive = (s > 0)
        start = i
        while i < n and ((samples[i] > 0) == positive) and abs(samples[i]) >= zero_thresh:
            i += 1
        runs.append(i - start)          # store run length only (start pos not needed)

    # ── Decode BMC bits from runs ────────────────────────────────────────────
    bits = []
    idx = 0
    total = len(runs)

    while idx < total:
        r = runs[idx]

        if is_full(r):
            # Bit '0': single full-period run
            bits.append(0)
            idx += 1

        elif is_half(r):
            # Potentially bit '1': need a second half-period run
            if idx + 1 < total:
                r2 = runs[idx + 1]
                if is_half(r2):
                    bits.append(1)
                    idx += 2
                elif is_full(r + r2):
                    # Combined approx full — tolerated as '1'
                    bits.append(1)
                    idx += 2
                else:
                    # Unrecognised — skip
                    idx += 1
            else:
                idx += 1       # trailing partial bit — ignore

        else:
            # Out-of-tolerance run — skip
            idx += 1

    return bits


def _bits_to_frames(bits, frame_bits):
    """
    Group a flat bit list into frames of `frame_bits` bits each.
    The last partial frame (if any) is discarded.

    Returns list[list[int]]  — each inner list has exactly frame_bits ints (0 or 1).
    """
    frames = []
    for i in range(0, len(bits) - frame_bits + 1, frame_bits):
        frames.append(bits[i:i + frame_bits])
    return frames


# ── Stereo WAV builder ─────────────────────────────────────────────────────────

def _build_stereo_wav(left, right, sample_rate):
    """
    Build a minimal 16-bit stereo PCM WAV from two int16 sample lists.

    Parameters
    ----------
    left, right : list[int]  — int16 samples (must be equal length)
    sample_rate : int

    Returns
    -------
    bytes  — complete WAV file
    """
    n = min(len(left), len(right))

    # Interleave L + R into one flat list, clamp to int16 range
    interleaved = _array_mod.array('h')
    for i in range(n):
        interleaved.append(max(-32768, min(32767, int(left[i]))))
        interleaved.append(max(-32768, min(32767, int(right[i]))))

    pcm_bytes = interleaved.tobytes()

    num_ch     = 2
    bps        = 16
    block_align = num_ch * (bps // 8)
    byte_rate   = sample_rate * block_align
    data_size   = len(pcm_bytes)

    hdr = struct.pack('<4sI4s', b'RIFF', 36 + data_size, b'WAVE')
    fmt = struct.pack('<4sIHHIIHH',
                      b'fmt ', 16, 1, num_ch, sample_rate,
                      byte_rate, block_align, bps)
    dat = struct.pack('<4sI', b'data', data_size) + pcm_bytes

    return hdr + fmt + dat


# ── NRBF / BinaryFormatter Serializer ─────────────────────────────────────────

def _lps(s: str) -> bytes:
    """Encode a string as an NRBF LengthPrefixedString (variable-length + UTF-8)."""
    b = s.encode('utf-8')
    length = len(b)
    header = bytearray()
    while True:
        if length < 0x80:
            header.append(length)
            break
        header.append((length & 0x7F) | 0x80)
        length >>= 7
    return bytes(header) + b


def _i32(v: int) -> bytes:
    """Pack one signed 32-bit int, little-endian."""
    return struct.pack('<i', v)


def _serialize_rshw_format(audio_data: bytes, signal_data: list) -> bytes:
    """
    Serialize an rshwFormat object as .NET BinaryFormatter (NRBF) binary.

    Wire format (MS-NRBF, all little-endian):
      [0x00] SerializedStreamHeader  (rootId=1, headerId=-1, major=1, minor=0)
      [0x0C] BinaryLibrary           (id=2, "Assembly-CSharp, ...")
      [0x05] ClassWithMembersAndTypes (objectId=1, "rshwFormat", 3 members)
               MemberNames: <audioData>k__BackingField
                            <signalData>k__BackingField
                            <videoData>k__BackingField
               BinaryTypeEnum: 7, 7, 7  (all PrimitiveArray)
               AdditionalTypeInfo: 2(Byte), 8(Int32), 2(Byte)
               LibraryId: 2
      [0x0F] ArraySinglePrimitive    (objectId=3, byte[], audioData bytes)
      [0x0F] ArraySinglePrimitive    (objectId=4, int32[], signalData ints)
      [0x0A] ObjectNull              (videoData = null)
      [0x0B] MessageEnd

    PrimitiveTypeEnumeration used:
      2  = Byte   (for byte[])
      8  = Int32  (for int[])
    """
    out = bytearray()

    # ── 1. SerializedStreamHeader (record type 0) ──────────────────────────
    out += bytes([0x00])    # RecordTypeEnum
    out += _i32(1)          # rootId       = 1
    out += _i32(-1)         # headerId     = −1
    out += _i32(1)          # majorVersion = 1
    out += _i32(0)          # minorVersion = 0

    # ── 2. BinaryLibrary (record type 12 = 0x0C) ───────────────────────────
    lib_id = 2
    out += bytes([0x0C])    # RecordTypeEnum
    out += _i32(lib_id)     # LibraryId
    out += _lps("Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null")

    # ── 3. ClassWithMembersAndTypes (record type 5 = 0x05) ─────────────────
    #      This is the root rshwFormat object (objectId=1).
    out += bytes([0x05])            # RecordTypeEnum
    out += _i32(1)                  # ObjectId = 1 (root)
    out += _lps("rshwFormat")       # ClassName
    out += _i32(3)                  # MemberCount

    # Member names  (auto-property backing fields generated by C# compiler)
    out += _lps("<audioData>k__BackingField")
    out += _lps("<signalData>k__BackingField")
    out += _lps("<videoData>k__BackingField")

    # BinaryTypeEnum for each member:
    #   7 = PrimitiveArray  (applies to byte[], int[], and null byte[])
    out += bytes([7, 7, 7])

    # AdditionalTypeInfo (PrimitiveTypeEnumeration) for each PrimitiveArray:
    #   2 = Byte   (audioData -> byte[])
    #   8 = Int32  (signalData -> int[])
    #   2 = Byte   (videoData -> byte[], will be null)
    out += bytes([2, 8, 2])

    # LibraryId back-reference
    out += _i32(lib_id)

    # ── 4. Member VALUES (for each reference-type member):
    #      RecordTypeEnum 0x09 = MemberReference + ObjectId (4 bytes)
    #      RecordTypeEnum 0x0A = ObjectNull (for null members)
    #
    #  .NET BinaryFormatter always writes MemberReference records here
    #  (never embeds the array records directly as member values).
    #  The actual array data follows as separate top-level records.

    audio_id  = 3
    signal_id = 4

    out += bytes([0x09]) + _i32(audio_id)   # MemberReference → audioData   (id=3)
    out += bytes([0x09]) + _i32(signal_id)  # MemberReference → signalData  (id=4)
    out += bytes([0x0A])                    # ObjectNull       → videoData   (null)

    # ── 5a. audioData actual data: ArraySinglePrimitive (type 15 = 0x0F) ──
    out += bytes([0x0F])            # RecordTypeEnum
    out += _i32(audio_id)           # ObjectId
    out += _i32(len(audio_data))    # Length (element count)
    out += bytes([2])               # PrimitiveTypeEnum.Byte
    out += audio_data               # raw byte data

    # ── 5b. signalData actual data: ArraySinglePrimitive (int32[]) ────────
    out += bytes([0x0F])            # RecordTypeEnum
    out += _i32(signal_id)          # ObjectId
    out += _i32(len(signal_data))   # Length (element count)
    out += bytes([8])               # PrimitiveTypeEnum.Int32

    # Pack all int32 values in one shot using array module for speed
    sig_arr = _array_mod.array('i', signal_data)
    out += sig_arr.tobytes()

    # ── 6. MessageEnd (type 11 = 0x0B) ────────────────────────────────────
    out += bytes([0x0B])

    return bytes(out)


# ── Signal data builder ────────────────────────────────────────────────────────

def _build_signal_data(td_frames, bd_frames, audio_length_s, fps=_RSHW_FPS,
                       baud_rate=_BAUD_RATE,
                       td_frame_bits=_TD_FRAME_BITS,
                       bd_frame_bits=_BD_FRAME_BITS):
    """
    Build the signalData int[] from decoded BMC frames.

    Each rshw frame at t = frame_num / fps:
      - Reads the active TD BMC frame at that timestamp.
      - Reads the active BD BMC frame at that timestamp.
      - Emits: [0, td_active_bits..., bd_active_bits+150...]

    Signal data values:
      TD bit N (1-indexed) → value N         (topDrawer[N-1])
      BD bit N (1-indexed) → value N + 150   (bottomDrawer[N-1])

    The 300-bit BitArray per frame:
      bits 0..149   → mack.topDrawer[0..149]
      bits 150..299 → mack.bottomDrawer[0..149]

    signalData encoding (from SaveRecording):
      converted.Add(0)            ← frame delimiter FIRST
      converted.Add(bit_index+1)  ← for each ON bit in the 300-bit frame
    """
    # Duration (seconds) per TD/BD BMC frame
    td_frame_s = td_frame_bits / baud_rate   # ≈ 0.01958 s
    bd_frame_s = bd_frame_bits / baud_rate   # ≈ 0.02000 s

    total_rshw_frames = int(audio_length_s * fps)
    signal_data = []

    for rshw_frame_num in range(total_rshw_frames):
        t = rshw_frame_num / fps  # absolute time (seconds)

        # Frame delimiter
        signal_data.append(0)

        # ── TD bits → signalData values 1..94 ───────────────────────────
        td_idx = int(t / td_frame_s)
        if td_idx < len(td_frames):
            frame = td_frames[td_idx]
            for bit_idx, bit_val in enumerate(frame):
                if bit_val:
                    signal_data.append(bit_idx + 1)        # 1-indexed

        # ── BD bits → signalData values 151..246 ────────────────────────
        bd_idx = int(t / bd_frame_s)
        if bd_idx < len(bd_frames):
            frame = bd_frames[bd_idx]
            for bit_idx, bit_val in enumerate(frame):
                if bit_val:
                    signal_data.append(bit_idx + 151)      # 150 offset + 1-indexed

    return signal_data


# ── Public API ─────────────────────────────────────────────────────────────────

def build_rshw(audio_l, audio_r, td_samples, bd_samples, sample_rate=44100):
    """
    Convert pre-separated 4-channel WAV data to .rshw showtape format.

    Parameters
    ----------
    audio_l, audio_r : list[int] or array-like
        Int16 PCM samples for the left and right music channels.
        These are packed into a stereo WAV and stored as rshwFormat.audioData.

    td_samples : list[int] or array-like
        Int16 PCM samples of channel 2 (BMC-encoded TD signal track).

    bd_samples : list[int] or array-like
        Int16 PCM samples of channel 3 (BMC-encoded BD signal track).

    sample_rate : int
        PCM sample rate in Hz (default 44100, the only rate SPTE accepts).

    Returns
    -------
    bytes
        Complete .rshw file, ready to load in RR-Engine / SPTE.
        Contains a .NET BinaryFormatter NRBF-serialized rshwFormat object.
    """
    # Convert to plain int lists (handles numpy arrays, JS proxies, etc.)
    audio_l   = list(audio_l)
    audio_r   = list(audio_r)
    td_samples = list(td_samples)
    bd_samples = list(bd_samples)

    # ── Decode BMC ──────────────────────────────────────────────────────────
    td_bits   = _decode_bmc(td_samples, sample_rate, _BAUD_RATE, _TOLERANCE, _ZERO_THRESH)
    bd_bits   = _decode_bmc(bd_samples, sample_rate, _BAUD_RATE, _TOLERANCE, _ZERO_THRESH)

    # ── Group into hardware frames ──────────────────────────────────────────
    td_frames = _bits_to_frames(td_bits, _TD_FRAME_BITS)
    bd_frames = _bits_to_frames(bd_bits, _BD_FRAME_BITS)

    # ── Build signalData at 60 fps ──────────────────────────────────────────
    audio_length_s = len(audio_l) / sample_rate
    signal_data = _build_signal_data(td_frames, bd_frames, audio_length_s)

    # ── Build stereo audio WAV ──────────────────────────────────────────────
    stereo_wav_bytes = _build_stereo_wav(audio_l, audio_r, sample_rate)

    # ── Serialize as rshwFormat NRBF ────────────────────────────────────────
    return _serialize_rshw_format(stereo_wav_bytes, signal_data)


def convert_4ch_wav_to_rshw(wav_bytes):
    """
    Convert a 4-channel Cyberstar WAV file (bytes) into a .rshw file (bytes).

    The WAV must be 4-channel PCM (any bit depth) at 44100 Hz in the
    Cyberstar Online export format:
      Ch 0: music left
      Ch 1: music right
      Ch 2: BMC TD signal track
      Ch 3: BMC BD signal track

    Parameters
    ----------
    wav_bytes : bytes-like
        Raw bytes of the 4-channel WAV file (as produced by the
        Cyberstar Online "4-Channel WAV" / "4-Channel .CSO" exporter, or
        a real Cyberstar/RAE KWS showtape WAV).

    Returns
    -------
    bytes
        Complete .rshw file, ready to load in RR-Engine / SPTE.

    Raises
    ------
    ValueError
        If the WAV cannot be parsed or does not contain exactly 4 channels.
    """
    wav_bytes = bytes(wav_bytes)  # accept memoryview, bytearray, etc.

    channels, sample_rate, num_channels = _parse_wav(wav_bytes)

    if num_channels != 4:
        raise ValueError(
            f"Expected a 4-channel WAV (music L, music R, TD, BD). "
            f"Got {num_channels} channels."
        )

    audio_l   = channels[0]
    audio_r   = channels[1]
    td_samples = channels[2]
    bd_samples = channels[3]

    return build_rshw(audio_l, audio_r, td_samples, bd_samples, sample_rate)
