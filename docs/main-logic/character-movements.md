# character-movements.js — Character Movement Catalog

This file is a **pure data file** (v3.2.1). It defines a single global constant `CHARACTER_MOVEMENTS` that maps every animatronic character, movement, and lighting control to a specific **track** (TD or BD) and a specific **bit index** (0-based).

No functions live here. No logic. It is the single source of truth for the complete 190-bit layout of both control tracks (94 TD + 96 BD channels).

---

## Why This File Exists

Without this catalog, the inline SCME bridge in `index.html` and the Python SGM would need to hardcode bit positions in multiple places. Instead, any part of the system that needs to fire a movement looks it up here:

```js
const { track, bit } = CHARACTER_MOVEMENTS["Rolfe"].movements["mouth"];
// track = "TD", bit = 0  (0-indexed)

const { track, bit } =
  CHARACTER_MOVEMENTS["Lights"].movements["spotlight_rolfe"];
// track = "TD", bit = 86 (0-indexed)
```

---

## Structure

```js
const CHARACTER_MOVEMENTS = {
  "CharacterName": {
    movements: {
      "movement_name": { track: "TD" | "BD", bit: <0-indexed int> },
      ...
    }
  },
  ...
};
```

---

## Complete Character & Light Catalog (Rock-Afire Explosion)

### Track TD (Channel 2 in 4-ch WAV) — 94 bits

TD carries **94 usable control channels**. Three bits are hardware blanks that must always be `0`:

- Bit 55 (1-based: 56 — blank)
- Bit 64 (1-based: 65 — blank)
- Bit 69 (1-based: 70 — blank)

| Character / Group    | Bits (0-indexed) | Movements                                                                                          | Notes                           |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Rolfe**            | 0–18             | mouth, eyelids, eyes, head (left/right/up), ears, arm raise/twist/elbow, body twist/lean           | Lead guitarist/vocalist         |
| **Earl** (puppet)    | 19, 35–36        | head_tilt, mouth, eyebrow                                                                          | Attached to Rolfe's shoulder    |
| **Duke LaRue**       | 20–34, 62–63     | head (left/right/up), ears, eyelids, eyes, mouth, elbows, arm swings, hi-hat, bass drum, body lean | Bassist/drummer                 |
| **Fats**             | 40–44, 50–61     | eyelids, eyes, mouth, head (tip/left/right/up), arm swings, elbows, foot tap, body lean            | Keyboard player                 |
| **Props (Animated)** | 37–39, 45–49     | sun (mouth/raise), moon (mouth/raise), looney bird hands, antioch down, baby bear raise            | Stage decorative props          |
| **Organ Lights**     | 65–74            | top (blue/red/amber/green), leg (top/mid/bottom), strobes (continuous/flash)                       | Mounted on stage organ          |
| **Sign Lights**      | 75–79            | inner, mid, outer, strobes (continuous/flash)                                                      | Exterior sign lighting          |
| **Stage Spotlights** | 80–87            | mitzi, beach (bear), looney (bird), bob (billy), fats, duke, rolfe, earl                           | Individual character spotlights |
| **Curtains**         | 88–93            | open/close for: stage right, center stage, stage left                                              | Motorized stage curtains        |

### Track BD (Channel 3 in 4-ch WAV) — 96 bits

BD carries **96 usable channels**. One bit is a hardware blank:

- Bit 44 (1-based: 45 — blank)

| Character / Group               | Bits (0-indexed) | Movements                                                                                                                        | Notes                       |
| ------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Beach Bear**                  | 0–15             | eyelids, eye cross, hand slide, guitar raise, head (left/right/up), leg kicks, arm raise/twist/elbow, wrist, body lean, mouth    | Lead guitarist              |
| **Looney Bird**                 | 16, 20–21, 40–42 | mouth, head right, raise, eyelids, eye cross                                                                                     | Interactive performer       |
| **Mitzi**                       | 17–37            | arm raise/twist/elbow (left/right), ears, head (left/right/up), eyelids, eyes, mouth, body twist/lean                            | Vocalist                    |
| **Billy Bob**                   | 38–62            | arm slide, guitar raise, foot tap, mouth, eyelids, eyes, head (left/right/tip/up), arm raise/twist/elbow, wrist, body twist/lean | Secondary guitarist         |
| **Tape Control**                | 63–64            | stop, rewind                                                                                                                     | Tape deck machine control   |
| **Flood Lights - Stage Right**  | 65–68            | blue, green, amber, red                                                                                                          | Color-programmable floods   |
| **Property Light - Applause**   | 69               | applause (single control)                                                                                                        | Audience reaction light     |
| **Flood Lights - Center Stage** | 70–73            | blue, green, amber, red                                                                                                          | Color-programmable floods   |
| **Property Light - Drums**      | 74               | drums (single control)                                                                                                           | Drum kit illumination       |
| **Flood Lights - Stage Left**   | 75–78            | blue, green, amber, red                                                                                                          | Color-programmable floods   |
| **Property Light - Fire/Still** | 79               | fire_still                                                                                                                       | Fire effect or static light |
| **Backdrop & Scenic Lights**    | 80–86            | backdrop (outside blue, inside amber/blue), treeline (blue/red), bushes (green, red/amber)                                       | Environmental lighting      |
| **Stage Spotlights (BD track)** | 87–89, 95        | sun, moon, spider, guitar                                                                                                        | Special effects spotlights  |
| **Service Lights**              | 91–94            | service station (red/blue), rainbow (red/yellow)                                                                                 | Service location lights     |

---

## Unified "Lights" Group (v3.2.1)

A special consolidated group aggregates **all 70+ lighting controls** for use by SAM (Show Analysis Module):

```js
CHARACTER_MOVEMENTS["Lights"].movements // →  {
  "sun_mouth", "sun_raise", "moon_mouth", "moon_raise", ...,
  "spotlight_mitzi", "spotlight_beach", "spotlight_looney", ...,
  "flood_stage_right_blue", "flood_center_stage_red", ...,
  "curtain_stage_right_open", ...,
  ... [60+ more]
}
```

The Lights group enables automated light choreography during AI-assisted show generation. Movement names preserve their underlying bit assignments for consistency.

---

## Bit Mapping Consistency

All bit assignments across the system must stay synchronized:

| Source                                  | Bit Index   | Blank Bits              | Last Updated |
| --------------------------------------- | ----------- | ----------------------- | ------------ |
| **character-movements.js** (this file)  | **0-based** | TD: 55, 64, 69 / BD: 44 | v3.2.1       |
| **SCME/SMM/constants.py**               | **1-based** | TD: 56, 65, 70 / BD: 45 | v3.2.1       |
| **export_bridge.py** (\_TD_CH, \_BD_CH) | **1-based** | (same as above)         | v3.2.1       |
| **RAE_Bit_Chart.md** (reference)        | **1-based** | (same as above)         | v3.2.1       |

Always subtract 1 to convert from the RAE PDF (1-based) to JavaScript (0-based).

---

## Relationship to Python Constants

This file mirrors the complete channel mapping in `SCME/SMM/constants.py`:

- `TD_CHANNELS` dict maps all 94 TD channel names to 1-based bit numbers
- `BD_CHANNELS` dict maps all 96 BD channel names to 1-based bit numbers

When adding a new control or lighting channel, it **must be added to both places**:

1. `character-movements.js` — for browser UI and simulation
2. `SCME/SMM/constants.py` — for Python encoder, frame builder, and validator
3. `SCME/SGM/export_bridge.py` — update line 217+ \_CHAR_MOV_BITS to include new movements

---

## Munch's Make Believe Band

> **v3 note:** Munch's Make Believe Band is **not actively used** in the v3 browser UI. The show builder (`index.html`) is initialized only for Rock-Afire Explosion. Munch band entries remain in `character-movements.js` and in `SCME/SMM/constants.py` for legacy/standalone tooling and future support.

Munch band characters (Chuck E. Cheese, Munch, Helen Henny, Jasper T. Jowls, Pasqually) use a different subset of bits from the Rock-Afire Explosion. Most have fewer movements than their RAE counterparts.
