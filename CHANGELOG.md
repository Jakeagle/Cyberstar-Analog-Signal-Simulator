# Cyberstar Simulator Changelog

## [3.2.1] - 2025-03-06

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

#### Unified Lights Group (for AI Show Builder)

- New **Lights** group consolidates all lighting controls
- Used by SAM (Show Analysis Module) for automated choreography
- Includes all properties, organ lights, sign lights, spotlights, curtains, and flood lights
- Movement names respect the underlying control bit assignments

### Changed

#### JavaScript Files

- **character-movements.js**:
  - Updated version to v3.2.1
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
