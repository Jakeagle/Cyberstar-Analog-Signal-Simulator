# Creating a Show — Step by Step

This page walks you through the complete process of creating a new animatronic show using the auto-generation feature.

---

## Step 1: Select Your Band

At the top of the page, choose which animatronic system you're programming for:

- **Rock-Afire Explosion** — 7 characters (Rolfe, Earl, Fatz, Dook LaRue, Beach Bear, Mitzi, Billy Bob)
- **Munch's Make Believe Band** — 5 characters (Chuck E. Cheese, Munch, Helen Henny, Jasper T. Jowls, Pasqually)

The character monitor panels below will update to reflect your selection.

---

## Step 2: Upload Your Audio

Click the **Upload Audio** button in the left sidebar (or drag-and-drop an audio file anywhere on the page).

**Supported formats:** WAV only — MP3 and other formats are not valid. SPTE only accepts WAV files, so the simulator enforces this requirement.  
**Required:** Stereo WAV at 44,100 Hz (16-bit PCM recommended). Do not use MP3, OGG, or any other format.  
**Duration:** Up to ~10 minutes practical limit (longer shows use more memory)

> **Tip:** The audio you upload becomes the music in your final export. Use the best quality version you have — the simulator will downsample internally for analysis but always uses your original for output.

After uploading:

- The file name appears in the "Now Playing" card
- A Python progress overlay appears

---

## Step 3: Wait for Show Generation

The **Python progress modal** appears while the system:

1. **Prepares audio** (8%) — Decodes your audio file using the Web Audio API
2. **Downsamples** (22%) — Mixes to mono and reduces to 11,025 Hz for analysis
3. **Loads Python** (32%) — Starts the Pyodide WASM runtime (30 MB download, first time only; cached after)
4. **Runs Python analysis** (48%) — Beat detection, onset detection across 4 frequency bands
5. **Analysis complete** (95%) — Choreography generated, loading into the simulator
6. **Done** (100%) — Modal closes, show is ready

Typical times:

- First ever load (downloads Pyodide): 1–3 minutes
- Subsequent loads (Pyodide cached): 5–20 seconds depending on song length

---

## Step 4: Preview the Show

Once generation completes, click **Play** (▶) to preview your show.

### What You'll See

- **Character monitors** light up as actuators fire — green LEDs indicate active movements
- **Progress bar** advances in real time alongside the music
- **BMC signal** is generated and streamed to the Web Audio API (you can monitor it on an oscilloscope if you have one connected)

### What You're Hearing

The music plays through your speakers. The BMC control signals are also playing (on Ch2/Ch3 internally) but are not routed to your speakers during preview — you'd hear a screech if they were.

---

## Step 5: Evaluate the Choreography

While watching the preview, check:

- **Are the right characters moving?** Rolfe and Mitzi should move most during vocal sections; Dook during drum hits.
- **Does the timing feel natural?** Mouth movements should roughly sync with vocal onsets.
- **Is there variety?** The characters should not all move identically.

The SAM auto-generator assigns roles to characters (lead vocalist gets most mouth movement, drummer gets percussion triggers, etc.) but it is working from frequency analysis, not lyrics — it never knows exactly what the lyrics are.

---

## Step 6: Fine-Tune (Optional)

If you want to adjust the choreography:

- Click **Edit Show** to open the timeline editor
- See [manual-editing.md](manual-editing.md) for details

Or continue to export if you're happy with the auto-generated result.

---

## Step 7: Save to My Shows

Click the **Save** button (floppy disk icon) to save the show to `My Shows` in the sidebar. This saves the `.cybershow.json` to browser `localStorage` and persists across page reloads.

> **Note:** `localStorage` is browser-specific and not backed up. For long-term preservation, export the `.cybershow.json` file to disk using File → Export JSON.

---

## Step 8: Export

See [exporting-for-spte.md](exporting-for-spte.md) for the full export walkthrough.
