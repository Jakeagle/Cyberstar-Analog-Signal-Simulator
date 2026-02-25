# Rock‑afire Explosion (RFE) and Munch's Make Believe Band (MMBB) — Movement Reference

> Purpose: a complete checklist of *possible movements* for each major animatronic character used in the Rock‑afire Explosion (RFE) and Munch's Make Believe Band (MMBB). Use this as the authoritative movement catalog when mapping visual events to show‑tape frames for a JS/WebAudio simulator.

---

## entity["musical_artist","The Rock‑afire Explosion","animatronic band 1980s"] — Typical character movement lists

> Notes: these movements come from hardware documentation, community movement inventories, and preservation resources. For many characters the movement sets were reused across 3‑stage and classic stages, with some later variants adding hip/waist or extra hand motions.

### entity["fictional_character","Fatz Geronimo","rock-afire animatronic"]
- Mouth (jaw open/close)
- Lower lip/upper lip subtle control (if fitted)
- Eyelids (left/right blink)
- Eye direction (left/right/center)
- Head turn (left/right)
- Head tilt (up/down)
- Upper torso twist (left/right)
- Shoulder/arm raises (left, right)
- Arm twist/forearm rotation
- Hand/finger pose (open/strum/point)
- Keyboard chest/torso motion (lean/press)
- Foot/hip bounce (timed for rhythm)

### entity["fictional_character","Billy Bob Brockali","rock-afire animatronic"]
- Mouth (jaw open/close)
- Eyelids (left/right blink)
- Eye cross / look directions
- Head turn left / right
- Head tilt (left/right/up/down)
- Right arm raise / Lower
- Right arm twist (strum motion)
- Right hand/guitar strum
- Left arm slide / guitar slide
- Guitar raise / lower
- Body lean / body turn left/right
- Foot tap / leg kicks

### entity["fictional_character","Mitzi Mozzarella","rock-afire animatronic"]
- Mouth (jaw open/close)
- Eyelids/blink
- Eye direction (left/right)
- Head turn (left/right)
- Head tilt
- Shoulder/arm raise (left/right)
- Arm swing / wrist rotation
- Hip sway / waist sway (dance movement)
- Hand gestures (wave, point)
- Foot/leg movements (simple taps)

### entity["fictional_character","Beach Bear","rock-afire animatronic"]
- Mouth (jaw open/close)
- Eyelids/blink
- Eye look left/right
- Head turn / tilt
- Arm raise / guitar strum
- Hand gestures
- Torso lean / sway
- Foot tap / rhythmic bounce

### entity["fictional_character","Dook LaRue","rock-afire animatronic"]
- Mouth (jaw open/close)
- Eyelids/blink
- Eye direction
- Head nod / tilt
- Upper torso swivel (waist swivel)
- Arm up/down (drum hits)
- Wrist/hand flick (stick motion)
- Cross‑arm reach (for cymbals)
- Foot/leg movement (kick, tap)

### entity["fictional_character","Looney Bird","rock-afire animatronic"]
- Head pop up / down (rise from drum barrel)
- Mouth (beak open/close)
- Neck bob / quick pecks
- Small wing/hand gestures (if fitted)
- Head tilt / look directions

### entity["fictional_character","Rolfe DeWolfe","rock-afire animatronic"] and entity["fictional_character","Earl Schmerle","rock-afire animatronic puppet"] (ventriloquist pair)
- **Rolfe:**
  - Mouth (vocal jaw movement)
  - Right ear / left ear (ear flicks)
  - Right / left eyelid
  - Eye look left/right
  - Head left/right/up
  - Left/right arm raise
  - Left/right elbow bend
  - Left/right arm twist
  - Body twist left/right
  - Body lean
  - Small hand poses
- **Earl (puppet):**
  - Head tilt
  - Mouth (jaw movement)
  - Eyebrow/eye movements

### Small props & stage elements (common)
- Sun/Moon bob/rotate
- Antioch (birthday spider) — body wiggle / leg motion / gibberish mouth
- Choo‑Choo / Munch Jr. — small bob/dance

---

## entity["musical_artist","Munch's Make Believe Band","animatronic band 1990s"] — Typical MMBB movement lists

> MMBB shows often reused Cyberamic (Pizza Time / Chuck E. Cheese) animatronic bodies; movement sets vary by generation (1‑stage, 2‑stage, 3‑stage, Cyberamic road/portrait/full‑bodied). Below is a consolidated set of possible movements seen across Cyberamic/Munch configurations.

### entity["fictional_character","Jasper T. Jowls","cyberamic animatronic"]
- Jaw / mouth open‑close
- Eye blink / eyelid
- Eye direction
- Head turn left/right
- Neck side‑to‑side
- Right arm up/down
- Left arm strum / strum motion
- Arm side to side
- Foot stomp / foot tap
- Torso shift / sway

### entity["fictional_character","Pasqually P. Pieplate","cyberamic animatronic"]
- Mouth / jaw
- Eyelids / blink
- Eye look directions
- Head turn / tilt
- Arm raise / lower (often cooking/keyboard gestures)
- Hand/gesture (chef style)
- Body lean / torso movements

### entity["fictional_character","Mr. Munch","cyberamic animatronic"]
- Mouth / jaw
- Eyelids / blink
- Head turn / tilt
- Arm raise / lower (keyboard/strum depending on stage role)
- Hip/torso sway
- Foot taps

### entity["fictional_character","Helen Henny","cyberamic animatronic"]
- Mouth / jaw
- Blink / eyelids
- Head left/right / tilt
- Arm raises / hand gestures (dancey)
- Hip sway / torso movement
- Foot/leg taps

### entity["fictional_character","Chuck E. Cheese","cyberamic animatronic"] (if present in MMBB)
- Mouth / jaw
- Blink / eyelids
- Eye look left/right
- Head turn / tilt
- Arm raise / wave
- Body lean / hip sway
- Hand gestures

### Other possible Cyberamic NPCs (Bella Bunny, etc.)
- Standard CV-style mouth, eyelid, head, arm, torso, foot movements depending on role

---

## Using this movement catalog in a showtape simulator
- **One movement ≈ one output channel.** Many of the above motions map directly to a single output (e.g., `mouth`, `head_turn`, `arm_raise`) that the controller toggles or actuates.
- **Frame packing:** for TDM/BMC-based showtapes, pack each movement’s state into channel bits for the corresponding frame/time slice.
- **Granularity:** some complex motions (e.g., strum, drum hit) are implemented as short micro‑sequences of output pulses; treat these as atomic action patterns in your timeline.

---

## Appendix: notes & provenance
- Movement counts and names were consolidated from community resources, animatronic documentation, and preservation archives. Use this catalog as a working reference; specific hardware revisions and generation variants occasionally add or remove minor motions.

---

*End of movement catalog.*

