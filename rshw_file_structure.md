# .rshw File Structure Documentation

## Overview

The `.rshw` file format is used in the RR-Engine-Ultimate-Mod-main project to store show data for animatronic control. It is a binary serialized format based on .NET's `BinaryFormatter` and defined by the following C# classes:

---

## rshwFile Class

```csharp
[System.Serializable]
public class rshwFile
{
    public byte[] audioData { get; set; }
    public int[] signalData { get; set; }
    // ...methods for saving/loading...
}
```

### Fields

- **audioData**: `byte[]`
  - Contains raw or encoded audio data for the show.
- **signalData**: `int[]`
  - Contains animatronic control signals/events as integers.

---

## rshwFormat Class

```csharp
[System.Serializable]
public class rshwFormat
{
    public byte[] audioData { get; set; }
    public int[] signalData { get; set; }
    public byte[] videoData { get; set; }
    // ...methods for saving/loading...
}
```

### Fields

- **audioData**: `byte[]`
  - Same as above.
- **signalData**: `int[]`
  - Same as above.
- **videoData**: `byte[]`
  - Contains video data if present.

---

## Serialization

- Files are saved and loaded using .NET's `BinaryFormatter`.
- The file is a binary serialized object containing the above fields.

---

## Signal Data

- **signalData** is an integer array.
- Each integer likely represents a signal/event for animatronic control at a specific time/frame.
- Mapping from WAV channels to `signalData` is required for conversion.

---

## Usage in Converter

To create a `.rshw` file from a 4-channel WAV:

1. Extract audio as a byte array for `audioData`.
2. Convert channel data to an integer array for `signalData` (mapping each channel's values to animatronic events).
3. Serialize to `.rshw` using the same field structure.

---

## Next Steps

- Document the mapping from WAV channels to `signalData` events.
- Define how to generate the correct integer array for animatronic control.

---

_Reference: RR-Engine-Ultimate-Mod-main/Assets/Scripts/File Formats/rshwFile.cs, rshwFormat.cs_
