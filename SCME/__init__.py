# =============================================================================
# Signal Creation and Management Engine (SCME)
# Runs inside Pyodide (Python-in-browser).
# =============================================================================
#
# ── PYTHON IS THE MASTER OF THE RENDERED TIMELINE ────────────────────────────
#
# RESPONSIBLE for (Python owns these completely):
#   - Master Timeline Synchronization
#       Every BMC signal event locks to an exact music sample index.
#       e.g. "Mouth Open at 2.500 s" → sample #110,250 — zero drift.
#   - Deterministic Frame-to-Sample Calculation
#       All bit-to-sample mapping uses integer arithmetic on each system's
#       own baud / sample-rate grid.  No floating-point scheduling.
#   - Multi-track Sample Interleaving
#       All output channels (L, R, TD, BD) are aligned at the sample level
#       inside Python before a single byte is written to the WAV container.
#   - Audio / Signal Phase Locking
#       If a music cue begins at sample N, the BMC pulse starts at exactly
#       sample N — not "approximately N" as JS scheduling would produce.
#   - WAV file construction (signal tracks + music tracks)
#   - Show-file export (multi-channel, combined signal + music)
#
# NOT responsible for:
#   - Real-time Audio Driver Scheduling
#       JS drives speaker output via the Web Audio API.
#       Python never touches the real-time playback clock.
#   - UI Rendering / User Interaction
#       JS owns the browser interface, piano-roll, and all DOM work.
#
# ── DATA FLOW ─────────────────────────────────────────────────────────────────
#   JS (UI)     → user places event at timestamp T
#   JS (bridge) → sends { "time": T, "bit": b, "track": "TD" } to Python
#   Python      → sample = int(T * SAMPLE_RATE); writes BMC pulse there
#   Output      → mathematically locked WAV; SPTE locks on instantly
#
# =============================================================================
# DUAL-SYSTEM SPECS  —  these two systems are ENTIRELY SEPARATE.
#                        Do NOT mix their constants.
# =============================================================================
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  SYSTEM 1 — Cyberstar / RAE (Robotic Audio Engineer) Hardware          │
# ├─────────────────────────────────────────────────────────────────────────┤
# │  ✅ CONFIRMED via KWS cross-validation — 4 independent WAV files,        │
# │     8 channels total, all from archive.org/details/rae-2000s-adjustment  │
# │     (2000s Cyberstar hardware recordings):                                │
# │       Arm Twists-Bear-Billy-Rolfe.wav  Ch1: 95.0%  Ch2: 96.8%           │
# │       Duke Arm Swings.wav              Ch1: 81.5%  Ch2: 81.0%           │
# │       Fatz Arm Swings.wav              Ch1: 91.6%  Ch2: 91.2%           │
# │       Swing Beat Drum Loop.wav         Ch1: 95.5%  Ch2: 81.8%           │
# │       Mean coverage: 89.3%  — all 8 channels pass threshold (>80%)      │
# │     Lower coverage on idle-heavy files is EXPECTED: long silent runs     │
# │     (gaps between movement commands) fall outside the two BMC buckets.   │
# │     This is correct behavior, not noise.                                 │
# │     Files were 96kHz (resampled via MP4 pipeline from native 44.1kHz).  │
# │     Run-length bimodal at ~10-11 samp (half-bit) and ~20-22 samp        │
# │     (full-bit). Cluster drift is resampling artifact, not hardware.      │
# │     Frequency structure survives AAC lossy compression — confirmed.      │
# │                                                                          │
# │  Baud rate  : 4,800 baud  ← KWS-confirmed                             │
# │  Audio SR   : 44,100 Hz   ← KWS-confirmed (native hardware rate)       │
# │  Samples/bit: int(44100 / 4800) = 9  (MUST be integer — never float)  │
# │               9.1875 is the true ratio; truncating to 9 is correct    │
# │               because the hardware itself uses a fixed 9-sample grid.  │
# │               Fractional accumulation = signal drift = SPTE rejection. │
# │  Encoding   : Biphase Mark Code (BMC)  ← KWS-confirmed                │
# │  Tracks     : TD (94-bit frame) and BD (96-bit frame)                  │
# │  Output fmt : 4-channel WAV  [L=music | R=music | TD signal | BD signal]│
# │                                                                          │
# │  TD CHANNEL MAP  (source: RAE_Bit_Chart_2.pdf)                         │
# │  ── Characters ─────────────────────────────────────────────────────── │
# │   1  Rolfe - Mouth              20  Rolfe - Earl Head Tilt             │
# │   2  Rolfe - Left Eye Lid       21  Duke - Head Right                  │
# │   3  Rolfe - Right Eye Lid      22  Duke - Head Up                     │
# │   4  Rolfe - Eyes Left          23  Duke - Left Ear                    │
# │   5  Rolfe - Eyes Right         24  Duke - Right Ear                   │
# │   6  Rolfe - Head Left          25  Duke - Head Left                   │
# │   7  Rolfe - Head Right         26  Duke - Left Eyelid                 │
# │   8  Rolfe - Head Up            27  Duke - Right Eyelid                │
# │   9  Rolfe - Left Ear           28  Duke - Eyes Left                   │
# │  10  Rolfe - Right Ear          29  Duke - Eyes Right                  │
# │  11  Rolfe - Left Arm Raise     30  Duke - Mouth                       │
# │  12  Rolfe - Left Arm Twist     31  Duke - Right Elbow                 │
# │  13  Rolfe - Left Elbow         32  Duke - Left Foot (Hi-Hat)          │
# │  14  Rolfe - Body Twist Left    33  Duke - Left Arm Swing              │
# │  15  Rolfe - Body Twist Right   34  Duke - Right Arm Swing             │
# │  16  Rolfe - Body Lean          35  Duke - Left Elbow                  │
# │  17  Rolfe - Right Arm Raise    36  Rolfe - Earl Mouth                 │
# │  18  Rolfe - Right Arm Twist    37  Rolfe - Earl Eyebrow               │
# │  19  Rolfe - Right Elbow Twist  38  Props - Sun Mouth                  │
# │  39  Props - Sun Raise          56  BLANK                              │
# │  40  Specials - Dual Pressure   57  Fats - Left Arm Swing              │
# │  41  Fats - Left Eyelid         58  Fats - Right Arm Swing             │
# │  42  Fats - Right Eyelid        59  Fats - Left Elbow                  │
# │  43  Fats - Eyes Left           60  Fats - Right Elbow                 │
# │  44  Fats - Eyes Right          61  Fats - Foot Tap                    │
# │  45  Fats - Mouth               62  Fats - Body Lean                   │
# │  46  Props - Moon Mouth         63  Duke - Right Foot (Bass Drum)      │
# │  47  Props - Moon Raise         64  Duke - Body Lean                   │
# │  48  Props - Looney Bird Hands  65  BLANK                              │
# │  49  Props - Antioch Down       66  Organ - Top Blue                   │
# │  50  Props - Baby Bear Raise    67  Organ - Top Red                    │
# │  51  Fats - Head Tip Left       68  Organ - Top Amber                  │
# │  52  Fats - Head Tip Right      69  Organ - Top Green                  │
# │  53  Fats - Head Up             70  BLANK                              │
# │  54  Fats - Head Left           71  Organ - Leg Top                    │
# │  55  Fats - Head Right          72  Organ - Leg Mid                    │
# │  73  Organ - Leg Bottom         84  Spots - Billy Bob                  │
# │  74  Organ - Cont Strobe        85  Spots - Fats                       │
# │  75  Organ - Flash Strobe       86  Spots - Duke                       │
# │  76  Sign - Inner               87  Spots - Rolfe                      │
# │  77  Sign - Mid                 88  Spots - Earl                       │
# │  78  Sign - Outer               89  Curtains - Stage Right Open        │
# │  79  Sign - Cont Strobe         90  Curtains - Stage Right Close       │
# │  80  Sign - Flash Strobe        91  Curtains - Center Stage Open       │
# │  81  Spots - Mitzi              92  Curtains - Center Stage Close      │
# │  82  Spots - Beach Bear         93  Curtains - Stage Left Open         │
# │  83  Spots - Looney Bird        94  Curtains - Stage Left Close        │
# │                                                                          │
# │  BD CHANNEL MAP  (source: RAE_Bit_Chart_2.pdf)                         │
# │   1  Beach Bear - Left Eyelid   17  Looney Bird - Mouth                │
# │   2  Beach Bear - Right Eyelid  18  Mitzi - Right Arm Raise            │
# │   3  Beach Bear - Eye Cross     19  Mitzi - Right Elbow                │
# │   4  Beach Bear - Left Hand Slide 20 Mitzi - Right Arm Twist           │
# │   5  Beach Bear - Guitar Raise  21  Looney Bird - Head Right           │
# │   6  Beach Bear - Head Left     22  Looney Bird - Raise                │
# │   7  Beach Bear - Head Right    23  Mitzi - Left Arm Raise             │
# │   8  Beach Bear - Head Up       24  Mitzi - Left Elbow                 │
# │   9  Beach Bear - Left Leg Kick 25  Mitzi - Left Arm Twist             │
# │  10  Beach Bear - Right Leg Kick 26  Mitzi - Left Ear                  │
# │  11  Beach Bear - Right Arm Raise 27 Mitzi - Right Ear                 │
# │  12  Beach Bear - Right Arm Twist 28 Mitzi - Head Left                 │
# │  13  Beach Bear - Right Elbow   29  Mitzi - Head Right                 │
# │  14  Beach Bear - Right Wrist   30  Mitzi - Head Up                    │
# │  15  Beach Bear - Body Lean     31  Mitzi - Left Eyelid                │
# │  16  Beach Bear - Mouth         32  Mitzi - Right Eyelid               │
# │  33  Mitzi - Eyes Left          51  Billy Bob - Head Left               │
# │  34  Mitzi - Eyes Right         52  Billy Bob - Head Right              │
# │  35  Mitzi - Mouth              53  Billy Bob - Head Tip Left           │
# │  36  Mitzi - Body Twist Left    54  Billy Bob - Head Tip Right          │
# │  37  Mitzi - Body Twist Right   55  Billy Bob - Head Up                 │
# │  38  Mitzi - Body Lean          56  Billy Bob - Right Arm Raise         │
# │  39  Billy Bob - Left Arm Slide 57  Billy Bob - Right Arm Twist         │
# │  40  Billy Bob - Guitar Raise   58  Billy Bob - Right Elbow Twist       │
# │  41  Looney Bird - Left Eyelid  59  Billy Bob - Right Wrist             │
# │  42  Looney Bird - Right Eyelid 60  Specials - Dual Pressure (BD)       │
# │  43  Looney Bird - Eye Cross    61  Billy Bob - Body Twist Left         │
# │  44  Billy Bob - Foot Tap       62  Billy Bob - Body Twist Right        │
# │  45  BLANK                      63  Billy Bob - Body Lean               │
# │  46  Billy Bob - Mouth          64  Specials - Tape Stop                │
# │  47  Billy Bob - Left Eyelid    65  Specials - Tape Rewind              │
# │  48  Billy Bob - Right Eyelid   66  Floods - Stage Right Blue           │
# │  49  Billy Bob - Eyes Left      67  Floods - Stage Right Green          │
# │  50  Billy Bob - Eyes Right     68  Floods - Stage Right Amber          │
# │  69  Floods - Stage Right Red   83  Floods - Treeline Blue              │
# │  70  Prop Lights - Applause     84  Floods - Backdrop Inside Blue       │
# │  71  Floods - Center Stage Blue 85  Floods - Treeline Red               │
# │  72  Floods - Center Stage Grn  86  Floods - Bushes Green               │
# │  73  Floods - Center Stage Amb  87  Floods - Bushes Red/Amber           │
# │  74  Floods - Center Stage Red  88  Spots - Sun Spot                    │
# │  75  Prop Lights - Drums        89  Spots - Moon Spot                   │
# │  76  Floods - Stage Left Blue   90  Spots - Spider Spot                 │
# │  77  Floods - Stage Left Green  91  Prop Lights - Gas Pump              │
# │  78  Floods - Stage Left Amber  92  Stage Lights - Service Stn (Red)    │
# │  79  Floods - Stage Left Red    93  Stage Lights - Service Stn (Blue)   │
# │  80  Prop Lights - Fire/Still   94  Stage Lights - Rainbow #1 (Red)     │
# │  81  Floods - Backdrop Out Blue 95  Stage Lights - Rainbow #2 (Yellow)  │
# │  82  Floods - Backdrop In Amber 96  Spots - Guitar Spot                 │
# └─────────────────────────────────────────────────────────────────────────┘
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  SYSTEM 2 — SPTE / RR-Engine (Unity Software)                          │
# ├─────────────────────────────────────────────────────────────────────────┤
# │  Sample Rate: 44,100 Hz  (confirmed — SPTE only accepts 44.1 kHz WAV)  │
# │  Baud rate  : TBD — confirm with RR-engine documentation               │
# │  Encoding   : TBD                                                       │
# │  Channel map: TBD                                                       │
# │                                                                          │
# │  NOTE: Although both systems share 44,100 Hz, baud rate and encoding   │
# │  almost certainly differ from System 1 (4800 baud BMC).  Do NOT reuse  │
# │  System 1 samples-per-bit math until the SPTE baud spec is confirmed.  │
# └─────────────────────────────────────────────────────────────────────────┘
#
# ── Module layout ─────────────────────────────────────────────────────────────
#   signal_generator.py  — BMC frame builder & deterministic sample mapping
#                          (dual-system: CYBERSTAR_PROFILE / SPTE_PROFILE)
#   wav_export.py        — PCM/WAV container construction (all 4 channels)
#   bridge.py            — Pyodide ↔ JavaScript interface layer
