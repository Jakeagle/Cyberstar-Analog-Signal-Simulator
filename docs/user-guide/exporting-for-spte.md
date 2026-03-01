# Exporting for SPTE — Step by Step

Once your show has been generated and previewed, this page walks through getting it into a format that RR-Engine/SPTE can load.

---

## Which Format to Export?

| You want to…                                     | Use this format    |
| ------------------------------------------------ | ------------------ |
| Load into RR-Engine/SPTE                         | `.rshw`            |
| Future: Cyberstar Online decoder (not built yet) | `.cso`             |
| Test the signal on hardware or oscilloscope      | `4-channel WAV`    |
| Share the show for re-editing                    | `.cybershow.json`  |
| Archive everything                               | Export all formats |

---

## Export Step 1: Generate the 4-Channel WAV

All formats (`.rshw`, `.cso`) start from the 4-channel WAV. When you click any export button, the simulator first generates the WAV internally.

**Click:** "Export 4-ch WAV" (or any format button — the WAV is generated as part of the pipeline)

The Python progress modal will show:

1. Loading Python export... (10%)
2. Generating BMC frames... (38%)
3. Mixing music channels... (72%)
4. Encoding 4-channel WAV... (88%)
5. Done (100%)

A file named `[show_title]_broadcast.wav` downloads automatically.

> If you only need the raw WAV (for hardware testing), you're done here.

---

## Export Step 2a: Export .rshw (Legacy Format)

**Click:** "Export .rshw"

The 4-channel WAV is processed:

- Music channels extracted and re-wrapped as stereo WAV → `audioData`
- Control signals decoded from BMC → frame-by-frame BitArray at 60fps → `signalData`
- Both packed into a .NET BinaryFormatter (NRBF) binary stream

A file named `[show_title].rshw` downloads automatically.

### Loading in RR-Engine

1. Transfer the `.rshw` file to the SPTE machine
2. Open RR-Engine
3. File → Load → navigate to and select your `.rshw`
4. Wait for the show to deserialise (may take a few seconds for long shows)
5. Press Play

---

## Export Step 2b: Export .cso (Cyberstar Online Format)

**Click:** "Export .cso"

The 4-channel WAV is processed:

- Control signals decoded from BMC → frame bitmasks (already decoded — no work at playback time)
- Music extracted as raw interleaved 16-bit PCM
- Both written to the CSO1 binary format with a 64-byte header

A file named `[show_title].cso` downloads automatically.

### Validation During CSO Export

The CSO exporter runs automatic validation while it works. Watch the browser console (F12) for messages like:

- `✓ 2847 frames decoded, sync lock established` — good
- `⚠ 3 blank-bit violations (0.1%)` — acceptable
- `✗ Frame sync: NO LOCK` — problem, re-export the 4-channel WAV first

### Status in RR-Engine

> **The `.cso` decoder has not been built into RR-Engine yet.** You can export a `.cso` file and it will download, but it cannot currently be loaded in RR-Engine/SPTE. Use `.rshw` for actual playback. The `.cso` format is produced now so the file structure is established and ready for when a decoder is implemented.

---

## Export Step 3: Verify with Signal Visualizer

Before loading into SPTE, it's a good idea to verify your 4-channel WAV:

1. Find the **Signal Visualizer** drop zone (bottom of the page)
2. Drop your downloaded `_broadcast.wav` file onto it
3. Wait for Python to decode the signal (~5 seconds)
4. Read the report:

| Check                  | Pass    | Action if Fail                         |
| ---------------------- | ------- | -------------------------------------- |
| TD sync lock           | LOCKED  | Re-export; do not use this WAV         |
| BD sync lock           | LOCKED  | Re-export; do not use this WAV         |
| TD blank-bit integrity | ≥ 98.0% | File a bug; do not use this WAV        |
| BD blank-bit integrity | ≥ 98.0% | File a bug; do not use this WAV        |
| TD bit error rate      | ≤ 2.0%  | Acceptable if close; re-export if > 5% |

A green "PASS" means the file will be accepted by real Cyberstar hardware.

---

## Tips

- **Export early and often.** The simulator holds the show in memory only as long as the page is open. If you close the tab before exporting, your work is gone (unless you saved to My Shows first).
- **Keep the `.cybershow.json`** as your master copy. You can re-export any format from it at any time.
- **Test one show completely** before doing a whole tape. Load it in RR-Engine, watch one minute of playback, confirm the figures are responding.
- **Volume balance:** The music in the 4-channel WAV is at the level the Web Audio API decoded it. If it sounds too quiet or loud in SPTE, adjust in your audio editing software before re-uploading to the simulator.
