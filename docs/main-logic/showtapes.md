# showtapes.js — Bundled Showtape Library (Legacy v2)

> **v3 notice:** `showtapes.js` is a **legacy module** and is **not loaded** by `index.html` in v3.
> Bundled showtape timelines are not used in v3 — shows are authored manually in the piano roll
> editor. `app.js` (which consumed these bundled tapes) is also legacy. This documentation is
> retained for historical reference.

`showtapes.js` contained the pre-built, hand-crafted (and auto-generated) showtape timelines that shipped with the v2 simulator. These are used for:

- Demo playback without requiring audio upload
- Testing the playback engine and signal generator
- Providing reference timelines for developers

---

## What's Stored Here

### `SONG_TIMING`

Metadata for each bundled song:

```js
{
  comeTogether: {
    title: "Come Together - The Beatles",
    bpm: 84,
    durationMs: 256000,
  },
  ...
}
```

### `BAND_CHARACTERS`

Which characters belong to each band (used to populate monitor panels):

```js
{
  munch: ["Chuck E. Cheese", "Munch", "Helen Henny", "Jasper T. Jowls", "Pasqually"],
  rock:  ["Billy Bob", "Mitzi", "Fatz", "Beach Bear", "Dook LaRue", "Rolfe", "Earl"],
}
```

### `MOVEMENT_PATTERNS`

Per-character lists of movement names. Used as a fallback pattern library when the Python SAM is unavailable (e.g. offline mode or Pyodide load failure).

### Showtape Objects

Each showtape is a large object containing a full timeline — arrays of `{timeMs, character, movement, state}` events derived either from hand-timing or from a prior auto-generation run.

---

## How Showtapes Are Selected

`app.js` reads `SHOWTAPES` (the collection of all bundled tapes) and populates the sidebar selector. When the user picks a bundled tape, `loadShowtape(id)` in `app.js`:

1. Fetches the showtape object from `SHOWTAPES[id]`
2. Runs it through `buildPlaybackSchedule()` to sort events by time
3. Starts playback

---

## Format of a Timeline Entry

Every event in a showtape follows this shape:

```js
{ timeMs: 1250, character: "Rolfe", movement: "mouth", state: true }
```

- `timeMs` — milliseconds from show start when this event fires
- `character` — must exactly match a key in `CHARACTER_MOVEMENTS`
- `movement` — must exactly match a movement key for that character
- `state` — `true` = actuator on, `false` = actuator off

Events always come in matched on/off pairs. The duration an actuator stays on is the time between its `state: true` event and its corresponding `state: false` event.

---

## Notes for Adding New Showtapes

1. Create a new entry in `SHOWTAPES` with a unique `id`
2. Add corresponding metadata to `SONG_TIMING` if it has a music track
3. Ensure all character/movement names match `CHARACTER_MOVEMENTS` exactly (case-sensitive)
4. Test with the Signal Visualizer to confirm the BMC output looks correct
