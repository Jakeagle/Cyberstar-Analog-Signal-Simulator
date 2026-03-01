# Manual Editing — Fine-Tuning Your Show Timeline

The auto-generated choreography from SAM is a good starting point, but it works from audio analysis alone — it doesn't know the lyrics, the story, or your artistic intent. The manual editor lets you add, remove, and adjust movements with precision.

---

## Opening the Editor

From the main simulator page:

- Click **Edit Show** on the Now Playing card, or
- Click the ✏️ icon on any saved show in the sidebar, or
- Navigate directly to `editor.html`

---

## Editor Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Toolbar: [Load JSON] [Save JSON] [Preview] [Export] [Undo] [Redo]  │
├─────────┬───────────────────────────────────────────────────────────┤
│ Track   │  Timeline (scrollable, zoomable)                          │
│ labels  │  ←──────────── time ────────────────────────────────────→ │
│         │                                                           │
│ Rolfe   │  ██████  ████   ██                                       │
│  mouth  │                                                           │
│  ear_L  │     ██████         ████████                              │
│         │                                                           │
│ Fatz    │                                                           │
│  mouth  │  ██   ██   ██   ██   ██   ██                            │
│         │                                                           │
│ ...     │                                                           │
└─────────┴───────────────────────────────────────────────────────────┘
│  Zoom: [─────●────────]  │  BPM: 84  │  Snap: 1 beat              │
└─────────────────────────────────────────────────────────────────────┘
```

Each **row** is one movement of one character. Each **coloured block** represents a time window when that actuator is ON.

---

## Basic Editing Operations

### Add a Movement

Click and drag on an empty area of a row. Release to finish. The block's length is the duration the actuator stays on.

### Delete a Movement

Right-click on a block → Delete, or select the block and press Delete.

### Move a Movement

Click and drag an existing block left or right along its row.

### Resize a Movement

Drag the left or right edge of a block to change its start or end time.

### Snap to Beat Grid

When "Snap: 1 beat" is active, blocks snap to the nearest beat boundary (derived from the BPM SAM detected). You can also snap to half-beats, quarter-beats, or turn snapping off for free positioning.

---

## Understanding the Grid

The timeline is displayed at `fps = 50` internally (one column = 20ms). The horizontal axis shows time in `mm:ss.mmm` format.

At the bottom, a BPM grid overlay shows beat markers. If your show BPM is correct, the beats should align with the onsets in the music — this is a good visual guide for placing mouth movements.

---

## Recommended Editing Workflow

### For Vocal Movements (mouth, head_left/right)

1. Listen to the show with preview playback running
2. Note timestamps where vocal phrases start and end
3. In the editor, add mouth ON blocks aligned with phrase starts, OFF blocks at phrase ends
4. Keep blocks 3–8 frames long for natural movement rhythm (too short = choppy, too long = frozen open)

### For Instrumental Movements (arm raises, body lean)

1. Use the beat grid — arm raises typically fire on downbeats
2. Lead musicians raise arms during solos; support characters respond to the beat
3. Avoid firing the same movement on every beat — leave space for contrast

### For Percussion (Dook LaRue)

1. Bass drum fires on beats 1 and 3 of a 4/4 bar (the "kick")
2. Hi-hat fires on beats 2 and 4 (the "snare" downbeats)
3. These should be very short (1–2 frames) to feel punchy

### For Eye and Eyelid Movements

- Blinks: very short ON+OFF pairs (2–3 frames ON)
- Sustained eye direction changes: 10–30 frames ON while looking at something
- Use sparingly — constant eye motion looks mechanical

---

## Importing and Exporting JSON

The editor works entirely with `.cybershow.json` files:

- **Load JSON**: Opens a `.cybershow.json` file from disk and populates the timeline
- **Save JSON**: Exports the current timeline to a `.cybershow.json` file on disk

This is the recommended workflow for collaborative editing — share the JSON file, each person edits their section, merge manually.

---

## Undo / Redo

The editor maintains a full undo history for the current session. Standard keyboard shortcuts:

- `Ctrl+Z` — Undo
- `Ctrl+Shift+Z` or `Ctrl+Y` — Redo

History is lost when you close the browser tab.

---

## Previewing from the Editor

Click **Preview** in the toolbar to load your current timeline into the simulator's playback engine and play it. The editor stays open so you can switch back and continue editing.

The preview uses the same audio you uploaded in the main simulator. Make sure you uploaded audio before opening the editor, or preview will play back the signals without music.
