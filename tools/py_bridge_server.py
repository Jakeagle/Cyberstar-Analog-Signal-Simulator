import sys
import importlib
import tempfile
import os
import json
import shutil
import subprocess


# Fail loudly and helpfully if required Python packages are missing.
def _require_modules(mods):
    missing = []
    for m in mods:
        try:
            importlib.import_module(m)
        except Exception:
            missing.append(m)
    if missing:
        print("\nERROR: Missing required Python package(s): {}".format(', '.join(missing)))
        print("Install them with:")
        print("  python -m pip install -r tools/requirements.txt")
        print("If you don't have Python, download it from https://www.python.org/downloads/")
        print("On Windows, if Python is installed but 'python' is not found, disable App Execution Aliases: Settings → Apps → App execution aliases")
        try:
            input("Press Enter to exit...")
        except Exception:
            pass
        sys.exit(1)


_require_modules(['flask', 'soundfile', 'numpy'])

from flask import Flask, request, send_file, jsonify
from wav_to_rshw import wav_to_rshw, extract_audio_and_signals

app = Flask(__name__)


@app.route('/py-bridge/convert', methods=['POST'])
def convert():
    if 'wav' not in request.files:
        return jsonify({'error': 'missing file field `wav`'}), 400
    f = request.files['wav']
    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, 'input.wav')
        out_path = os.path.join(td, 'output.rshw')
        f.save(in_path)
        # Try to extract audio bytes and signals, then prefer dotnet serializer if available
        try:
            audio_bytes, signals, sr = extract_audio_and_signals(in_path)
            # write signals JSON
            sig_path = os.path.join(td, 'signals.json')
            with open(sig_path, 'w') as sf:
                json.dump(signals, sf)

            out_dotnet = os.path.join(td, 'output_dotnet.rshw')
            if shutil.which('dotnet'):
                # attempt to run the dotnet serializer project
                proj_dir = os.path.join(os.path.dirname(__file__), 'rshw_serializer')
                cmd = ['dotnet', 'run', '--project', proj_dir, '--', '--wav', in_path, '--signals', sig_path, '--out', out_dotnet]
                try:
                    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    return send_file(out_dotnet, as_attachment=True, download_name='output.rshw')
                except subprocess.CalledProcessError as e:
                    # Fall back to Python serializer below
                    print('dotnet serializer failed:', e)

            # Fallback: use existing Python serializer (pickle-based)
            try:
                wav_to_rshw(in_path, out_path)
                return send_file(out_path, as_attachment=True, download_name='output.rshw')
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500


    @app.route('/py-bridge/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok'})


if __name__ == '__main__':
    # Run on localhost:5000 by default
    app.run(host='127.0.0.1', port=5000)
