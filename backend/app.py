from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
import base64
import time
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

# Allow large uploads (50MB) — recordings with many base64 frames can be large
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

# Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Lazy-initialize Gemini service (avoids import errors if key not set)
_gemini_service = None


def get_gemini():
    global _gemini_service
    if _gemini_service is None:
        from services.gemini_service import GeminiService
        _gemini_service = GeminiService()
    return _gemini_service


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "0.2.0"
    })


@app.route('/api/inspect', methods=['POST'])
def inspect():
    """
    Accept inspection data from frontend — save + analyze.

    Accepts:
    - frames: JSON array of base64-encoded JPEG images
    - audio: audio blob file (optional)

    Returns: saved data + Gemini analysis (visual + audio + correlation)
    """
    try:
        # Parse frames from form data or JSON body
        if request.is_json:
            data = request.get_json()
            frames = data.get('frames', [])
            audio_data = None
        else:
            frames_json = request.form.get('frames', '[]')
            frames = json.loads(frames_json)
            audio_file = request.files.get('audio')
            audio_data = audio_file.read() if audio_file else None

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        # Create inspection directory
        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        # Save frames to disk
        saved_frames = []
        for i, frame_b64 in enumerate(frames):
            raw_b64 = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            frame_bytes = base64.b64decode(raw_b64)
            frame_path = os.path.join(inspection_dir, f'frame_{i:04d}.jpg')
            with open(frame_path, 'wb') as f:
                f.write(frame_bytes)
            saved_frames.append(f'frame_{i:04d}.jpg')

        # Save audio if present
        has_audio = False
        if audio_data and len(audio_data) > 0:
            audio_path = os.path.join(inspection_dir, 'audio.webm')
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
            has_audio = True

        print(f"[INSPECT] Received inspection {inspection_id}: "
              f"{len(saved_frames)} frames, audio={'yes' if has_audio else 'no'}")

        # Run AI analysis
        gemini = get_gemini()
        result = {
            "status": "analyzed",
            "inspection_id": inspection_id,
            "frame_count": len(saved_frames),
            "has_audio": has_audio,
        }

        # Visual analysis
        try:
            visual = gemini.analyze_frames(frames)
            result["visual_analysis"] = visual
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e)}

        # Audio transcription
        if has_audio and audio_data:
            try:
                transcription = gemini.transcribe_audio(audio_data)
                result["audio_transcription"] = transcription

                # Timestamp correlation (frames at 2fps = 0.5s intervals)
                frame_timestamps = [i * 0.5 for i in range(len(frames))]
                correlation = gemini.correlate_timestamps(transcription, frame_timestamps)
                result["timestamp_correlation"] = correlation
            except Exception as e:
                print(f"[WARN] Audio transcription failed: {e}")
                result["audio_transcription"] = {"error": str(e)}

        # Save analysis result
        result_path = os.path.join(inspection_dir, 'analysis.json')
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Inspection failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze/visual', methods=['POST'])
def analyze_visual():
    """
    Analyze frames visually with Gemini (standalone endpoint for testing).

    Accepts JSON: {"frames": ["base64...", ...]}
    """
    try:
        data = request.get_json()
        frames = data.get('frames', [])

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        gemini = get_gemini()
        result = gemini.analyze_frames(frames)
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Visual analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze/audio', methods=['POST'])
def analyze_audio():
    """
    Transcribe audio with Gemini (standalone endpoint for testing).

    Accepts multipart: audio file
    """
    try:
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({"error": "No audio file provided"}), 400

        audio_data = audio_file.read()
        gemini = get_gemini()
        result = gemini.transcribe_audio(audio_data)
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Audio transcription failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  CAT VISION-INSPECT API v0.2")
    print("  Running on http://0.0.0.0:5001")
    print("  Gemini: gemini-2.0-flash")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
