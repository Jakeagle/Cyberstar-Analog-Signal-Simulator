# Cyberstar Simulator / Lychee Conductor Changelog

All notable changes to this project are documented in this file.

---

## [3.3.3] - 2026-03-08

### Feature: Enhanced Zoom Range for Full Project View

**Improved**: Timeline zoom functionality expanded to allow comfortable viewing of entire project without scrolling.

#### Details

- **Expanded zoom range** from 1-40 px/frame to 0.1-100 px/frame
  - Minimum 0.1 px/frame: Displays ~900 frames per 1920px screen (full project fits with margins)
  - Maximum 100 px/frame: Allows ultra-fine editing for precise signal placement
- **Sub-pixel rendering**: Zoom levels now support fractional pixel values for smooth scaling
- Use zoom buttons or keyboard shortcuts (+/-) to navigate the full range
- Enables single-screen project overview without horizontal/vertical scrolling

#### Technical

- Updated `applyZoom()` constraint from `Math.min(40, ...)` to `Math.min(100, ...)`
- Updated minimum zoom from `Math.max(1, ...)` to `Math.max(0.1, ...)`
- Sub-pixel zoom values are rounded to 1 decimal place for display

#### Impact

- ✅ Full project timeline visible at once without scrolling
- ✅ Maintained precision for fine-grained editing
- ✅ Better project overview and navigation
- ✅ Keyboard shortcuts (+/-) and zoom buttons now span full range

---

## [3.2.3] - 2026-03-06

### Hotfix: Revert naming to Fatz

**Changed**: Character name corrected back to **Fatz** throughout the application to match original specification.

#### Details

- Renamed all internal references from `Fats` to `Fatz` (JS globals, Python SAM, showtapes, visualizer, etc.)
- Updated toolbar color map, band order, and legacy configurations
- Version number bumped to 3.2.3

--

## [3.2.2] - 2026-03-06

### Hotfix: Character Naming Consistency

**Fixed**: Fats character (keyboardist) now correctly displays in the character tester and show editor.

#### Problem

The character was defined as `"Fats"` in the authoritative source (character-movements.js, constants.py, show_bridge.py) but referenced as `"Fatz"` in UI configuration arrays and legacy imports, causing the UI to skip rendering the character entirely.

#### Solution

Standardized naming to `"Fats"` (with lowercase 't') across all files:

- **index.html**: Updated character order arrays and color mappings (3 locations)
- **app.js**: Fixed BAND_CONFIG rock band character reference
- **showtapes.js**: Fixed all show choreography references (12 locations)
- **show_bridge.py**: Fixed SAM (Show Analysis Module) character key

#### Impact

- ✅ Fats character now renders in tester panel with correct purple color
- ✅ All 16 Fats movements (eyelids, eyes, mouth, head, arms, elbows, foot tap, body lean) accessible
- ✅ Pre-made shows using Fats choreography function correctly
- ✅ AI show generation via SAM includes Fats in analysis

#### Files Modified

- index.html (3 changes)
- app.js (1 change)
- showtapes.js (12 changes)
- SCME/SAM/show_bridge.py (1 change)

**Commit**: `927326c`

---

## [3.2.1] - 2026-03-06

### Complete RAE Bit Chart Implementation

This release brings full support for all Rock-Afire Explosion characters, movements, and lighting controls as documented in the complete RAE_Bit_Chart.md.

### Added Characters & Controls

#### New Light Control Groups (Organizational)

- **Organ Lights**: Top/Leg sections with strobes (bits 66-75)
- **Sign Lights**: Inner/Mid/Outer with strobes (bits 76-80)
- **Stage Spotlights**: Individual character spotlights (bits 81-88)
- **Curtains**: Stage right/center/left open/close (bits 89-94)
- **Tape Control**: Stop/Rewind functions (bits 64-65 on BD track)
- **Flood Lights**: Stage right/center/left color sections (BD track)
- **Backdrop & Scenic Lights**: Backdrop, treeline, bushes (BD track)
- **Property Lights**: Applause, drums, fire, gas pump (BD track)
- **Service Lights**: Service station, rainbow lights (BD track)
- **Stage Spotlights BD**: Sun, moon, spider, guitar lights (BD track)

#### Unified Lights Group

- New **Lights** group consolidates all lighting controls
- Used by SAM (Show Analysis Module) for automated choreography
- Includes all properties, organ lights, sign lights, spotlights, curtains, and flood lights
- Movement names respect the underlying control bit assignments

### Changed

#### JavaScript Files

- **character-movements.js**:
  - Updated version to v3.2.3
  - Complete RAE bit chart mapping for all 94 TD and 96 BD channels
  - Added organized light control groups
  - Added unified "Lights" group for SAM compatibility
  - Removed old incomplete "Lights" group

- **signal-visualizer.js**:
  - Updated `_RAE_CHARS` set to include all new light groups
  - Enables full visualization of light timing in .rshw imports

#### Python Files

- **SCME/SGM/export_bridge.py**:
  - Added character-to-movement mappings for all new light groups
  - Unified "Lights" group includes all light movement definitions
  - Maintains compatibility with existing shows

### Verified Compatible

- ✅ 4-channel WAV export functionality (export_bridge.py)
- ✅ .rshw export functionality (rshw_builder.py)
- ✅ Python BMC encoding (bmc_encoder.py)
- ✅ Frame building (frame_builder.py)
- ✅ Show analysis module (show_bridge.py/SAM)
- ✅ Signal visualization (signal-visualizer.js)

### Technical Details

#### Track Assignments

- **TD Track (Top Drawer)**: Characters + Org/Sign lights + Curtains (94 bits)
- **BD Track (Bottom Drawer)**: Characters + Flood/Property lights (96 bits)

#### Bit Mapping Consistency

- Python constants.py: Complete TD_CHANNELS and BD_CHANNELS maps
- JavaScript character-movements.js: 0-indexed bit values (subtract 1 from spec)
- export_bridge.py: Inline channel maps matching Python definitions
- All bit assignments validated against RAE_Bit_Chart.pdf

### No Breaking Changes

- Existing .cybershow.json shows continue to work
- Existing .rshw files can be imported and visualized
- 4-channel WAV export maintains same format
- All original character movements preserved

### Notes for Developers

- When adding new movements, ensure bit index consistency across all three maps:
  1. character-movements.js (0-based)
  2. export_bridge.py \_CHAR_MOV_BITS (0-based)
  3. export_bridge.py \_TD_CH / \_BD_CH (1-based)
- RAE_CHARS in signal-visualizer.js must be updated for new character groups
- HTML show-builder UI automatically picks up new controls from CHARACTER_MOVEMENTS global

---

## [3.2] - 2026-03-03

### Backup & Recovery System

Added comprehensive backup and recovery functionality for show tapes with new `.lcsf` format.

#### New Features

- **Show Export (.lcsf)**: Save custom shows to Lychee Conductor Show File format
  - Human-readable JSON structure
  - Includes title, description, band, BPM, sequences, and metadata
  - Click "↓ Export .lcsf" button on any custom show card

- **Show Import (.lcsf / Legacy .cybershow.json)**: Load and recover shows
  - Accepts both new .lcsf and legacy .cybershow.json formats
  - Optional WAV file import for synchronized playback/export
  - Validates band, character names, and movement keys
  - Skips invalid cues with warning count; calculates duration automatically
  - Drag-and-drop import panel in Custom Show Builder

- **WAV Recovery**:
  - Load WAV songs alongside show imports
  - Auto-sync show playback with imported audio
  - Music included in 4-channel export after recovery

#### UI Updates

- Show action buttons redesigned for clarity
  - "▶ Play" - Select and play the show
  - "✕ Delete" - Remove show (danger action)
  - "↓ Export .lcsf" - Download show file

- Import panel with drag-and-drop support:
  - Primary file input (.lcsf or .cybershow.json)
  - Optional WAV file selector
  - Clear validation feedback

#### Format Details

- New filename extension: `.lcsf` (Lychee Conductor Show File)
- Backwards compatible: existing .cybershow.json files auto-detected and imported as legacy format
- Filename stripped of special characters on export
- Title extraction from filename: works with both .lcsf and .cybershow.json extensions

#### Files Modified

- app.js (show export/import functions, UI button labels)
- index.html (import panel UI)
- docs/README.md (format documentation)

**Commit**: `5c31fed`

---

## [3.1.1] - 2026-02-26

### Logo & Branding Update

Enhanced visual branding with improved logo and UI polish.

#### Changes

- **Logo Integration**: Replace text-only branding with removebg-cleaned Lychee Conductor logo
  - Logo used in intro and toolbar for consistent visual identity
  - Professional appearance in all UI contexts

- **Toolbar Branding**:
  - Logo icon in top toolbar
  - Consistent purple theme integration
  - Improved visual hierarchy

#### Files Modified

- index.html (logo integration, image assets)
- styles.css (logo styling, sizing)

**Commit**: `fbc0a92`

---

## [3.1] - 2026-02-25

### Rebrand to Lychee Conductor

Complete rebrand from "Cyberstar Simulator" to "Lychee Conductor" with visual identity overhaul.

#### Major Changes

- **Naming**: All internal and external references changed from Cyberstar Simulator to Lychee Conductor
  - Project documentation rebranded throughout
  - Social/publication references updated
  - Consistent naming across all materials

- **Visual Theme**: Purple-based color scheme
  - Primary purple colors for buttons and UI elements
  - Updated stylesheet with new color palette
  - Logo integration (simple lychee fruit icon)

- **Intro Screen**: Branded intro with logo and project description
  - Welcoming first-time user experience
  - Visual introduction to Lychee Conductor

- **Documentation**: Complete rebranding of all docs
  - Updated README files
  - References changed throughout
  - Consistent terminology

#### Files Modified

- Multiple documentation files (README.md, user guide, main logic docs)
- HTML UI (title, intro screen, toolbar)
- CSS (color scheme, branding elements)
- Python documentation comments

#### Why the Rebrand?

The project evolved to encompass much more than a simple simulator for the Rock-Afire Explosion animatronics. It became a comprehensive show orchestration tool with signal visualization, and export formats. "Lychee Conductor" better reflects the project's current scope as an orchestral conductor tool for complex multimedia shows.

**Commits**: `7947e85` (main rebrand), `ee29c10` (docs rebrand)

---

## [3.0] - 2026-02-25

### Timeline Show Editor & Character-Centric Architecture

Major architectural shift to timeline-based show editing with character-centric data model.

#### New Features

- **Standalone Timeline Editor (editor.html)**:
  - Full DAW-style visual show editor with dark theme
  - Ruler with MM:SS timestamps and frame numbers (auto-scaling zoom)
  - One track row per movement, grouped by character with colored headers
  - Signal blocks rendered as colored bars (ON→OFF pairs)
  - Click+drag empty row to create new signal blocks
  - Click block to select, Delete key to remove
  - Click ruler to seek playhead
  - Web Audio API WAV playback synced to playhead
  - Space = play/pause, Arrow keys = step ±5/50 frames, +/- = zoom

- **Character-Centric Show Export Format**:
  - New v3.0 format groups signals per character instead of flat timeline
  - Each character block has track (TD/BD) and signals[] array
  - Each signal: frame, timestamp (MM:SS.mmm for reference), movement, bit, state, note
  - Backwards compatible: import handles both v3.0 (characters{}) and v2.1 legacy (sequences[])
  - Duration in both frame and millisecond formats

#### Architecture Changes

- **Signals Model**:
  - Moved from loose sequence arrays to character-organized structure
  - state field (true=ON, false=OFF) replaces stateless data arrays
  - Per-signal notes and timestamps for documentation

- **Show Definition**:
  - Band reference (rock/munch)
  - BPM for timing calculations
  - Character-grouped movement sequences
  - Metadata (title, description, duration)

#### Validation & Compatibility

- Import validation: checks band, character names, movement keys
- Legacy format auto-detection and conversion
- Skips invalid cues with warning count
- Duration calculation from last cue or user specification

#### Technical Details

- Frame-to-millisecond conversion: 1 frame = 20ms (50 FPS)
- Timestamp field is write-once reference only; import drives timing from frame
- Both v3.0 and v2.1 formats supported simultaneously

#### Files Modified

- New: editor.html (standalone editor)
- app.js (character-centric export/import)
- styles.css (editor styling)
- character-movements.js (data source)

**Commits**: `5fa6c76` (character-centric format), `62c022d` (timeline editor)

---

## [2.1] - 2026-02-24

### Show Export/Import System & Signal-Based Architecture

First production-ready release with show persistence and exchange formats.

#### New Features

- **Show Export/Import**:
  - Export any custom show as human-editable .cybershow.json
  - JSON format includes all sequence cues (time, character, movement, state, note)
  - Import .cybershow.json files with validation
  - Character name and movement key validation
  - Duration calculation from last cue

- **Offline BMC Signal WAV Export**:
  - Generate control signal WAVs without live hardware
  - 4800 baud BMC encoding of TD and BD tracks
  - Compatible with RetroMation and similar hardware

#### Architecture

- **Signal-Based Sequences**:
  - Moved from hardware-specific byte patterns to abstract signal model
  - Each signal: character, movement (bit mapping), time, state (ON/OFF)
  - Abstract → concrete: converter generates BMC frames at export time

- **Movement Aliasing**:
  - Show builder can use friendly names (guitar, hip_sway, blink)
  - Automatic mapping to canonical CHARACTER_MOVEMENTS keys
  - 50+ aliases for common show choreography terms

#### Technical Components

- Movement alias resolution and validation
- Sequence-to-BMC conversion pipeline
- WAV encoder for offline signal generation

#### Files Modified

- app.js (show export/import UI)
- showtapes.js (movement aliases, sequence building)
- signal-visualizer.js (signal display)
- styles.css (import panel styling)

**Commits**: `692093d` (show exchange system), `199bca7` (offline BMC export)

---

## [2.0] - 2026-02-24

### Hardware-Grade Signal Generation & Animation Engine

Production signal generation with sub-sample precision and hysteresis jaw simulation.

#### Major Improvements

- **Sub-Sample Accumulator BMC Engine**:
  - Replace per-bit rounding with floating-point accumulator
  - sampleAccum += samplesPerBit each bit; use rounded start/end values
  - Eliminates rounding drift (Rolfe Christmas Tree bug fix)
  - Exact timing at 48000 Hz/4800 baud (10.0 samples/bit)
  - Approximate timing at 44100 Hz (9.1875 samples/bit)

- **Hard Square Wave BMC**:
  - Clean bipolar waveform (±1.0 amplitude)
  - Midpoint calculation using integer bitshift (no rounding error)
  - Noise/amplitude scaling applied post-generation

- **State-Lock LED Updates**:
  - Compare each byte of trackTD/trackBD to previous state
  - Skip DOM writes if unchanged (fixes Rolfe seizure LED spam)
  - Eliminates redundant log entries

- **Hysteresis Jaw Engine**:
  - Intelligent jaw control with audio-driven sync
  - Vocal-onset detection for syllable-accurate pulsing
  - Syllable-accurate open/close pairs

#### Technical Details

- BMC frame duration: corrected for animation drift
- AudioContext forced to 44100 Hz for consistent export
- Music resampling to BMC sample rate in 4-channel export

#### Files Modified

- cyberstar-signals.js (sub-sample accumulator, hard square wave)
- app.js (state-lock LED updates, audio resampling)
- signal-visualizer.js (visualization updates)

**Commits**: `681962a` (sub-sample accumulator engine), `c2fbb0a` (hysteresis jaw engine)

---

## [1.0] - 2026-02-24

### Initial Release: Custom Show Builder & WAV Sync

First public release with core show building and music synchronization.

#### Features

- **Custom Show Builder**: Visual timeline for choreographing character animations
  - Drag-to-create movement blocks on character timelines
  - Time-based positioning (MM:SS format)
  - Multiple character simultaneous animation support

- **WAV Audio Sync**:
  - Load WAV files for synchronized playback
  - Show playback locked to audio timeline
  - Export music alongside BMC control signals

- **Rock-Afire Explosion Choreography**:
  - Pre-made shows from "Come Together" RAE song arrangement
  - Drum, bass, rhythm guitar, vocal, and character choreography
  - Multi-bar sections with automatic timing

- **Stage Visualization**:
  - Character indicators showing animation state
  - Real-time preview during playback
  - Visual feedback for selected movements

#### Core Components

- **character-movements.js**: Character and movement definitions
- **signal-visualizer.js**: Stage view and signal display
- **showtapes.js**: Pre-made show definitions and choreography
- **app.js**: Main UI and orchestration logic
- **index.html**: Web interface

#### Supported Hardware

- BMC (Biphase Mark Code) 4800 baud control signals
- TD (Treble Data) and BD (Bass Data) tracks
- RetroMation-compatible 4-channel WAV export

**Initial Commit**: `c7d97e4` (WAV sync, custom show builder, song-mapped choreography)

---

## Release Notes Archive

For detailed technical notes on signal engineering, see:

- [ai_studio_code.txt] - Sub-sample accumulator optimization notes
- [EMERGENCY-PATCH.md] - Rolfe fix critical patch documentation
- [sample-rate-timing-bugs.md] - Sample rate and timing analysis
- BMC encoding, frame syncing, and signal validation research in docs/research/

---

**Latest Update**: 2026-03-06
