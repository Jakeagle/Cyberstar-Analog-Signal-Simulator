# .rshw File Format — Complete Specification

The `.rshw` format is the legacy showtape format used by RR-Engine. It is a **.NET Binary Formatter (NRBF)** serialization of the `rshwFormat` C# class. This doc captures everything reverse-engineered from RR-Engine source files:

- `Assets/Scripts/File Formats/rshwFormat.cs`
- `Assets/Scripts/File Formats/rshwFile.cs`
- `Assets/Scripts/Anim System/UI_ShowtapeManager.cs` (SaveRecording / LoadFromURL)
- `Assets/Scripts/Anim System/ShowtapeAnalyzer.cs`

---

## C# Class

```csharp
[System.Serializable]
public class rshwFormat
{
    public byte[] audioData  { get; set; }   // stereo WAV bytes (44100 Hz, 16-bit, 2ch)
    public int[]  signalData { get; set; }   // per-frame animatronic signals
    public byte[] videoData  { get; set; }   // optional video payload; null for standard shows
}
```

Because these are C# **auto-properties**, BinaryFormatter serialises the compiler-generated backing fields, not the property names:

| Property   | Wire-level field name         | CLR type |
| ---------- | ----------------------------- | -------- |
| audioData  | `<audioData>k__BackingField`  | `byte[]` |
| signalData | `<signalData>k__BackingField` | `int[]`  |
| videoData  | `<videoData>k__BackingField`  | `byte[]` |

---

## NRBF Wire Format

All values are **little-endian**. The stream is read sequentially; there is no random access.

```
[0x00] SerializedStreamHeader
         rootId=1, headerId=-1, majorVersion=1, minorVersion=0

[0x0C] BinaryLibrary  id=2
         "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"

[0x05] ClassWithMembersAndTypes  objectId=1  className="rshwFormat"
         memberNames  = ["<audioData>k__BackingField",
                         "<signalData>k__BackingField",
                         "<videoData>k__BackingField"]
         binaryTypes  = [7, 7, 7]        (all PrimitiveArray)
         addlTypeInfo = [2, 8, 2]        (Byte, Int32, Byte)
         libraryId    = 2

[0x0F] ArraySinglePrimitive  objectId=3  primitiveTypeEnum=2 (Byte)
         ← audioData bytes (raw WAV — stereo music)

[0x0F] ArraySinglePrimitive  objectId=4  primitiveTypeEnum=8 (Int32)
         ← signalData ints

[0x0A] ObjectNull              ← videoData = null

[0x0B] MessageEnd
```

**PrimitiveTypeEnum reference:**

- `2` = Byte
- `8` = Int32

---

## audioData

Raw RIFF/WAVE bytes of a **stereo 16-bit PCM WAV** at 44,100 Hz, 2 channels. This is the music audio for the show — channels 0 (Left) and 1 (Right) of the original 4-channel broadcast tape.

Comes from the first two channels of the 4-channel export WAV.

---

## signalData — Encoding

Frame rate: **60 fps** (set by `UI_ShowtapeManager.dataStreamedFPS`).

Each RSHW frame uses a **300-bit BitArray** divided into two halves:

- Bits 0–149 → `mack.topDrawer[0–149]` (TD signals, indices 0–93 used)
- Bits 150–299 → `mack.bottomDrawer[0–149]` (BD signals, indices 150–245 used)

### Encoding (SaveRecording)

```
For each frame:
  append 0  (frame delimiter)
  for each bit e in 0..299:
    if bit e is ON:
      append (e + 1)
```

### Decoding (LoadFromURL)

```
For each integer v in signalData:
  if v == 0:  start a new BitArray(300) frame
  if v != 0:  set bit (v - 1) = true in the current frame
```

### RAE Signal → signalData Value

- TD channel with 1-based bit number N → `topDrawer[N-1]` → signalData value = **N**
- BD channel with 1-based bit number M → `bottomDrawer[M-1]` → signalData value = **M + 150**

### Example

If the frame has only `rolfe_mouth` (TD bit 1) active:

```
signalData for this frame: [0, 1]
```

If `beachbear_mouth` (BD bit 16) is also active:

```
signalData for this frame: [0, 1, 166]   (150 + 16 = 166)
```

---

## Building an .rshw File

The Python module `SCME/SGM/rshw_builder.py` handles writing this format. It:

1. Accepts the choreography event list and audio WAV bytes
2. Converts events to per-frame BitArrays at 60 fps
3. Encodes BitArrays to the variable-length `signalData` int array
4. Packs everything into the NRBF binary stream
5. Returns the raw bytes for download

---

## Notes

- The `videoData` field is almost always `null` / `ObjectNull`. Only specialty video-synced shows use it.
- The 60 fps RSHW frame rate is **not the same** as the 45.9375 fps hardware BMC frame rate. They are independent timing systems. RSHW is SPTE's internal representation; BMC is the physical wire signal.
- BitArray indices are 0-based in C# but the PDF spec (RAE_Bit_Chart_2.pdf) is 1-based. Always subtract 1 when reading the PDF.
