# .rshw File Structure — Complete Specification

## Overview

The `.rshw` file format is used by RR-Engine / SPTE to store animatronic showtape data.
It is a `.NET BinaryFormatter` (NRBF) binary serialization of the `rshwFormat` class.

Confirmed by direct source-code analysis of:

- `Assets/Scripts/File Formats/rshwFormat.cs`
- `Assets/Scripts/File Formats/rshwFile.cs`
- `Assets/Scripts/Anim System/UI_ShowtapeManager.cs` — `SaveRecording()` / `LoadFromURL()`
- `Assets/Scripts/Anim System/ShowtapeAnalyzer.cs`


---

## C# Class (serialization target)

```csharp
[System.Serializable]
public class rshwFormat
{
    public byte[] audioData  { get; set; }   // stereo WAV bytes
    public int[]  signalData { get; set; }   // per-frame animatronic signals
    public byte[] videoData  { get; set; }   // optional video; null for standard shows
}
```

Because these are C# **auto-properties**, BinaryFormatter serializes compiler-generated
backing fields. Wire-level field names:

| Property   | Backing field name               | CLR type |
|------------|----------------------------------|----------|
| audioData  | `<audioData>k__BackingField`     | `byte[]` |
| signalData | `<signalData>k__BackingField`    | `int[]`  |
| videoData  | `<videoData>k__BackingField`     | `byte[]` |

---

## NRBF Wire Format (MS-NRBF, all little-endian)

```
[0x00] SerializedStreamHeader
         rootId=1, headerId=-1, majorVersion=1, minorVersion=0

[0x0C] BinaryLibrary  id=2
         "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"

[0x05] ClassWithMembersAndTypes  objectId=1  className="rshwFormat"
         memberNames  = ["<audioData>k__BackingField",
                         "<signalData>k__BackingField",
                         "<videoData>k__BackingField"]
         binaryTypes  = [7, 7, 7]       <- all PrimitiveArray
         addlTypeInfo = [2, 8, 2]       <- Byte, Int32, Byte  (PrimitiveTypeEnum)
         libraryId    = 2

[0x0F] ArraySinglePrimitive  objectId=3  primitiveTypeEnum=2(Byte)
         <- audioData bytes (raw WAV for stereo music)

[0x0F] ArraySinglePrimitive  objectId=4  primitiveTypeEnum=8(Int32)
         <- signalData ints  (M x 4 bytes LE)

[0x0A] ObjectNull              <- videoData = null

[0x0B] MessageEnd
```

PrimitiveTypeEnum: **2** = Byte, **8** = Int32

---

## audioData

Stereo 16-bit PCM WAV bytes (RIFF/WAVE, 44100 Hz, 2 channels).
Comes from Ch0 + Ch1 of the 4-channel input WAV.

---

## signalData Encoding

Frame rate: **60 fps** (UI_ShowtapeManager.dataStreamedFPS default).

Each rshw frame uses a **300-bit BitArray**:
- bits 0-149   -> mack.topDrawer[0-149]    (TD: indices 0-93 used for 94 RAE signals)
- bits 150-299 -> mack.bottomDrawer[0-149] (BD: indices 150-245 used for 96 RAE signals)

**Encoding** (SaveRecording):
```
For each frame: append 0 (delimiter), then append (e + 1) for each ON bit e in 0..299
```

**Decoding** (LoadFromURL):
```
v == 0  -> start new BitArray(300) frame
v != 0  -> set bit (v-1) = true in current frame
```

**RAE signal -> signalData value:**
- TD bit N (1-indexed PDF) -> topDrawer[N-1]     -> signalData value **N**
- BD bit N (1-indexed PDF) -> bottomDrawer[N-1]  -> signalData value **N + 150**

---

## 4-Channel WAV -> .rshw Conversion

WAV channel layout:
| Ch | Content |
|----|---------|
| 0  | Music left |
| 1  | Music right |
| 2  | BMC TD signals (94 bits/frame, 4800 baud) |
| 3  | BMC BD signals (96 bits/frame, 4800 baud) |

For each 60fps rshw frame at time t:
- Active TD BMC frame = floor(t / (94/4800))
- Active BD BMC frame = floor(t / (96/4800))
- signalData = [0, on_td_bits_1indexed..., on_bd_bits_plus150...]

**Implementation:**  (self-contained, Pyodide-compatible).  
**Browser:** Load a 4ch WAV in SViz panel -> click **Export .rshw**.

---

*Sources: rshwFormat.cs, UI_ShowtapeManager.cs, Mack_Valves.cs, SCME/SMM/constants.py*
