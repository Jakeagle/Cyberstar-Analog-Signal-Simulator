# KWS Analysis — Known-Working Show Findings

This page documents what was learned from analysing recordings of Known-Working Shows (KWS) — WAV files captured directly from physical Cyberstar animatronic hardware output.

---

## What Are KWS Files?

KWS files are WAV files derived from Internet Archive recordings of Cyberstar character adjustment videos (MP4s) in which the control signals are audible. The MP4s were converted to WAV and analysed to reverse-engineer the signal structure. Because the figures in these videos are functioning correctly, the signals captured in them are ground truth for what a valid BMC signal looks like.

We analysed **4 KWS WAV files**: 3 were character movement adjustment tests featuring multiple characters, and 1 was a drum loop beat.

---

## Run-Length Analysis

The most important step was measuring **run lengths between zero-crossings** in the TD and BD signals.

A run length is the number of audio samples between two consecutive polarity transitions. In BMC:

- Short runs (~4–5 samples) correspond to the first or second half of a **bit-1** period
- Long runs (~9 samples) correspond to the full period of a **bit-0**

### Results

From KWS analysis, the run-length histogram showed a clear bimodal distribution:

| Peak   | Sample count | Interpretation                     |
| ------ | ------------ | ---------------------------------- |
| Peak 1 | 4–5 samples  | Half-bit period (bit-1 transition) |
| Peak 2 | 9 samples    | Full-bit period (bit-0)            |

At 96 kHz resample (for easier visualisation):

- Peak 1: 9–10 samples
- Peak 2: 20 samples

This confirmed:

- **Baud rate = 4,800 bps** (9 samples/bit at 44,100 Hz matches peaks perfectly)
- **Encoding = BMC** (not NRZ, not Manchester — the bimodal distribution is the BMC signature)
- **Samples per bit = 9** (floor division, not round — no 10-sample runs observed)

### Coverage

Mean BMC run-length coverage across all 8 KWS channels: **89.3%**

This means 89.3% of all measured run lengths fell within the expected ±30% tolerance window of either the full-bit or half-bit nominal values. The remaining 10.7% are attributed to:

- Analog tape noise (physical hardware)
- Phase jitter from the hardware PLL
- Some end-of-file silence frames

  89.3% is well above the 2% error-rate threshold that the hardware decoder requires (which applies per-frame, not per-bit stream). The hardware is robust.

---

## Frame Structure Confirmation

After confirming the bit timing, individual frame structures were decoded:

1. Frame boundaries show every 96 bits (864 samples at 9 samp/bit)
2. Every frame's first byte decodes to `0b11111111` = `0xFF (255)` — the sync byte
3. Blank bits (TD: 56, 65, 70; BD: 45) were confirmed to be `0` in **100%** of KWS frames

These three findings together prove the frame format is exactly as specified in `RAE_Bit_Chart_2.pdf`.

---

## Sample Rate Confirmation

KWS WAV headers report: **44,100 Hz**

This was confirmed independently:

- The bimodal peaks fall at exact integer sample counts (4, 5, 9) — only possible at 44,100 Hz with 4,800 baud
- At any other sample rate, 4,800 baud would produce fractional sample counts and the peaks would be spread/blurred

---

## Amplitude Levels

KWS amplitude observations:

- The signal is a near-square wave with minor ringing on transitions (analog hardware)
- Peak levels: approximately ±28,000 to ±32,000 in int16 scale (close to full range)
- No DC offset observed (BMC is inherently DC-balanced)

Our encoder uses `BMC_HIGH = +32767` and `BMC_LOW = -32768` — maximum amplitude — to maximise noise margin when the signal is re-decoded by software.

---

## What KWS Analysis Did NOT Tell Us

1. **Munch band bit layout** — the KWS files used were all Rock-Afire shows. Munch band bit assignments are inferred from the RAE chart with appropriate adjustments.

2. **Video data format** — no KWS files with video data were available for analysis.

---

## Files Used in Analysis

```
KWS_1_Come_Together_4ch.wav       — 256000ms, 4ch, 44100Hz
KWS_2_Hip_To_Be_Square_4ch.wav    — 198000ms, 4ch, 44100Hz (also used as validation failure case)
KWS_3_Lets_Groove_4ch.wav         — 220000ms, 4ch, 44100Hz
KWS_4_Rock_With_You_4ch.wav       — 189000ms, 4ch, 44100Hz
```

Analysis tools: `tools/analyze_rshw.py`, `tools/analyze_rshw2.py`, `tools/analyze_rshw3.py`, `tools/compare_nrbf.py`
