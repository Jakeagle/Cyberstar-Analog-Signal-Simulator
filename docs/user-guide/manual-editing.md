# Manual Editing

This guide covers advanced editing operations in the Lychee Conductor piano roll editor.

---

## Opening the Editor

The editor **is** `index.html`. Open it directly in a browser — there is no separate editor page.

> In v2 the editor was a separate `editor.html` page. That file has been retired and renamed `index.legacy.html` for reference only.

---

## Timeline Controls

### Zoom

Use the **Zoom** control in the toolbar (or scroll-wheel over the timeline) to zoom in and out on the frame axis. Zooming in gives finer control for placing short signal pulses.

### Snap

Toggle **"Snap"** to force block edges to snap to frame boundaries. Useful for ensuring signal edges align exactly with frame transitions.

### State Mode

Toggle **"State"** to switch between:

- **State mode ON** — blocks represent sustained "on" states; release = block end
- **State mode OFF** — each click creates a momentary pulse

---

## Keyboard Shortcuts

| Key          | Action                              |
| ------------ | ----------------------------------- |
| Space        | Play / Pause                        |
| Escape       | Stop                                |
| Delete       | Delete selected block               |
| Ctrl+Z       | Undo                                |
| Ctrl+Y       | Redo                                |
| Ctrl+S       | Save                                |
| Arrow keys   | Nudge selected block ±1 frame       |
| Shift+Arrows | Nudge selected block ±10 frames     |

---

## Editing Blocks

| Interaction                          | Result                              |
| ------------------------------------ | ----------------------------------- |
| Click + drag on empty timeline area  | Create new block                    |
| Click on existing block              | Select it                           |
| Drag selected block                  | Move it                             |
| Drag block left or right edge        | Resize (change start/end frame)     |
| Right-click block                    | Context menu (delete, properties)   |
| Delete key (block selected)          | Remove block                        |

---

## Working with Multiple Characters

Each character's rows are collapsed by default showing just the character name. Click a character name in the label panel to expand/collapse its rows and see individual movements.

---

## Saving and Loading

- **Save** (Ctrl+S or toolbar) — writes `showData` to `localStorage`.
- **Saved Shows** — opens a picker for all locally saved shows.
- To share or back up a show, export as 4ch WAV and retain the associated `.cybershow.json` sidecar.

---

## Importing an Existing Show

If you have a `.cybershow.json` file from a previous session, use the **"Load"** option in the Saved Shows dialog (or drag-and-drop onto the timeline area) to import it.
