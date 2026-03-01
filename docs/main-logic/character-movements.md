# character-movements.js — Character Movement Catalog

This file is a **pure data file**. It defines a single global constant `CHARACTER_MOVEMENTS` that maps every animatronic character and their movements to a specific **track** (TD or BD) and a specific **bit index** (0-based).

No functions live here. No logic. It is the single source of truth for the bit layout of both control tracks.

---

## Why This File Exists

Without this catalog, `app.js` and the Python SGM would need to hardcode bit positions in multiple places. Instead, any part of the system that needs to fire a movement looks it up here:

```js
const { track, bit } = CHARACTER_MOVEMENTS["Rolfe"].movements["mouth"];
// track = "TD", bit = 0
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

## Track Assignments (Rock-Afire Explosion)

### Track TD (Channel 2 in 4-ch WAV)

TD carries 94 usable control channels (bits 0–93, 0-indexed). Three bits are hardware blanks that must always be `0`:

- Bit 55 (1-based: 56)
- Bit 64 (1-based: 65)
- Bit 69 (1-based: 70)

Characters on TD:
| Character | Bits (0-indexed) | Notes |
|-----------|-----------------|-------|
| Rolfe | 0–18 | Lead guitarist/vocalist |
| Earl | 19, 35, 36 | Ear on Rolfe's shoulder; head tilt shared with Rolfe section |
| Dook LaRue | 20–34, 62, 63 | Bassist/drummer |
| Fatz | 40–44, 50–61 | Keyboard player |
| Props (Sun, Moon) | 37–39, 45–47 | Stage props |
| Looney Bird | 47–49 | Prop bird |
| Organ lights | 65–73 | Stage lighting on the organ |
| Sign | 75–78 | Exterior sign lighting |
| Stage lighting | 79–86 | Spotlights, individual stabs |
| Curtains | 87–93 | Stage curtains (open/close) |

### Track BD (Channel 3 in 4-ch WAV)

BD carries 96 usable channels (bits 0–95, 0-indexed). One bit is a hardware blank:

- Bit 44 (1-based: 45)

Characters on BD:
| Character | Bits (0-indexed) | Notes |
|-----------|-----------------|-------|
| Beach Bear | 0–15 | Guitarist |
| Looney Bird | 16 | (mouth only — body shared with TD) |
| Mitzi | 17–29 | Vocalist |
| Billy Bob | 30–46 | Leader/guitarist |
| Pasqually | 47–58 | Drummer (only in Munch band via BD) |
| Stage effects | 59–95 | Strobe, fog, additional props |

---

## Relationship to Python Constants

This file mirrors `SCME/SMM/constants.py` (`TD_CHANNELS`, `BD_CHANNELS`). The Python file uses **1-based** bit numbers; this JS file uses **0-based** bit indices. Always subtract 1 when converting between them.

When adding a new channel, it must be added in **both places**:

1. Here (`character-movements.js`) — for the browser simulator
2. `SCME/SMM/constants.py` — for the Python encoder and validator

---

## Munch's Make Believe Band

The Munch band uses a different subset of bits. Most Munch characters have fewer actuators than their RAE counterparts. The file contains both band mappings, selected at runtime by `currentBand` in `app.js`.
