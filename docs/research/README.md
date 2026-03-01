# Research — Reference Materials and Technical Findings

This folder contains all technical reference material accumulated during development. It is the "why we know what we know" section — sources, experiments, confirmed constants, and the history of research decisions.

---

## Document Index

| File                                                   | Contents                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [bmc-encoding.md](bmc-encoding.md)                     | Biphase Mark Code rules, timing, and sample-level behaviour         |
| [rae-bit-chart.md](rae-bit-chart.md)                   | Complete RAE actuator channel map from `RAE_Bit_Chart_2.pdf`        |
| [kws-analysis.md](kws-analysis.md)                     | Known-Working Show analysis — how hardware timing was confirmed     |
| [hardware-timing.md](hardware-timing.md)               | All confirmed hardware constants and how each was derived           |
| [sgm-validation-history.md](sgm-validation-history.md) | History of the signal generation pipeline, including early failures |
| [scme-modules.md](scme-modules.md)                     | Design rationale for each SCME Python module                        |

---

## Key Source Documents

The following external sources informed the project. They are not reproduced here due to copyright, but their file names are referenced:

| Document                                   | Contents                                                                                        | Used For                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `RAE_Bit_Chart_2.pdf`                      | Official Rock-Afire Explosion actuator bitmap — maps character movements to TD/BD bit positions | `constants.py`, `character-movements.js`     |
| `archive.org/details/rae-2000s-adjustment` | Cross-reference for the bit chart; community-sourced                                            | Validation of bit assignments                |
| KWS WAV files (4 total, 8 channels)        | Recordings of known-working Cyberstar hardware output                                           | Timing confirmation, BMC run-length analysis |
| RR-Engine source code (`Assets/Scripts/`)  | C# source confirming `.rshw` format                                                             | `rshw_builder.py`, `rshw-format.md`          |

---

## How Confidence Levels Are Assigned

Throughout this documentation and the code comments, you may see notes like "KWS-confirmed" or "TBD". These mean:

| Label                   | Meaning                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **KWS-confirmed**       | Verified against multiple Known-Working Show WAV files; high confidence |
| **Source-confirmed**    | Verified against RR-Engine C# source code                               |
| **Community-confirmed** | Corroborated by two or more independent community sources               |
| **Working hypothesis**  | Has not been disproven but is inferred, not measured                    |

---

## What We Still Don't Know

These are open research questions as of March 2026:

1. **Munch band full bit chart** — we have the RAE (Rock-Afire) bit chart complete; the Munch band layout is partially inferred
2. **CSO decoder for RR-Engine** — the `.cso` (Cyberstar Online) format was designed for a future decoder to be built into RR-Engine, but that decoder has not been implemented; the format spec is locked but integration work is pending
3. **Video track format** — the `videoData` field in `.rshw` is present but its internal encoding is unknown (no shows with video have been tested)
