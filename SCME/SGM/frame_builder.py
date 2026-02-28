# =============================================================================
# frame_builder.py — RAE Frame Builder
# =============================================================================
#
# Manages the state of TD and BD frames and builds complete PCM signal streams
# from show event data.
#
# A "show event" is a point in time where one channel turns on or off.
# This module converts that sparse event list into a continuous BMC-encoded
# PCM track that can be written directly to a WAV channel.
#
# TIMING GUARANTEE:
#   All sample positions are computed as int(time_seconds * SAMPLE_RATE).
#   No floating-point arithmetic accumulates across event boundaries.
#   Each event is independently anchored to the absolute sample grid.
#
# FRAME TRANSMISSION:
#   The RAE hardware expects a continuously repeating frame stream.
#   Between events, the current frame state is repeated at BAUD_RATE frames/sec.
#   One full TD frame = 94 bits * 9 samples/bit = 846 samples
#   One full BD frame = 96 bits * 9 samples/bit = 864 samples

from SCME.SMM.constants import (
    SAMPLE_RATE, SAMPLES_PER_BIT,
    TD_CHANNELS, BD_CHANNELS,
    TD_BLANK_BITS, BD_BLANK_BITS,
    TD_FRAME_BITS, BD_FRAME_BITS,
)
from .bmc_encoder import BMCEncoder


# Pre-computed frame sizes in samples
TD_FRAME_SAMPLES = TD_FRAME_BITS * SAMPLES_PER_BIT   # = 846
BD_FRAME_SAMPLES = BD_FRAME_BITS * SAMPLES_PER_BIT   # = 864


class FrameBuilder:
    """
    Builds a complete PCM signal stream for one track (TD or BD) from a list
    of timestamped channel events.

    Example:
        events = [
            {"time": 0.000, "channel": "rolfe_mouth",       "active": True},
            {"time": 0.500, "channel": "rolfe_left_arm_raise","active": True},
            {"time": 1.200, "channel": "rolfe_mouth",        "active": False},
        ]
        builder = FrameBuilder("TD")
        pcm_bytes = builder.build(events, duration_seconds=2.0)
    """

    def __init__(self, track: str) -> None:
        """
        Args:
            track: "TD" or "BD"
        """
        track = track.upper()
        if track not in ("TD", "BD"):
            raise ValueError(f"track must be 'TD' or 'BD', got {track!r}")

        self.track        = track
        self._channel_map = TD_CHANNELS  if track == "TD" else BD_CHANNELS
        self._blank_bits  = TD_BLANK_BITS if track == "TD" else BD_BLANK_BITS
        self._frame_bits  = TD_FRAME_BITS if track == "TD" else BD_FRAME_BITS
        self._frame_samps = TD_FRAME_SAMPLES if track == "TD" else BD_FRAME_SAMPLES

        # Current frame state: list of 0/1, index = bit_number-1
        self._frame: list[int] = [0] * self._frame_bits

    # ── Frame state ──────────────────────────────────────────────────────────

    def set_channel(self, channel: str, active: bool) -> None:
        """Activate or deactivate a named channel in the current frame."""
        if channel not in self._channel_map:
            raise ValueError(
                f"Unknown {self.track} channel: {channel!r}\n"
                f"Valid channels: {sorted(self._channel_map)}"
            )
        bit_number = self._channel_map[channel]
        bit_index  = bit_number - 1          # 0-based index into frame list

        if bit_number in self._blank_bits:
            raise ValueError(
                f"Bit {bit_number} is a BLANK/reserved slot in the {self.track} frame. "
                f"It must remain 0."
            )
        self._frame[bit_index] = 1 if active else 0

    def clear_all(self) -> None:
        """Deactivate all channels (all bits = 0)."""
        self._frame = [0] * self._frame_bits

    def get_frame_snapshot(self) -> list[int]:
        """Return a copy of the current frame bit array."""
        return list(self._frame)

    def get_active_channels(self) -> list[str]:
        """Return names of all currently active channels."""
        active = []
        for name, bit_num in self._channel_map.items():
            if self._frame[bit_num - 1]:
                active.append(name)
        return active

    # ── PCM stream builder ───────────────────────────────────────────────────

    def build(self, events: list[dict], duration_seconds: float) -> bytes:
        """
        Build a complete raw PCM signal stream for the track.

        Args:
            events: List of event dicts, each containing:
                      "time"    : float  — absolute time in seconds
                      "channel" : str    — channel name (key in channel map)
                      "active"  : bool   — True = activate, False = deactivate
                    Must be sorted by "time" ascending.

            duration_seconds: Total desired output duration in seconds.
                              Will be rounded up to the nearest whole frame.

        Returns:
            bytes — raw 16-bit signed little-endian PCM, mono.
                    Length = ceil(duration_seconds * SAMPLE_RATE / frame_samps)
                             * frame_samps * 2  (bytes)

        Timing guarantee:
            Each event is anchored at sample = int(time * SAMPLE_RATE).
            No fractional accumulation between events.
        """
        self.clear_all()
        total_samples = int(duration_seconds * SAMPLE_RATE)

        # Round up to nearest complete frame boundary
        remainder = total_samples % self._frame_samps
        if remainder:
            total_samples += (self._frame_samps - remainder)

        # Output buffer: one int16 per sample = 2 bytes each
        output = bytearray(total_samples * 2)

        enc = BMCEncoder()

        # Sort events by sample position (not by float time, to avoid drift)
        sorted_events = sorted(events, key=lambda e: int(e["time"] * SAMPLE_RATE))

        write_cursor = 0   # current write position in samples

        for event in sorted_events:
            event_sample = int(event["time"] * SAMPLE_RATE)   # ← integer anchor

            # Fill from write_cursor to event_sample with current frame
            self._fill_frames(output, enc, write_cursor, event_sample)
            write_cursor = event_sample

            # Apply event
            self.set_channel(event["channel"], event["active"])

        # Fill from last event to end of output
        self._fill_frames(output, enc, write_cursor, total_samples)

        return bytes(output)

    def _fill_frames(
        self,
        output:       bytearray,
        enc:          BMCEncoder,
        start_sample: int,
        end_sample:   int,
    ) -> None:
        """
        Write repeating BMC-encoded frames into `output[start*2 : end*2]`.
        Encodes frame-by-frame, never per-sample — efficient for long gaps.
        """
        if start_sample >= end_sample:
            return

        # Pre-encode one frame with current state (encoder is stateful — pass
        # a *copy* of the encoder level for this region, then restore)
        # Actually, we need phase continuity, so we encode in-place with enc.
        pos = start_sample  # in samples

        while pos < end_sample:
            # Encode one full frame
            frame_pcm = enc.encode_frame(list(self._frame))
            frame_pcm_bytes = BMCEncoder.to_raw_bytes(frame_pcm)

            # How many samples can we write?
            samples_remaining = end_sample - pos
            samples_to_write  = min(self._frame_samps, samples_remaining)
            byte_start = pos * 2
            byte_end   = byte_start + samples_to_write * 2

            output[byte_start:byte_end] = frame_pcm_bytes[: samples_to_write * 2]
            pos += samples_to_write

    # ── Convenience: encode single frame to bytes ────────────────────────────

    def encode_current_frame(self) -> bytes:
        """Return the current frame encoded as BMC PCM bytes (one frame only)."""
        enc = BMCEncoder()
        samples = enc.encode_frame(list(self._frame))
        return BMCEncoder.to_raw_bytes(samples)
