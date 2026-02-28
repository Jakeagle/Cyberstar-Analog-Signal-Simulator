"""
wav_to_rshw.py — Convert 4-channel WAV to .rshw file for animatronic control

Usage:
    python wav_to_rshw.py input.wav output.rshw

- Reads a 4-channel WAV file
- Maps channels to signalData (bitmask per frame)
- Stores audioData and signalData in a binary .rshw file
"""
import sys
import soundfile as sf
import pickle
import numpy as np

THRESHOLD = 0  # Channel ON if value >= THRESHOLD


def wav_to_rshw(input_wav, output_rshw):
    # Read WAV file
    data, sr = sf.read(input_wav, dtype='int16', always_2d=True)
    channels = data.shape[1]
    nframes = data.shape[0]
    if channels != 4:
        print(f"Error: Expected 4 channels, got {channels}")
        return

    print(f"Loaded {input_wav}: {nframes} frames, {channels} channels, {sr} Hz")

    # Map channels to signalData (bitmask)
    # Each frame: bit0=ch1, bit1=ch2, bit2=ch3, bit3=ch4
    signalData = []
    for i in range(nframes):
        bits = 0
        for ch in range(4):
            if data[i, ch] >= THRESHOLD:
                bits |= (1 << ch)
        signalData.append(bits)
    signalData = np.array(signalData, dtype=np.int32)

    # Store audioData as raw PCM bytes
    audioData = data.astype(np.int16).tobytes()

    # Prepare rshw dict
    rshw_obj = {
        'audioData': audioData,
        'signalData': signalData,
    }

    # Serialize to .rshw (using pickle)
    with open(output_rshw, 'wb') as f:
        pickle.dump(rshw_obj, f)
    print(f"Saved .rshw file: {output_rshw}")


if __name__ == '__main__':
    # CLI helpers:
    # 1) Create a pickle .rshw: python wav_to_rshw.py input.wav output.rshw
    # 2) Emit signals JSON only: python wav_to_rshw.py --signals-json input.wav signals.json
    if len(sys.argv) == 3 and sys.argv[1] != '--signals-json':
        wav_to_rshw(sys.argv[1], sys.argv[2])
    elif len(sys.argv) == 4 and sys.argv[1] == '--signals-json':
        _, _, input_wav, out_json = sys.argv
        _, signals, sr = extract_audio_and_signals(input_wav)
        import json as _json
        with open(out_json, 'w') as _f:
            _json.dump(signals, _f)
        print(f"Wrote signals JSON: {out_json} (sample_rate={sr})")
    else:
        print("Usage:")
        print("  python wav_to_rshw.py input.wav output.rshw")
        print("  python wav_to_rshw.py --signals-json input.wav signals.json")
        sys.exit(1)

def extract_audio_and_signals(input_wav):
    """
    Read WAV and return tuple (audio_bytes, signal_list, sample_rate)
    """
    data, sr = sf.read(input_wav, dtype='int16', always_2d=True)
    channels = data.shape[1]
    nframes = data.shape[0]
    # Map channels to signalData
    signalData = []
    for i in range(nframes):
        bits = 0
        for ch in range(min(4, channels)):
            if data[i, ch] >= THRESHOLD:
                bits |= (1 << ch)
        signalData.append(int(bits))

    audioData = data.astype(np.int16).tobytes()
    return audioData, signalData, sr
